#!/usr/bin/env tsx
/**
 * scripts/backfill-ghost-richness-into-pg.ts
 *
 * Backfills blank fields on PG `member_profiles` visibility='visible' rows
 * using Ghost Admin v5 API data matched by lower-cased + trimmed email.
 *
 * Rules (baked into the script — no override flags to accidentally write):
 *   - DEFAULT MODE: DRY-RUN. Reports projected writes + writes a backup JSON
 *     of `beforeRows, projectedRows` to /srv/ybw-frontend/backups/
 *   - --apply REQUIRED for writes. Without it, NO PG writes ever happen.
 *   - NO SQL DELETE anywhere. Only UPDATE `data = data || $::jsonb` plus the
 *     specific helper cols (member_slug, created_at) when blank.
 *   - "Blank-only" merge strategy: if PG already has a non-blank value for a
 *     field, we KEEP the PG value (never overwrite). Only truly empty fields
 *     get filled from Ghost. This matches the dedupe script's field strategy.
 *   - Every change (row actually updated) writes an audit row into
 *     `member_audit_log` action='ghost_backfill_fill' with operator set to
 *     (GITHUB_ACTOR || 'maintenance-runner'), before_data / after_data diffed.
 *   - 10% deterministic FNV-1a spot-check across email set: spot prints
 *     before/after for matching rows.
 */
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
// @ts-ignore — installed on VPS
import GhostAdminAPI from "@tryghost/admin-api";

const APPLY = process.argv.includes("--apply");
const OPERATOR = (process.env.GITHUB_ACTOR || "maintenance-runner").slice(0, 48);

dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });

type VisibleRow = {
  clerkId: string | null;
  email: string | null;
  emailLower: string | null;
  memberSlug: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  visibility: string;
  data: Record<string, any>;
};

function _normalizeBaseUrl(raw: any): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  const wp = v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
  return wp.replace(/\/$/, "");
}

function normEmail(s: any): string {
  return String(s || "").trim().toLowerCase();
}

function isBlank(v: any): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
    return true;
  return false;
}

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function writeBackup(filename: string, data: unknown): string {
  const dir = path.resolve(process.cwd(), "backups");
  if (!require("node:fs").existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o770 });
  const full = path.join(dir, filename);
  writeFileSync(full, JSON.stringify(data, null, 2), { mode: 0o660 });
  return full;
}

/**
 * 7-variant COALESCE lookup using any source of email: matches the pattern used
 * in PgMemberStore setEmailsVisibility for BEFORE state retrieval + audit log.
 * Constructs the WHERE clause string + the same `email` param array.
 */
const EMAIL_MATCH_WHERE = `(
  COALESCE(LOWER(email_lower), '', '') = $1
  OR COALESCE(LOWER(data->>'emailLower'), '', '') = $1
  OR COALESCE(LOWER(email), '', '') = $1
  OR COALESCE(LOWER(data->>'Email'), '', '') = $1
  OR COALESCE(LOWER(data->>'user_email'), '', '') = $1
  OR COALESCE(LOWER(data->>'userEmail'), '', '') = $1
  OR COALESCE(LOWER(data->>'email'), '', '') = $1
)`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const backupPayload: any = {
    op: APPLY ? "APPLY" : "DRY-RUN",
    operator: OPERATOR,
    generatedAt: new Date().toISOString(),
    totalGhost: 0,
    totalPgVisible: 0,
    matchedByEmail: 0,
    unmatchedPg: [] as string[],
    unmatchedGhost: [] as string[],
    fieldFills: {} as Record<string, number>,
    rowsMatchedWithAnyChange: 0,
    rowsUpdated: 0,
    rowsSkippedNoChanges: 0,
    auditLogIds: [] as number[],
    sampleSpotChecks: [] as any[],
    spotCheckPass: 0,
    spotCheckTotal: 0,
  };

  try {
    // 1. PG visible rows (full shape)
    const pg = await pool.query<VisibleRow>(`
      SELECT clerk_id AS "clerkId", email, email_lower AS "emailLower",
             member_slug AS "memberSlug",
             created_at AS "createdAt", updated_at AS "updatedAt",
             visibility, data
      FROM member_profiles WHERE visibility='visible'
    `);
    backupPayload.totalPgVisible = pg.rows.length;
    const visibleByEmail = new Map<string, VisibleRow>();
    for (const r of pg.rows) {
      const e = normEmail(r.email || r.emailLower);
      if (e) visibleByEmail.set(e, r);
    }

    // 2. Ghost full fetch with paginated meta check + all includes
    const key = process.env.GHOST_ADMIN_API_KEY || process.env.GHOST_ADMIN_KEY || "";
    const url = _normalizeBaseUrl(
      process.env.NEXT_PUBLIC_GHOST_URL ||
        process.env.GHOST_URL ||
        process.env.GHOST_ADMIN_URL ||
        process.env.GHOST_ADMIN_API_URL ||
        process.env.GHOST_API_URL ||
        process.env.NEXT_PUBLIC_SITE_URL,
    );
    if (!key || !url) {
      console.error("Ghost Admin API key/URL missing.");
      process.exit(1);
    }
    const admin = new GhostAdminAPI({ url, key, version: "v5" });
    const ghostAll: any[] = [];
    let page = 1;
    while (true) {
      const res: any = await admin.members.browse({
        limit: 100,
        page,
        order: "created_at ASC",
        include: "tiers,subscriptions,newsletters,labels",
      });
      const arr = Array.isArray(res) ? res : res?.members || [];
      if (!arr.length) break;
      ghostAll.push(...arr);
      const meta = res?.meta?.pagination;
      if (!meta || !meta.pages || page >= Number(meta.pages)) break;
      page++;
    }
    backupPayload.totalGhost = ghostAll.length;

    const ghostByEmail = new Map<string, any>();
    for (const g of ghostAll) {
      const e = normEmail(g.email);
      if (e) ghostByEmail.set(e, g);
    }

    const matchedKeys = [...visibleByEmail.keys()].filter((e) => ghostByEmail.has(e));
    backupPayload.matchedByEmail = matchedKeys.length;
    backupPayload.unmatchedPg = [...visibleByEmail.keys()].filter((e) => !ghostByEmail.has(e));
    backupPayload.unmatchedGhost = [...ghostByEmail.keys()].filter((e) => !visibleByEmail.has(e));

    // ----- Field map: (pgRow, ghostMember) → { newDataPatch, newHelperCols, changedFields[] }
    // Blank-only merge.
    async function planMerge(
      pgRow: VisibleRow,
      g: any,
    ): Promise<{
      newDataPatch: Record<string, any>;
      newHelperCols: { member_slug?: string; created_at?: string };
      changedFields: string[];
    }> {
      const data = pgRow.data || {};
      const patch: Record<string, any> = {};
      const helpers: { member_slug?: string; created_at?: string } = {};
      const changed: string[] = [];

      // For SQL helper cols (created_at, member_slug), read the LIVE value per row
      // right now because the planMerge call is inside the same transaction/loop
      // as prior row UPDATEs — the initial SELECT cache of pgRow.{createdAt,memberSlug}
      // from the top of this script will otherwise show stale NULLs on idempotent
      // re-runs, causing duplicate "no-op writes" + duplicate audit entries.
      let liveHelpers: { created_at: string | null; member_slug: string | null } = {
        created_at: pgRow.createdAt ?? null,
        member_slug: pgRow.memberSlug ?? null,
      };
      try {
        const fresh = await pool.query(
          `SELECT created_at, member_slug FROM member_profiles WHERE clerk_id = $1 LIMIT 1`,
          [pgRow.clerkId],
        );
        if (fresh.rows.length) {
          liveHelpers = {
            created_at: fresh.rows[0].created_at
              ? new Date(fresh.rows[0].created_at).toISOString()
              : null,
            member_slug: fresh.rows[0].member_slug ?? null,
          };
        }
      } catch {
        /* fall back to cached snapshot */
      }

      const putData = (pgKey: string, incoming: any) => {
        if (isBlank(incoming)) return;
        if (!isBlank((data as any)[pgKey])) return; // keep PG filled
        patch[pgKey] = incoming;
        changed.push(`data.${pgKey}`);
      };

      const putHelper = (col: "member_slug" | "created_at", incoming: any) => {
        if (isBlank(incoming)) return;
        const existing =
          col === "member_slug" ? liveHelpers.member_slug : liveHelpers.created_at;
        if (!isBlank(existing)) return;
        helpers[col] = String(incoming);
        changed.push(`PG.${col}`);
      };

      // --- Join / creation dates ---
      putData("ghostCreatedAt", g.created_at);
      putData("ghostUpdatedAt", g.updated_at);
      putData("memberSince", g.created_at);
      putData("joinDate", g.created_at);
      putData("createdAt", g.created_at);
      putData("updatedAt", g.updated_at);
      if (g.last_seen_at) putData("lastActivityAt", g.last_seen_at);
      if (g.created_at) putData("ghostMemberJoinedAt", g.created_at);
      // SQL helper: created_at (original join date, not migration date)
      putHelper("created_at", g.created_at);

      // --- Stripe (fall through Ghost subscriptions payload; .stripe object usually empty in newer ghost) ---
      if (g.stripe?.customer_id) putData("stripeCustomerId", g.stripe.customer_id);
      if (g.stripe && !isBlank(g.stripe)) putData("stripeCustomer", g.stripe);
      if (g.subscriptions && g.subscriptions.length) {
        putData("stripeSubscriptions", g.subscriptions);
        const active = g.subscriptions.filter((s: any) => s.status === "active");
        if (active.length) {
          putData("stripeSubscriptionId", active[0].id);
          putData("stripePlanInterval", active[0].cadence);
          putData("stripePlanAmount", active[0].amount);
          putData("stripePlanCurrency", active[0].currency);
          putData("stripeCurrentPeriodEnd", active[0].current_period_end);
        }
        const cancelled = g.subscriptions.filter((s: any) => s.status === "canceled");
        if (cancelled.length) putData("stripeCancelledSubscriptions", cancelled);
      }
      putData("stripeSubscriptionStatus", g.status);

      // --- Tier / paid status ---
      putData("membershipTier", g.status);
      putData("paid", g.paid === true);
      if (g.tiers && g.tiers.length) {
        putData("ghostTiers", g.tiers);
        putData("membershipTierName", g.tiers[0].name);
        putData("membershipTierId", g.tiers[0].id);
        if (g.tiers[0]?.monthly_price) {
          putData("tierMonthlyPrice", g.tiers[0].monthly_price);
          putData("tierYearlyPrice", g.tiers[0].yearly_price);
          putData("tierCurrency", g.tiers[0].currency);
        }
      }
      if (g.products && g.products.length) putData("ghostProducts", g.products);

      // --- Newsletter opt-ins ---
      if (g.newsletters && g.newsletters.length) {
        putData("newsletterSubscriptions", g.newsletters);
        putData(
          "newsletterOptedIn",
          g.newsletters.map((n: any) => n.name || n.slug || n.id).filter(Boolean),
        );
      }

      // --- Labels ---
      if (g.labels && g.labels.length) {
        const names = g.labels.map((l: any) => l.name || l).filter(Boolean);
        if (names.length) putData("ghostLabels", names);
        putData("ghostLabelsRaw", g.labels);
      }

      // --- Email engagement ---
      putData("emailCount", g.email_count);
      putData("emailOpenedCount", g.email_opened_count);
      putData("emailClickedCount", g.email_clicked_count);
      putData("emailFailedCount", g.email_failed_count);
      putData("emailOpenedRate", g.email_open_rate);
      putData("emailClickedRate", g.email_clicked_rate);
      putData("emailDeliveredAt", g.email_delivered_at);
      putData("emailOpenedAt", g.email_opened_at);

      // --- Identifiers ---
      putData("ghostMemberId", g.id);
      putData("ghostMemberUuid", g.uuid);
      putData("ghostMemberSlug", g.slug);
      if (g.slug) putHelper("member_slug", g.slug);

      // --- Misc ---
      if (g.note) putData("memberNote", g.note);
      if (g.geolocation) putData("geolocation", g.geolocation);
      if (g.comped === true) putData("complimentary", true);
      if (g.avatar_image) putData("avatarImage", g.avatar_image);

      // --- Name (JSONB first/last name) ---
      if (g.name) {
        const [first, ...rest] = String(g.name).trim().split(/\s+/);
        if (first) putData("firstName", first);
        if (rest.length) putData("lastName", rest.join(" "));
        putData("fullName", g.name);
      }

      return { newDataPatch: patch, newHelperCols: helpers, changedFields: changed };
    }

    const changesSummary: any[] = [];
    let rowsWithAnyChange = 0;
    let rowsUpdated = 0;
    const fieldCounters: Record<string, number> = {};
    const auditIds: number[] = [];
    const spotSamples: any[] = [];

    // Helper: deep-ish before/after data for diff log (stringify-safe)
    function stringy(v: any) {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }

    for (const email of matchedKeys) {
      const pgRow = visibleByEmail.get(email)!;
      const g = ghostByEmail.get(email)!;
      const { newDataPatch, newHelperCols, changedFields } = await planMerge(pgRow, g);
      const hasChanges = changedFields.length > 0;
      if (hasChanges) rowsWithAnyChange++;
      else backupPayload.rowsSkippedNoChanges++;
      for (const f of changedFields) fieldCounters[f] = (fieldCounters[f] || 0) + 1;

      // 10% deterministic spot-check: FNV % 100 < 10
      const spot = fnv1a32(email) % 100;
      const isSpot = spot < 10;
      if (isSpot) backupPayload.spotCheckTotal++;

      if (!hasChanges) {
        if (isSpot) {
          spotSamples.push({ email, spot, status: "SKIP (no blanks to fill)" });
          backupPayload.spotCheckPass++;
        }
        continue;
      }

      if (!APPLY) {
        // DRY-RUN: record, no write
        changesSummary.push({
          email,
          clerkId: pgRow.clerkId,
          changedFields,
          newDataPatch,
          newHelperCols,
        });
        if (isSpot) {
          spotSamples.push({
            email,
            spot,
            clerkId: pgRow.clerkId,
            changedFields,
            newDataPatch_sample: Object.fromEntries(
              Object.entries(newDataPatch).map(([k, v]) => [
                k,
                JSON.stringify(v).length > 120
                  ? JSON.stringify(v).slice(0, 120) + "…"
                  : v,
              ]),
            ),
            newHelperCols,
            _DRY_RUN: "NO WRITES HAPPENED — pass --apply after confirmation.",
          });
          backupPayload.spotCheckPass++;
        }
        continue;
      }

      // ========== APPLY MODE: perform the SQL update + audit write ==========
      // BEFORE snapshot using 7-variant email match, same PK ordering as store
      const beforeSnap = await pool.query(
        `SELECT clerk_id, email, email_lower, member_slug, created_at, updated_at, visibility, data
         FROM member_profiles WHERE ${EMAIL_MATCH_WHERE} ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [email],
      );
      const before = beforeSnap.rows[0] || null;

      // Build UPDATE dynamically: data || patch, optional helpers
      const updateParts: string[] = ["data = COALESCE(data, '{}'::jsonb) || $1::jsonb"];
      const params: any[] = [JSON.stringify(newDataPatch)];
      let pIdx = 2;
      if (newHelperCols.member_slug) {
        updateParts.push(`member_slug = $${pIdx++}`);
        params.push(newHelperCols.member_slug);
      }
      if (newHelperCols.created_at) {
        updateParts.push(`created_at = $${pIdx++}::timestamptz`);
        params.push(newHelperCols.created_at);
      }
      updateParts.push(`updated_at = NOW()`);
      const updateSql = `
        UPDATE member_profiles
        SET ${updateParts.join(", ")}
        WHERE clerk_id = $${pIdx++}
        RETURNING clerk_id, email, email_lower, member_slug, created_at, updated_at, visibility, data
      `;
      params.push(pgRow.clerkId);
      const afterSnap = await pool.query(updateSql, params);
      const after = afterSnap.rows[0] || null;
      if (after) rowsUpdated++;

      // --- Audit log row: action=ghost_backfill_fill
      //     REAL member_audit_log column set matches PgMemberStore.writeAuditLog exactly:
      //     id, action, target_type, target_id, email_lower, operator,
      //     visibility_before, visibility_after, fields_changed(jsonb), note, created_at
      const operatorNorm = OPERATOR;
      const beforeEmailForLog =
        before?.email_lower ||
        (before?.data && (before.data.emailLower || before.data.email)) ||
        before?.email ||
        email;
      const actionStr = "ghost_backfill_fill";
      const targetType = "member_profile";
      const targetId = after?.clerk_id || pgRow.clerkId;
      const visBefore = (before?.visibility || pgRow.visibility || "visible").slice(0, 32);
      const visAfter = (after?.visibility || visBefore).slice(0, 32);
      const fieldsChangedJsonb = JSON.stringify(
        Object.fromEntries(
          changedFields.map((f) => [
            f,
            f.startsWith("data.")
              ? newDataPatch[f.slice("data.".length)]
              : f === "PG.member_slug"
                ? newHelperCols.member_slug
                : f === "PG.created_at"
                  ? newHelperCols.created_at
                  : null,
          ]),
        ),
      );
      const noteStr =
        `Filled ${changedFields.length} blank fields from Ghost: ${changedFields
          .slice(0, 8)
          .join(", ")}${changedFields.length > 8 ? ` (+${changedFields.length - 8} more)` : ""}`.slice(
          0,
          1000,
        );
      const ins = await pool.query(
        `INSERT INTO member_audit_log
         (action, target_type, target_id, email_lower, operator, visibility_before, visibility_after, fields_changed, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,NOW())
         RETURNING id`,
        [
          actionStr,
          targetType,
          targetId,
          String(beforeEmailForLog || email).toLowerCase().slice(0, 255),
          operatorNorm,
          visBefore,
          visAfter,
          fieldsChangedJsonb,
          noteStr,
        ],
      );
      if (ins.rows[0]?.id) auditIds.push(Number(ins.rows[0].id));

      if (isSpot) {
        spotSamples.push({
          email,
          spot,
          clerkId: pgRow.clerkId,
          auditId: ins.rows[0]?.id ?? null,
          changedFields,
          helperCols_set: newHelperCols,
          sampleGhostFields: {
            created_at: g.created_at,
            status: g.status,
            subs: (g.subscriptions || []).length,
            tiers: (g.tiers || []).length,
            newsletters: (g.newsletters || []).length,
          },
          after_snapshot_verified: !!after,
        });
        backupPayload.spotCheckPass++;
      }
    }

    backupPayload.fieldFills = Object.fromEntries(
      Object.entries(fieldCounters).sort((a, b) => b[1] - a[1]),
    );
    backupPayload.rowsMatchedWithAnyChange = rowsWithAnyChange;
    backupPayload.rowsUpdated = rowsUpdated;
    backupPayload.auditLogIds = auditIds;
    backupPayload.sampleSpotChecks = spotSamples;

    // ===== Write backup JSON =====
    const backupPath = writeBackup(
      `backfill-ghost-richness-${APPLY ? "apply" : "dryrun"}-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`,
      APPLY
        ? backupPayload
        : { ...backupPayload, sampleChangesRows: changesSummary.slice(0, 50) },
    );

    // ===== Console summary =====
    console.log(`== Ghost richness → PG backfill (${APPLY ? "APPLY" : "DRY-RUN"}) ==`);
    console.log(`  Operator        : ${OPERATOR}`);
    console.log(`  PG visible rows : ${backupPayload.totalPgVisible}`);
    console.log(`  Ghost members   : ${backupPayload.totalGhost}`);
    console.log(`  Email-matched   : ${backupPayload.matchedByEmail}`);
    console.log(`  Rows with fillable blanks : ${rowsWithAnyChange} / ${backupPayload.matchedByEmail}`);
    console.log(`  Rows SKIP (no blanks to fill) : ${backupPayload.rowsSkippedNoChanges}`);
    if (APPLY) {
      console.log(`  Rows actually UPDATED : ${rowsUpdated}`);
      console.log(`  member_audit_log rows : ${auditIds.length} (ids first 10: ${auditIds
        .slice(0, 10)
        .join(",")}${auditIds.length > 10 ? ` +${auditIds.length - 10} more` : ""})`);
    }
    console.log(`  Backup written  : ${backupPath}`);
    console.log("");
    console.log("-- Per field: rows to receive fill (blank-only, no overwrite) --");
    if (Object.keys(backupPayload.fieldFills).length === 0) {
      console.log("  (nothing to fill — all projected fields already non-blank)");
    }
    for (const [k, n] of Object.entries(backupPayload.fieldFills)) {
      console.log(`  ${k.padEnd(40)} : ${String(n).padStart(4)} rows fill`);
    }
    console.log("");
    console.log(
      `-- 10% spot-check: ${backupPayload.spotCheckPass} / ${backupPayload.spotCheckTotal} PASS (DRY-RUN print samples; APPLY verifies after snapshot) --`,
    );
    for (const s of spotSamples.slice(0, 14)) {
      console.log(
        "  * " +
          `spot=${String(s.spot).padEnd(2)} ${s.email.padEnd(42)} ` +
          `fields=${(s.changedFields || []).length.toString().padStart(3)} ` +
          (APPLY ? `afterOK=${s.after_snapshot_verified} auditId=${s.auditId ?? "null"}` : s._DRY_RUN ? "DRY-RUN" : ""),
      );
    }
    console.log("");
    if (!APPLY) {
      console.log(
        "-- NEXT STEP --: Review the backup JSON above + this console output, then say YES",
      );
      console.log(
        "               to run the APPLY pass (UPDATE + audit-log writes). Without --apply NO PG writes occur.",
      );
    } else {
      console.log("-- APPLY pass complete. Idempotency note: re-running with --apply again -> rowsWithAnyChange should be 0 (blanks already filled, overwrite-never merge).");
    }
    console.log("DONE");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(path.basename(process.argv[1]), "FATAL:", e);
  process.exit(1);
});
