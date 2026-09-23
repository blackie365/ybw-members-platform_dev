import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import { initMemberPgSchema } from './member-schema';

/**
 * The member profile object stored in Postgres. Fields follow the shape the
 * Firestore `newMemberCollection` documents used, minus billing-as-truth.
 *
 * Billing/paid state is intentionally NOT the authority here — the paid tier is
 * derived from Ghost. Legacy billing fields (if copied over during migration)
 * are retained for audit only and must not be used for premium gating.
 */
export type MemberVisibility = 'visible' | 'invisible';

export type MemberProfile = Record<string, unknown> & {
  clerkId: string;
  email?: string;
  emailLower?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  memberSlug?: string;
  slug?: string;
  status?: string;
  role?: string;
  isAdmin?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
  visibility?: MemberVisibility;
  createdAt?: string;
  updatedAt?: string;
};

export interface MemberQuery {
  field: string;
  value: unknown;
}

export interface WriteMemberInput {
  clerkId: string;
  profile: Record<string, unknown>;
}

export interface MemberListOptions {
  /** If true, also return rows with visibility='invisible'. Defaults to false
   *  (public-safe: only visible members returned). */
  includeInvisible?: boolean;
}

export interface VisibilityChangeResult {
  updatedRows: number;
  changedRows: number;
  auditLogIds: number[];
}

export interface GhostPriorityMemberInput {
  /** Join key (required, always lowercased for comparison). */
  emailLower: string;
  /** The Clerk-ish id to use for the PG row. Ghost member UUID is acceptable
   *  (not the same as clerk_id native auth, but acceptable for PG rows that
   *  originated in Ghost and only exist in PG for the visibility join). */
  ghostMemberId: string;
  /** Full profile payload — wins any PG-side conflicts per spec. */
  profile: Record<string, unknown>;
  visibility?: MemberVisibility;
}

/**
 * Member store interface. Implementations read/write member profiles (the
 * directory/profile domain). Paid-state gating is handled separately via Ghost;
 * this store only manages profile data.
 */
export interface MemberStore {
  getMemberByClerkId(clerkId: string, opts?: MemberListOptions): Promise<MemberProfile | null>;
  getMemberByEmail(email: string, opts?: MemberListOptions): Promise<MemberProfile | null>;
  getMemberBySlug(slug: string, opts?: MemberListOptions): Promise<MemberProfile | null>;
  queryOne(query: MemberQuery, opts?: MemberListOptions): Promise<MemberProfile | null>;
  getAllActive(opts?: MemberListOptions): Promise<MemberProfile[]>;
  getAll(opts?: MemberListOptions): Promise<MemberProfile[]>;
  getAllAdmin(): Promise<MemberProfile[]>;
  getFeatured(limit?: number, opts?: MemberListOptions): Promise<MemberProfile[]>;
  getRecent(limit?: number, opts?: MemberListOptions): Promise<MemberProfile[]>;
  countActive(opts?: MemberListOptions): Promise<number>;
  upsert(input: WriteMemberInput): Promise<void>;
  patch(clerkId: string, patch: Record<string, unknown>): Promise<void>;
  setFeatured(clerkId: string, featured: boolean): Promise<void>;
  remove(clerkId: string): Promise<void>;
  /**
   * Atomically claim a one-time side effect (e.g. sending a welcome email).
   * Returns true only for the caller that wins the claim; the flag is written
   * into the member's data blob so racing callers can never both claim.
   */
  claimOnce(clerkId: string, attemptField: string): Promise<boolean>;
  /** Release a previously-held claim so the side effect can be retried. */
  clearClaim(clerkId: string, attemptField: string): Promise<void>;
  /** Merge top-level flags into the member's data blob (atomic jsonb merge). */
  setFlags(clerkId: string, flags: Record<string, string>): Promise<void>;
  /** Remove top-level fields from the member's data blob (atomic). */
  removeFields(clerkId: string, fields: string[]): Promise<void>;
  setEmailsVisibility(emailLowers: string[], visibility: MemberVisibility, operator?: string): Promise<VisibilityChangeResult>;
  upsertGhostPriority(input: GhostPriorityMemberInput, operator?: string): Promise<{ changed: boolean; upsertedRow: boolean; auditLogId: number | null }>;
  writeAuditLog(entry: {
    action: string;
    targetType: string;
    targetId: string;
    emailLower?: string;
    visibilityBefore?: MemberVisibility;
    visibilityAfter?: MemberVisibility;
    fieldsChanged?: Record<string, unknown>;
    note?: string;
    operator?: string;
  }): Promise<number>;
  health(): Promise<boolean>;
}

function toMember(
  row: { data: unknown; clerk_id?: string; visibility?: unknown } | undefined,
): MemberProfile | null {
  if (!row) return null;
  const data = (row.data as Record<string, unknown>) ?? {};
  const vis =
    row.visibility === 'invisible' || row.visibility === 'visible'
      ? (row.visibility as MemberVisibility)
      : ((data.visibility as MemberVisibility) ?? 'visible');
  return {
    ...data,
    clerkId: (row.clerk_id || (data.clerkId as string)) as string,
    visibility: vis,
  } as MemberProfile;
}

function extract(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  return (row as any)[field];
}

function valueToParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return String(value);
}

function sanitizeField(field: string): string {
  const safe = field.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safe) throw new Error(`Invalid member data field name: ${field}`);
  return safe;
}

/**
 * Postgres-backed member store.
 *
 * Data model mirrors the magazine pattern: full profile as JSONB under `data`,
 * with helper columns (clerk_id PK, email, email_lower, member_slug,
 * is_featured, is_active, role, created_at, updated_at) for lookups/ordering.
 */
export class PgMemberStore implements MemberStore {
  private async ready(): Promise<boolean> {
    try {
      await initMemberPgSchema();
      return getMagazinePgPool() !== null;
    } catch (err) {
      console.warn('[PgMemberStore] schema init failed:', err);
      return false;
    }
  }

  async health(): Promise<boolean> {
    return this.ready();
  }

  private visFilter(opts?: MemberListOptions): string {
    return opts?.includeInvisible ? '' : " AND visibility = 'visible'";
  }

  async writeAuditLog(entry: {
    action: string;
    targetType: string;
    targetId: string;
    emailLower?: string;
    visibilityBefore?: MemberVisibility;
    visibilityAfter?: MemberVisibility;
    fieldsChanged?: Record<string, unknown>;
    note?: string;
    operator?: string;
  }): Promise<number> {
    if (!(await this.ready())) return -1;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `INSERT INTO member_audit_log (action, target_type, target_id, email_lower, operator, visibility_before, visibility_after, fields_changed, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.emailLower?.toLowerCase() ?? null,
          entry.operator || 'system',
          entry.visibilityBefore ?? null,
          entry.visibilityAfter ?? null,
          entry.fieldsChanged ? JSON.stringify(entry.fieldsChanged) : null,
          entry.note ?? null,
        ],
      );
      return Number(rows[0]?.id) || 0;
    } catch (err) {
      console.warn('[PgMemberStore] writeAuditLog failed:', err);
      return -1;
    }
  }

  async getMemberByClerkId(clerkId: string, opts?: MemberListOptions): Promise<MemberProfile | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles WHERE clerk_id = $1${this.visFilter(opts)}`,
        [clerkId],
      );
      return toMember(rows[0]);
    } catch (err) {
      console.warn(`[PgMemberStore] getMemberByClerkId(${clerkId}) failed:`, err);
      return null;
    }
  }

  async getMemberByEmail(email: string, opts?: MemberListOptions): Promise<MemberProfile | null> {
    if (!(await this.ready())) return null;
    const lower = String(email || '').trim().toLowerCase();
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE (email_lower = $1 OR data->>'emailLower' = $1 OR data->>'email' = $1)${this.visFilter(opts)}
         ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
         LIMIT 1`,
        [lower],
      );
      return toMember(rows[0]);
    } catch (err) {
      console.warn(`[PgMemberStore] getMemberByEmail(${email}) failed:`, err);
      return null;
    }
  }

  async getMemberBySlug(slug: string, opts?: MemberListOptions): Promise<MemberProfile | null> {
    if (!(await this.ready())) return null;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE (member_slug = $1 OR data->>'memberSlug' = $1 OR data->>'slug' = $1 OR data->>'id' = $1)${this.visFilter(opts)}
         LIMIT 1`,
        [slug],
      );
      return toMember(rows[0]);
    } catch (err) {
      console.warn(`[PgMemberStore] getMemberBySlug(${slug}) failed:`, err);
      return null;
    }
  }

  async queryOne(query: MemberQuery, opts?: MemberListOptions): Promise<MemberProfile | null> {
    if (!(await this.ready())) return null;
    const param = valueToParam(query.value);
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE data->>'${sanitizeField(query.field)}' = $1${this.visFilter(opts)}
         LIMIT 1`,
        [param],
      );
      return toMember(rows[0]);
    } catch (err) {
      console.warn(`[PgMemberStore] queryOne(${query.field}) failed:`, err);
      return null;
    }
  }

  async getAllActive(opts?: MemberListOptions): Promise<MemberProfile[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE is_active = true${this.visFilter(opts)}
         ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST`,
      );
      return rows.map((r) => toMember(r) as MemberProfile);
    } catch (err) {
      console.warn('[PgMemberStore] getAllActive failed:', err);
      return [];
    }
  }

  async getAll(opts?: MemberListOptions): Promise<MemberProfile[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE 1=1${this.visFilter(opts)}
         ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST`,
      );
      return rows.map((r) => toMember(r) as MemberProfile);
    } catch (err) {
      console.warn('[PgMemberStore] getAll failed:', err);
      return [];
    }
  }

  async getAllAdmin(): Promise<MemberProfile[]> {
    return this.getAll({ includeInvisible: true });
  }

  async getFeatured(limit = 1, opts?: MemberListOptions): Promise<MemberProfile[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE is_featured = true${this.visFilter(opts)}
         ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return rows.map((r) => toMember(r) as MemberProfile);
    } catch (err) {
      console.warn('[PgMemberStore] getFeatured failed:', err);
      return [];
    }
  }

  async getRecent(limit = 50, opts?: MemberListOptions): Promise<MemberProfile[]> {
    if (!(await this.ready())) return [];
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles
         WHERE is_active = true${this.visFilter(opts)}
         ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return rows.map((r) => toMember(r) as MemberProfile);
    } catch (err) {
      console.warn('[PgMemberStore] getRecent failed:', err);
      return [];
    }
  }

  async countActive(opts?: MemberListOptions): Promise<number> {
    if (!(await this.ready())) return 0;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM member_profiles WHERE is_active = true${this.visFilter(opts)}`,
      );
      return rows[0]?.n ?? 0;
    } catch (err) {
      console.warn('[PgMemberStore] countActive failed:', err);
      return 0;
    }
  }

  async setEmailsVisibility(
    emailLowers: string[],
    visibility: MemberVisibility,
    operator: string = 'system',
  ): Promise<VisibilityChangeResult> {
    if (!(await this.ready())) return { updatedRows: 0, changedRows: 0, auditLogIds: [] };
    if (!emailLowers?.length) return { updatedRows: 0, changedRows: 0, auditLogIds: [] };
    const normalized = Array.from(
      new Set(
      emailLowers
        .map((e) => String(e ?? ''))
        .filter(Boolean)
        .map((e) => e.toLowerCase()),
    ));
    if (!normalized.length) return { updatedRows: 0, changedRows: 0, auditLogIds: [] };
    try {
      const pool = getMagazinePgPool()!;
      const selectPlaceholders = normalized.map((_, i) => `$${i + 1}`).join(',');
      const updatePlaceholders = normalized.map((_, i) => `$${i + 2}`).join(',');
      const matchExpr = `LOWER(TRIM(COALESCE(email_lower, lower(data->>'emailLower'), lower(data->>'email'), lower(data->>'Email'), lower(data->>'user_email'), lower(data->>'userEmail'), email, '')))`;
      const before = await pool.query(
        `SELECT clerk_id, visibility, ${matchExpr} AS email_match FROM member_profiles WHERE ${matchExpr} IN (${selectPlaceholders})`,
        normalized,
      );
      const byId = new Map<string, { vis: MemberVisibility; emailLower?: string }>();
      for (const r of before.rows) {
        const v: MemberVisibility = r.visibility === 'invisible' ? 'invisible' : 'visible';
        byId.set(String(r.clerk_id), { vis: v, emailLower: (r.email_match as string) ?? undefined });
      }
      const res = await pool.query(
        `UPDATE member_profiles SET visibility = $1::text, updated_at = NOW() WHERE ${matchExpr} IN (${updatePlaceholders})`,
        [visibility, ...normalized],
      );
      const updatedRows = Number(res.rowCount ?? 0);
      const auditLogIds: number[] = [];
      let changed = 0;
      for (const [clerkId, info] of byId.entries()) {
        const afterVis = visibility;
        const beforeVis = info.vis as MemberVisibility;
        if (beforeVis !== afterVis) {
          changed++;
          const lid = await this.writeAuditLog({
            action: visibility === 'invisible' ? 'visibility.hide' : 'visibility.show',
            targetType: 'member_profiles',
            targetId: clerkId,
            emailLower: info.emailLower,
            visibilityBefore: beforeVis,
            visibilityAfter: afterVis,
            note: visibility === 'invisible'
              ? 'email not present in Ghost CMS authoritative list → set invisible (no DELETE performed; original data retained)'
              : 're-added email now matches Ghost CMS list → visibility=visible',
            operator,
          });
          if (lid > 0) auditLogIds.push(lid);
        }
      }
      return { updatedRows, changedRows: changed, auditLogIds };
    } catch (err) {
      console.warn('[PgMemberStore] setEmailsVisibility failed:', err);
      return { updatedRows: 0, changedRows: 0, auditLogIds: [] };
    }
  }

  async upsertGhostPriority(
    input: GhostPriorityMemberInput,
    operator: string = 'system',
  ): Promise<{ changed: boolean; upsertedRow: boolean; auditLogId: number | null }> {
    if (!(await this.ready())) return { changed: false, upsertedRow: false, auditLogId: null };
    const emailLower = String(input.emailLower || '').toLowerCase();
    if (!emailLower) return { changed: false, upsertedRow: false, auditLogId: null };
    const profile: Record<string, unknown> = {
      ...(input.profile || {}),
      emailLower,
      visibility: input.visibility ?? 'visible',
    };
    const clerkId = String(input.ghostMemberId || (profile.clerkId as string) || `ghost-${emailLower}`);
    const email = (profile.email as string) || undefined;
    const memberSlug = (profile.memberSlug as string) || (profile.slug as string) || undefined;
    const isFeatured = !!profile.isFeatured;
    const isActive = profile.isActive === false ? false : profile.userInactive === true ? false : true;
    const visibility: MemberVisibility = (input.visibility as MemberVisibility) ?? 'visible';
    const role = (profile.role as string) || undefined;
    const createdAt = profile.createdAt ? new Date(String(profile.createdAt)).toISOString() : null;
    const updatedAt = profile.updatedAt ? new Date(String(profile.updatedAt)).toISOString() : null;
    try {
      const pool = getMagazinePgPool()!;
      const prior = await pool.query(
        `SELECT clerk_id, data, visibility FROM member_profiles WHERE clerk_id = $1`,
        [clerkId],
      );
      const fieldsChanged: Record<string, unknown> = {};
      const before = prior.rows[0];
      const beforeData = before?.data ? (before.data as Record<string, unknown>) : null;
      const beforeVisibility = (before?.visibility as MemberVisibility) ?? 'visible';
      await pool.query(
        `INSERT INTO member_profiles (clerk_id, data, email, email_lower, member_slug, is_featured, is_active, visibility, role, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (clerk_id) DO UPDATE SET
           data = EXCLUDED.data,
           email = EXCLUDED.email,
           email_lower = EXCLUDED.email_lower,
           member_slug = EXCLUDED.member_slug,
           is_featured = EXCLUDED.is_featured,
           is_active = EXCLUDED.is_active,
           visibility = EXCLUDED.visibility,
           role = EXCLUDED.role,
           created_at = COALESCE(member_profiles.created_at, EXCLUDED.created_at),
           updated_at = COALESCE(EXCLUDED.updated_at, member_profiles.updated_at)`,
        [clerkId, JSON.stringify(profile), email, emailLower, memberSlug, isFeatured, isActive, visibility, role, createdAt, updatedAt],
      );
      const upsertedRow = !before;
      if (beforeData) {
        for (const [k, v] of Object.entries(profile)) {
          const existing = beforeData[k];
          if (JSON.stringify(existing) !== JSON.stringify(v)) {
            fieldsChanged[k] = { before: existing ?? null, after: v ?? null };
          }
        }
      }
      const visibilityChanged = !!before && beforeVisibility !== visibility;
      if (visibilityChanged) fieldsChanged['_visibility'] = { before: beforeVisibility, after: visibility };
      const changed = Object.keys(fieldsChanged).length > 0;
      let auditLogId: number | null = null;
      if (upsertedRow || changed) {
        auditLogId = await this.writeAuditLog({
          action: upsertedRow ? 'merge.upsert_ghost_new' : 'merge.upsert_ghost_priority',
          targetType: 'member_profiles',
          targetId: clerkId,
          emailLower,
          visibilityBefore: before ? beforeVisibility : undefined,
          visibilityAfter: visibility,
          fieldsChanged,
          note: upsertedRow
            ? 'Ghost authoritative member row inserted into PG (Ghost-priority first sync)'
            : 'PG member row merged from Ghost authoritative side; Ghost wins all field conflicts per rule set',
          operator,
        });
      }
      return { changed, upsertedRow, auditLogId };
    } catch (err) {
      console.warn(`[PgMemberStore] upsertGhostPriority(${emailLower}) failed:`, err);
      return { changed: false, upsertedRow: false, auditLogId: null };
    }
  }

  async upsert(input: WriteMemberInput): Promise<void> {
    if (!(await this.ready())) return;
    const { clerkId, profile } = input;
    const email = (profile.email as string) || undefined;
    const emailLower = (profile.emailLower as string) || (email ? email.trim().toLowerCase() : undefined);
    const memberSlug = (profile.memberSlug as string) || (profile.slug as string) || undefined;
    const isFeatured = !!profile.isFeatured;
    const isActive = profile.isActive === false ? false : profile.userInactive === true ? false : true;
    const visibility = (profile.visibility as MemberVisibility) ?? 'visible';
    const role = (profile.role as string) || undefined;
    const createdAt = profile.createdAt ? new Date(String(profile.createdAt)).toISOString() : null;
    const updatedAt = profile.updatedAt ? new Date(String(profile.updatedAt)).toISOString() : null;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        `INSERT INTO member_profiles (clerk_id, data, email, email_lower, member_slug, is_featured, is_active, visibility, role, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (clerk_id) DO UPDATE SET
           data = EXCLUDED.data,
           email = EXCLUDED.email,
           email_lower = EXCLUDED.email_lower,
           member_slug = EXCLUDED.member_slug,
           is_featured = EXCLUDED.is_featured,
           is_active = EXCLUDED.is_active,
           visibility = EXCLUDED.visibility,
           role = EXCLUDED.role,
           created_at = COALESCE(member_profiles.created_at, EXCLUDED.created_at),
           updated_at = COALESCE(EXCLUDED.updated_at, member_profiles.updated_at)`,
        [clerkId, JSON.stringify(profile), email, emailLower, memberSlug, isFeatured, isActive, visibility, role, createdAt, updatedAt],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] upsert(${clerkId}) failed:`, err);
    }
  }

  async patch(clerkId: string, patch: Record<string, unknown>): Promise<void> {
    if (!(await this.ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      const { rows } = await pool.query('SELECT data, visibility FROM member_profiles WHERE clerk_id = $1', [clerkId]);
      const existing = rows[0] ? ((rows[0].data as Record<string, unknown>) ?? {}) : {};
      const merged = { ...existing, ...patch, clerkId };
      const visibility =
        patch.visibility === 'invisible' || patch.visibility === 'visible'
          ? (patch.visibility as MemberVisibility)
          : ((rows[0]?.visibility as MemberVisibility) ?? 'visible');
      const visibilityWrite =
        patch.visibility === 'invisible' || patch.visibility === 'visible' ? visibility : null;
      await pool.query(
        `UPDATE member_profiles
         SET data = $2,
             email = COALESCE($3, email),
             email_lower = COALESCE($4, email_lower),
             member_slug = COALESCE($5, member_slug),
             is_featured = COALESCE($6, is_featured),
             is_active = COALESCE($7, is_active),
             visibility = COALESCE($8::text, visibility),
             role = COALESCE($9, role),
             updated_at = COALESCE($10, updated_at)
         WHERE clerk_id = $1`,
        [
          clerkId,
          JSON.stringify(merged),
          (patch.email as string) || (existing.email as string) || null,
          (patch.emailLower as string) || (existing.emailLower as string) || null,
          (patch.memberSlug as string) || (patch.slug as string) || (existing.memberSlug as string) || null,
          patch.isFeatured !== undefined ? !!patch.isFeatured : null,
          patch.isActive !== undefined ? !!patch.isActive : null,
          visibilityWrite,
          (patch.role as string) || (existing.role as string) || null,
          patch.updatedAt ? new Date(String(patch.updatedAt)).toISOString() : new Date().toISOString(),
        ],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] patch(${clerkId}) failed:`, err);
    }
  }

  async setFeatured(clerkId: string, featured: boolean): Promise<void> {
    if (!(await this.ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        'UPDATE member_profiles SET is_featured = $2, updated_at = NOW() WHERE clerk_id = $1',
        [clerkId, featured],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] setFeatured(${clerkId}) failed:`, err);
    }
  }

  async remove(clerkId: string): Promise<void> {
    if (!(await this.ready())) return;
    try {
      const pool = getMagazinePgPool()!;
      await pool.query('DELETE FROM member_profiles WHERE clerk_id = $1', [clerkId]);
    } catch (err) {
      console.warn(`[PgMemberStore] remove(${clerkId}) failed:`, err);
    }
  }

  async claimOnce(clerkId: string, attemptField: string): Promise<boolean> {
    if (!(await this.ready())) return false;
    const field = sanitizeField(attemptField);
    try {
      const pool = getMagazinePgPool()!;
      const nowIso = new Date().toISOString();
      const { rowCount } = await pool.query(
        `UPDATE member_profiles
         SET data = jsonb_set(data, $2::text[], to_jsonb($3::text)), updated_at = NOW()
         WHERE clerk_id = $1 AND data->>'${field}' IS NULL`,
        [clerkId, [field], nowIso],
      );
      return (rowCount ?? 0) > 0;
    } catch (err) {
      console.warn(`[PgMemberStore] claimOnce(${clerkId}, ${attemptField}) failed:`, err);
      return false;
    }
  }

  async clearClaim(clerkId: string, attemptField: string): Promise<void> {
    if (!(await this.ready())) return;
    const field = sanitizeField(attemptField);
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        'UPDATE member_profiles SET data = data - $2, updated_at = NOW() WHERE clerk_id = $1',
        [clerkId, field],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] clearClaim(${clerkId}, ${attemptField}) failed:`, err);
    }
  }

  async setFlags(clerkId: string, flags: Record<string, string>): Promise<void> {
    if (!(await this.ready()) || !flags || Object.keys(flags).length === 0) return;
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(flags)) {
      clean[sanitizeField(key)] = String(value ?? new Date().toISOString());
    }
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        'UPDATE member_profiles SET data = data || $2::jsonb, updated_at = NOW() WHERE clerk_id = $1',
        [clerkId, JSON.stringify(clean)],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] setFlags(${clerkId}) failed:`, err);
    }
  }

  async removeFields(clerkId: string, fields: string[]): Promise<void> {
    if (!(await this.ready()) || !fields?.length) return;
    const clean = fields.map(sanitizeField);
    try {
      const pool = getMagazinePgPool()!;
      await pool.query(
        "UPDATE member_profiles SET data = data - $2::text[], updated_at = NOW() WHERE clerk_id = $1",
        [clerkId, clean],
      );
    } catch (err) {
      console.warn(`[PgMemberStore] removeFields(${clerkId}) failed:`, err);
    }
  }
}
