#!/usr/bin/env tsx
/**
 * scripts/audit-ghost-vs-pg-empty-fields.ts
 *
 * Dry-run audit (NO writes). Answers:
 *   1. For the 157 visible member_profiles rows in PG, which top-level PG
 *      helper columns and JSONB `data.*` fields are mostly empty?
 *   2. What fields does the Ghost v5 Admin API return per member when
 *      include=tiers,subscriptions,newsletters,labels is used?
 *   3. For each visible row matched by lowercased email to Ghost, project
 *      what a "blank-only" backfill would write for join dates, stripe
 *      data, tiers, newsletters, labels, email engagement.
 *
 * Output:
 *   - backups/ghost-vs-pg-audit-YYYY-MM-DDTHH-MM-SS.sssZ.json
 *   - console summary of: empty field counts, Ghost field shape,
 *     backfill projection per column (would-fill / total)
 */
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: false });
import { basename, join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { Pool } from "pg";
// @ts-ignore — installed on VPS
import GhostAdminAPI from "@tryghost/admin-api";
// @ts-ignore — aliased via tsconfig / local run will resolve or we inline below
import { normalizeBaseUrl } from "@/lib/ghost";

// Fallback normalizeBaseUrl if the tsconfig alias fails in raw tsx direct runs
const _normalizeBaseUrl = normalizeBaseUrl || ((raw: any) => {
  const v = String(raw || "").trim();
  if (!v) return "";
  const wp = v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
  return wp.replace(/\/$/, "");
});

type VisibleRow = {
  clerkId: string | null;
  email: string | null;
  emailLower: string | null;
  memberSlug: string | null;
  isFeatured: boolean | null;
  isActive: boolean | null;
  role: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  visibility: string;
  data: Record<string, any>;
};

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

async function main() {
  const backupDir = join(process.cwd(), "backups");
  mkdirSync(backupDir, { recursive: true });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const audit: any = {
    generatedAt: new Date().toISOString(),
    pgVisible: 0,
    pgVisibleFields: {} as Record<string, { total: number; nonBlank: number }>,
    pgHelperCols: {} as Record<string, number>,
    ghostTotal: 0,
    ghostSampleTopKeys: [] as string[],
    ghostSample: null as any,
    matched: 0,
    unmatchedPg: [] as string[],
    unmatchedGhost: [] as string[],
    projection: {} as Record<string, number>,
    sampleProjections: [] as any[],
  };

  try {
    // 1. PG visible rows
    const pg = await pool.query<VisibleRow>(`
      SELECT clerk_id AS "clerkId", email, email_lower AS "emailLower",
             member_slug AS "memberSlug", is_featured AS "isFeatured",
             is_active AS "isActive", role, created_at AS "createdAt",
             updated_at AS "updatedAt", visibility, data
      FROM member_profiles WHERE visibility='visible'
    `);
    audit.pgVisible = pg.rows.length;
    const visible = pg.rows;

    // helper col fills
    const helperQ = await pool.query(`
      SELECT
        COUNT(*) AS n,
        COUNT(clerk_id) AS clerk_id,
        COUNT(email_lower) AS email_lower,
        COUNT(member_slug) AS member_slug,
        COUNT(is_featured) AS is_featured,
        COUNT(is_active) AS is_active,
        COUNT(role) AS role,
        COUNT(created_at) AS pg_created_at,
        COUNT(updated_at) AS pg_updated_at
      FROM member_profiles WHERE visibility='visible'
    `);
    audit.pgHelperCols = helperQ.rows[0];

    // JSONB field emptiness
    const fieldMap = new Map<string, { total: number; nonBlank: number }>();
    for (const row of visible) {
      const d = row.data || {};
      const keys = new Set<string>(Object.keys(d));
      for (const k of keys) {
        if (!fieldMap.has(k)) fieldMap.set(k, { total: 0, nonBlank: 0 });
        const f = fieldMap.get(k)!;
        f.total++;
        if (!isBlank(d[k])) f.nonBlank++;
      }
    }
    for (const [k, v] of [...fieldMap.entries()].sort(
      (a, b) => b[1].nonBlank - a[1].nonBlank,
    )) {
      audit.pgVisibleFields[k] = v;
    }

    // 2. Ghost Admin API full paginated fetch with includes
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
      console.error("Ghost Admin API key or URL missing.", { key: !!key, url });
      process.exit(1);
    }
    const [kid, secret] = key.split(":");
    if (!kid || !secret) {
      console.error("Ghost Admin API key missing colon-split ID:secret.");
      process.exit(1);
    }
    const admin = new GhostAdminAPI({
      url,
      key,
      version: "v5",
    });
    const ghostAll: any[] = [];
    let page = 1;
    while (true) {
      const res: any = await admin.members.browse({
        limit: 100,
        page,
        order: "created_at ASC",
        include: "tiers,subscriptions,newsletters,labels",
      });
      const arr: any[] = Array.isArray(res) ? res : res?.members || [];
      if (!arr.length) break;
      ghostAll.push(...arr);
      const meta = (res as any)?.meta?.pagination;
      if (!meta || !meta.pages || page >= Number(meta.pages)) break;
      page++;
    }
    audit.ghostTotal = ghostAll.length;
    if (ghostAll.length) {
      const sample = ghostAll[0];
      audit.ghostSampleTopKeys = Object.keys(sample).sort();
      audit.ghostSample = JSON.parse(
        JSON.stringify(sample, (_k, v) =>
          Array.isArray(v)
            ? v.slice(0, 2).map((x) =>
                typeof x === "object" && x !== null
                  ? Object.fromEntries(
                      Object.entries(x as any).map(([kk, val]) => [
                        kk,
                        typeof val === "string" && val.length > 100
                          ? val.slice(0, 100) + "…"
                          : val,
                      ]),
                    )
                  : x,
              )
            : typeof v === "string" && v.length > 200
              ? v.slice(0, 200) + "…"
              : v,
        ),
      );
    }

    // 3. Match + backfill projection
    const ghostByEmail = new Map<string, any>();
    for (const g of ghostAll) ghostByEmail.set(normEmail(g.email), g);
    const pgByEmail = new Map<string, VisibleRow>();
    for (const p of visible) pgByEmail.set(normEmail(p.email || p.emailLower), p);
    const matchKeys = [...ghostByEmail.keys()].filter((e) => pgByEmail.has(e));
    audit.matched = matchKeys.length;
    audit.unmatchedPg = [...pgByEmail.keys()]
      .filter((e) => e && !ghostByEmail.has(e))
      .slice(0, 50);
    audit.unmatchedGhost = [...ghostByEmail.keys()]
      .filter((e) => e && !pgByEmail.has(e))
      .slice(0, 50);

    const projectionCounters: Record<string, number> = {};
    const samples: any[] = [];

    for (const email of matchKeys) {
      const pgRow = pgByEmail.get(email)!;
      const g = ghostByEmail.get(email)!;
      const data = pgRow.data || {};
      const projectedDiff: Record<string, any> = {};
      const projectedData: Record<string, any> = {};
      const projectedHelpers: Record<string, any> = {};

      const considerJSONB = (pgKey: string, incoming: any) => {
        if (isBlank(incoming)) return;
        const existing = (data as any)[pgKey];
        if (!isBlank(existing)) return;
        projectedData[pgKey] = incoming;
        projectedDiff[pgKey] = incoming;
        projectionCounters[`data.${pgKey}`] = (projectionCounters[`data.${pgKey}`] || 0) + 1;
      };

      const considerHelper = (col: string, incoming: any) => {
        if (isBlank(incoming)) return;
        const existing = (pgRow as any)[col];
        if (!isBlank(existing)) return;
        projectedHelpers[col] = incoming;
        projectedDiff[`PG.${col}`] = incoming;
        projectionCounters[`PG.${col}`] = (projectionCounters[`PG.${col}`] || 0) + 1;
      };

      // ---- JOIN / CREATION DATES ----
      considerJSONB("ghostCreatedAt", g.created_at);
      considerJSONB("ghostUpdatedAt", g.updated_at);
      considerJSONB("memberSince", g.created_at);
      considerJSONB("joinDate", g.created_at);
      considerJSONB("createdAt", g.created_at);
      considerJSONB("updatedAt", g.updated_at);
      if (g.last_seen_at) considerJSONB("lastActivityAt", g.last_seen_at);
      if (g.created_at) considerJSONB("ghostMemberJoinedAt", g.created_at);

      // ---- STRIPE DATA ----
      if (g.stripe) {
        considerJSONB("stripeCustomerId", g.stripe.customer_id);
        considerJSONB("stripeCustomer", g.stripe);
      }
      if (g.subscriptions && g.subscriptions.length) {
        considerJSONB("stripeSubscriptions", g.subscriptions);
        const active = g.subscriptions.filter((s: any) => s.status === "active");
        if (active.length) {
          considerJSONB("stripeSubscriptionId", active[0].id);
          considerJSONB("stripePlanInterval", active[0].cadence);
          considerJSONB("stripePlanAmount", active[0].amount);
          considerJSONB("stripePlanCurrency", active[0].currency);
          considerJSONB("stripeCurrentPeriodEnd", active[0].current_period_end);
        }
        const cancelled = g.subscriptions.filter((s: any) => s.status === "canceled");
        if (cancelled.length) considerJSONB("stripeCancelledSubscriptions", cancelled);
      }
      considerJSONB("stripeSubscriptionStatus", g.status);

      // ---- TIER / PAID STATUS ----
      considerJSONB("membershipTier", g.status);
      considerJSONB("paid", g.paid === true);
      if (g.tiers && g.tiers.length) {
        considerJSONB("ghostTiers", g.tiers);
        considerJSONB("membershipTierName", g.tiers[0].name);
        considerJSONB("membershipTierId", g.tiers[0].id);
        if (g.tiers[0]?.monthly_price) {
          considerJSONB("tierMonthlyPrice", g.tiers[0].monthly_price);
          considerJSONB("tierYearlyPrice", g.tiers[0].yearly_price);
          considerJSONB("tierCurrency", g.tiers[0].currency);
        }
      }
      if (g.products && g.products.length) {
        considerJSONB("ghostProducts", g.products);
      }

      // ---- NEWSLETTER OPT-INS ----
      if (g.newsletters && g.newsletters.length) {
        considerJSONB("newsletterSubscriptions", g.newsletters);
        considerJSONB("newsletterOptedIn", g.newsletters.map((n: any) => n.name || n.slug || n.id));
      }

      // ---- MEMBER LABELS ----
      if (g.labels && g.labels.length) {
        const labelNames = g.labels.map((l: any) => l.name || l).filter(Boolean);
        if (labelNames.length) considerJSONB("ghostLabels", labelNames);
        considerJSONB("ghostLabelsRaw", g.labels);
      }

      // ---- EMAIL ENGAGEMENT ----
      considerJSONB("emailCount", g.email_count);
      considerJSONB("emailOpenedCount", g.email_opened_count);
      considerJSONB("emailClickedCount", g.email_clicked_count);
      considerJSONB("emailFailedCount", g.email_failed_count);
      considerJSONB("emailOpenedRate", g.email_opened_rate);
      considerJSONB("emailClickedRate", g.email_clicked_rate);
      considerJSONB("emailDeliveredAt", g.email_delivered_at);
      considerJSONB("emailOpenedAt", g.email_opened_at);

      // ---- NOTE / GHOST URL ----
      considerJSONB("ghostMemberId", g.id);
      considerJSONB("ghostMemberUuid", g.uuid);
      considerJSONB("ghostMemberSlug", g.slug);
      considerJSONB("memberNote", g.note);
      considerJSONB("geolocation", g.geolocation);

      // ---- COMPLIMENTARY ----
      if (g.comped === true) considerJSONB("complimentary", true);

      // ---- AVATAR ----
      considerJSONB("avatarImage", g.avatar_image);

      // ---- HELPERS (JSONB: firstName/lastName don't exist as SQL cols,
      // they live inside JSONB `data` + we also populate member_slug if empty) ----
      if (g.name) {
        const [first, ...rest] = String(g.name).trim().split(/\s+/);
        if (first) considerJSONB("firstName", first);
        if (rest.length) considerJSONB("lastName", rest.join(" "));
        considerJSONB("fullName", g.name);
      }

      if (samples.length < 3 && Object.keys(projectedDiff).length) {
        samples.push({
          email,
          clerkId: pgRow.clerkId,
          projected: Object.keys(projectedDiff).length,
          projectedDiff,
        });
      }
    }

    audit.projection = Object.fromEntries(
      Object.entries(projectionCounters).sort((a, b) => b[1] - a[1]),
    );
    audit.sampleProjections = samples;

    // write JSON backup
    const backupPath = join(
      backupDir,
      `ghost-vs-pg-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    writeFileSync(backupPath, JSON.stringify(audit, null, 2));

    // console summary
    console.log(`== Ghost ↔ PG empty-field audit (DRY-RUN) ==`);
    console.log(`  PG visible rows : ${audit.pgVisible}`);
    console.log(`  Ghost members   : ${audit.ghostTotal}`);
    console.log(`  Email-matched   : ${audit.matched}`);
    console.log(`  Backup written  : ${backupPath}`);
    console.log("");
    console.log("-- PG helper cols (nonBlank / total visible) --");
    for (const [k, v] of Object.entries(audit.pgHelperCols)) {
      if (k === "n") continue;
      console.log(
        `  PG.${String(k).padEnd(18)} : ${String(v).padStart(5)} / ${audit.pgVisible} (blank=${
          audit.pgVisible - Number(v)
        })`,
      );
    }
    console.log("");
    console.log("-- Top 45 JSONB fields: blank rows / total visible (emptiest first) --");
    const fieldEntries = Object.entries(audit.pgVisibleFields).sort(
      (a, b) => a[1].nonBlank - b[1].nonBlank,
    );
    for (const [k, v] of fieldEntries.slice(0, 45)) {
      console.log(
        `  ${k.padEnd(32)} : blank=${String(audit.pgVisible - v.nonBlank).padStart(4)}/${audit.pgVisible}   filled=${v.nonBlank}`,
      );
    }
    console.log("");
    console.log("-- Ghost Admin member top-level keys (" + audit.ghostSampleTopKeys.length + ") --");
    console.log("  " + audit.ghostSampleTopKeys.join(", "));
    console.log("");
    console.log(
      "-- Backfill PROJECTION rows to receive fill (blank-only write, per field) --",
    );
    if (!Object.keys(audit.projection).length) {
      console.log("  (nothing to write — all projected fields already filled)");
    }
    for (const [k, n] of Object.entries(audit.projection)) {
      console.log(`  ${k.padEnd(40)} : would fill ${String(n).padStart(4)} / ${audit.matched}`);
    }
    console.log("");
    console.log("-- Sample projections (first 3 matches with changes) --");
    for (const s of samples) {
      console.log(
        `  * email=${s.email} clerkId=${s.clerkId} changes=${s.projected} keys=${Object.keys(
          s.projectedDiff,
        ).join(",")}`,
      );
    }
    console.log("");
    console.log("-- Unmatched PG emails (missing in Ghost) --");
    for (const e of audit.unmatchedPg.slice(0, 20)) console.log("  -", e);
    console.log("-- Unmatched Ghost emails (missing in PG visible) --");
    for (const e of audit.unmatchedGhost.slice(0, 20)) console.log("  -", e);
    console.log("DONE");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(basename(process.argv[1]), "FATAL:", e);
  process.exit(1);
});
