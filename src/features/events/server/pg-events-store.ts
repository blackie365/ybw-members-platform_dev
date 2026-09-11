import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import type { Event } from '@/lib/events';

/* -------------------------------------------------------------------------- */
/*  Schema init                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Idempotent DDL (Phase 6d: Events migration to Postgres).
 *
 * Tables map 1-to-1 with the 4 Firestore collections used today:
 *
 *   events                  ← Firestore `events` (event metadata doc per slug)
 *   event_attendees         ← Firestore `events/{slug}/attendees` subcollection
 *   event_interests         ← Firestore `eventInterests` (email signup list)
 *   event_tickets           ← Firestore `event_tickets` (Stripe-purchased ticket record)
 *
 * Pattern matches member/magazine stores: full document as JSONB `data`, with
 * scalar columns for the filters/orderings the 8 call sites actually perform.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  slug            TEXT PRIMARY KEY,
  status          TEXT,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  event_type      TEXT,
  access_level    TEXT,
  price_amount    NUMERIC(12,2),
  ticket_enabled  BOOLEAN NOT NULL DEFAULT false,
  capacity        INTEGER,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data            JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_status_start   ON events (status, start_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_events_start_date     ON events (start_date ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_slug      TEXT NOT NULL,
  attendee_key    TEXT NOT NULL,     -- userId OR 'guest:{emailEscaped}'
  user_id         TEXT,              -- nullable for guest RSVPs
  email           TEXT,
  has_ticket      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data            JSONB NOT NULL,
  PRIMARY KEY (event_slug, attendee_key)
);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user     ON event_attendees (user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event    ON event_attendees (event_slug, created_at ASC);

CREATE TABLE IF NOT EXISTS event_interests (
  id              TEXT PRIMARY KEY,  -- base64url(eventId::email) stable dedupe key
  event_id        TEXT NOT NULL,
  email           TEXT NOT NULL,
  email_lower     TEXT NOT NULL,
  first_name      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data            JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_interests_event_email ON event_interests (event_id, email_lower);
CREATE INDEX IF NOT EXISTS idx_event_interests_email       ON event_interests (email_lower);

CREATE TABLE IF NOT EXISTS event_tickets (
  id                 TEXT PRIMARY KEY,           -- auto on insert, or Stripe-assigned
  event_slug         TEXT NOT NULL,              -- postSlug of the event
  stripe_session_id  TEXT UNIQUE,
  user_id            TEXT,                       -- clerk userId or null for guests
  email              TEXT,
  amount_paid        NUMERIC(12,2),
  currency           TEXT,
  purchased_at       TIMESTAMPTZ,
  payment_status     TEXT,
  ticket_quantity    INTEGER NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data               JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event  ON event_tickets (event_slug, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_tickets_user   ON event_tickets (user_id);
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initEventsPgSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getMagazinePgPool();
      if (!pool) return;
      await pool.query(SCHEMA_SQL);
      schemaReady = true;
    })();
  }
  await schemaPromise;
}

async function ready(): Promise<boolean> {
  try {
    await initEventsPgSchema();
    return getMagazinePgPool() !== null;
  } catch (err) {
    console.warn('[events-pg-store] schema init failed:', err);
    return false;
  }
}

function toTimestamp(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  return null;
}

function toIso(v: unknown): string | undefined {
  const d = toTimestamp(v);
  return d ? d.toISOString() : undefined;
}

/* ========================================================================== */
/*  STORE: Events                                                             */
/* ========================================================================== */

export interface DbEventRecord {
  slug: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  accessLevel?: string;
  priceAmount?: number;
  ticketEnabled?: boolean;
  capacity?: number;
  createdAt?: string;
  updatedAt?: string;
  data: Partial<Event>;
}

function toEvent(row: {
  slug: string;
  status: unknown;
  start_date: unknown;
  end_date: unknown;
  event_type: unknown;
  access_level: unknown;
  price_amount: unknown;
  ticket_enabled: unknown;
  capacity: unknown;
  created_at: unknown;
  updated_at: unknown;
  data: unknown;
} | undefined): DbEventRecord | null {
  if (!row) return null;
  const dataRaw = row.data ?? {};
  const data =
    dataRaw && typeof dataRaw === 'object'
      ? (dataRaw as Partial<Event>)
      : ({} as Partial<Event>);
  const startDate = toIso(row.start_date) ?? toIso(data.startDate);
  const endDate = toIso(row.end_date) ?? toIso(data.endDate);
  const priceAmount =
    typeof row.price_amount === 'number'
      ? row.price_amount
      : typeof data.price === 'number'
        ? data.price
        : undefined;
  return {
    slug: row.slug,
    status: typeof row.status === 'string' ? row.status : data.status,
    startDate,
    endDate,
    eventType: typeof row.event_type === 'string' ? row.event_type : data.eventType,
    accessLevel: typeof row.access_level === 'string' ? row.access_level : data.accessLevel,
    priceAmount,
    ticketEnabled: typeof row.ticket_enabled === 'boolean' ? row.ticket_enabled : data.ticketCardEnabled,
    capacity:
      Number.isFinite(row.capacity) ? Number(row.capacity) : data.capacity,
    createdAt: toIso(row.created_at) ?? toIso(data.createdAt),
    updatedAt: toIso(row.updated_at) ?? toIso(data.updatedAt),
    data,
  };
}

function eventToFullDomainShape(r: DbEventRecord): Event {
  const d = r.data ?? {};
  return {
    id: r.slug,
    slug: r.slug,
    title: typeof d.title === 'string' && d.title ? d.title : '',
    description: typeof d.description === 'string' ? d.description : '',
    startDate: r.startDate ?? typeof d.startDate === 'string' ? d.startDate : '',
    endDate: r.endDate ?? typeof d.endDate === 'string' ? d.endDate : '',
    location: typeof d.location === 'string' ? d.location : '',
    image: typeof d.image === 'string' ? d.image : undefined,
    status: (r.status as any) ?? d.status ?? 'draft',
    eventType: (r.eventType as any) ?? d.eventType ?? 'other',
    accessLevel: (r.accessLevel as any) ?? d.accessLevel ?? 'public',
    price: r.priceAmount ?? d.price,
    memberPrice: d.memberPrice,
    ticketCardEnabled: r.ticketEnabled ?? d.ticketCardEnabled ?? false,
    capacity: r.capacity ?? d.capacity,
    registeredCount: d.registeredCount,
    externalLink: d.externalLink,
    createdAt: r.createdAt ?? d.createdAt ?? new Date(0).toISOString(),
    updatedAt: r.updatedAt ?? d.updatedAt,
    ...(d as any),
  } as Event;
}

/* --- Public store class --------------------------------------------------- */

export class PgEventStore {
  async get(slug: string): Promise<{ success: true; data: Event } | { success: false; error: string }> {
    if (!slug) return { success: false, error: 'Invalid slug' };
    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        const { rows } = await pool.query(
          `SELECT slug, status, start_date, end_date, event_type, access_level,
                  price_amount, ticket_enabled, capacity, created_at, updated_at, data
             FROM events WHERE slug = $1`,
          [slug],
        );
        const rec = toEvent(rows[0]);
        if (rec) return { success: true, data: eventToFullDomainShape(rec) };
      } catch (err) {
        console.warn(`[PgEventStore] get(${slug}) PG query failed:`, err);
      }
    }
    return { success: false, error: 'Event not found in database' };
  }

  /** Partial upsert (equivalent to Firestore `.set({...}, {merge:true})`) */
  async upsert(
    slug: string,
    input: Partial<Event> | Record<string, unknown>,
  ): Promise<{ success: true } | { success: false; error: string }> {
    if (!slug) return { success: false, error: 'Invalid slug' };
    const now = new Date();
    const nowIso = now.toISOString();
    const existingGot = await this.get(slug);
    const existing = existingGot.success ? existingGot : null;
    const base: Partial<Event> = (existing as any)?.data ?? ({} as Partial<Event>);
    const merged: Partial<Event> & Record<string, unknown> = {
      ...(base as Record<string, unknown>),
      ...(input as Record<string, unknown>),
      id: slug,
      updatedAt: nowIso,
    } as any;
    const data = { ...merged };
    const createdAtIso =
      toIso(merged.createdAt) ?? (existing as any)?.data?.createdAt ?? nowIso;
    const status = typeof merged.status === 'string' ? merged.status : undefined;
    const eventType = typeof merged.eventType === 'string' ? merged.eventType : undefined;
    const accessLevel = typeof merged.accessLevel === 'string' ? merged.accessLevel : undefined;
    const ticketEnabled = merged.ticketCardEnabled === true;
    const capacity = Number.isFinite(merged.capacity) ? Number(merged.capacity) : null;
    const priceAmount =
      typeof merged.price === 'number'
        ? merged.price
        : Number.isFinite(merged.priceAmount as any)
          ? Number(merged.priceAmount)
          : null;

    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        await pool.query(
          `INSERT INTO events
             (slug, status, start_date, end_date, event_type, access_level,
              price_amount, ticket_enabled, capacity, created_at, updated_at, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
           ON CONFLICT (slug) DO UPDATE SET
             status       = COALESCE(EXCLUDED.status, events.status),
             start_date   = COALESCE(EXCLUDED.start_date, events.start_date),
             end_date     = COALESCE(EXCLUDED.end_date, events.end_date),
             event_type   = COALESCE(EXCLUDED.event_type, events.event_type),
             access_level = COALESCE(EXCLUDED.access_level, events.access_level),
             price_amount = COALESCE(EXCLUDED.price_amount, events.price_amount),
             ticket_enabled = COALESCE(EXCLUDED.ticket_enabled, events.ticket_enabled),
             capacity     = COALESCE(EXCLUDED.capacity, events.capacity),
             updated_at   = EXCLUDED.updated_at,
             data         = events.data || '{}'::jsonb || EXCLUDED.data`,
          [
            slug,
            status ?? null,
            toTimestamp(merged.startDate),
            toTimestamp(merged.endDate),
            eventType ?? null,
            accessLevel ?? null,
            priceAmount,
            ticketEnabled,
            capacity,
            toTimestamp(createdAtIso) ?? now,
            now,
            JSON.stringify(data ?? {}),
          ],
        );
      } catch (err) {
        console.warn(`[PgEventStore] upsert(${slug}) PG write failed:`, err);
        throw err;
      }
    } else {
      throw new Error('[PgEventStore] Postgres not ready — cannot upsert event');
    }
    return { success: true };
  }

  async listPublishedUpcoming(): Promise<Event[]> {
    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        const { rows } = await pool.query(
          `SELECT slug, status, start_date, end_date, event_type, access_level,
                  price_amount, ticket_enabled, capacity, created_at, updated_at, data
             FROM events
            WHERE status = 'published'
            ORDER BY start_date ASC NULLS LAST
            LIMIT 100`,
        );
        const mapped = rows.map((r) => toEvent(r)).filter((r): r is DbEventRecord => r !== null);
        return mapped.map((r) => eventToFullDomainShape(r));
      } catch (err) {
        console.warn('[PgEventStore] listPublishedUpcoming PG query failed:', err);
      }
    }
    return [];
  }

  /** Admin UI: map `slug → full data` including drafts/archived */
  async listAllBySlug(): Promise<Record<string, Partial<Event>>> {
    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        const { rows } = await pool.query(
          `SELECT slug, status, start_date, end_date, event_type, access_level,
                  price_amount, ticket_enabled, capacity, created_at, updated_at, data
             FROM events`,
        );
        const out: Record<string, Partial<Event>> = {};
        for (const row of rows) {
          const rec = toEvent(row);
          if (!rec) continue;
          out[rec.slug] = rec.data;
        }
        return out;
      } catch (err) {
        console.warn('[PgEventStore] listAllBySlug PG query failed:', err);
      }
    }
    return {};
  }

  /** COUNT(*) for admin dashboards. */
  async countAll(): Promise<number> {
    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM events`);
        if (Number.isFinite(Number(rows?.[0]?.c))) return Number(rows[0].c);
      } catch (err) {
        console.warn('[PgEventStore] countAll PG query failed:', err);
      }
    }
    return 0;
  }

  async countUpcoming(): Promise<number> {
    if (await ready()) {
      try {
        const pool = getMagazinePgPool()!;
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int AS c FROM events WHERE start_date >= NOW()`,
        );
        if (Number.isFinite(Number(rows?.[0]?.c))) return Number(rows[0].c);
      } catch (err) {
        console.warn('[PgEventStore] countUpcoming PG query failed:', err);
      }
    }
    return 0;
  }
}

/* ========================================================================== */
/*  STORE: Event Attendees (sub-collection replacement)                       */
/* ========================================================================== */

export interface EventAttendee {
  eventSlug: string;
  attendeeKey: string;        // userId OR 'guest:{emailEscaped}'
  userId?: string;
  email?: string;
  hasTicket?: boolean;
  createdAt?: string;
  updatedAt?: string;
  data: Record<string, unknown>;
}

export class PgEventAttendeeStore {
  async list(eventSlug: string): Promise<EventAttendee[]> {
    if (!eventSlug) return [];
    if (!(await ready())) throw new Error('[PgEventAttendeeStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT event_slug, attendee_key, user_id, email, has_ticket, created_at, updated_at, data
         FROM event_attendees WHERE event_slug = $1 ORDER BY created_at ASC`,
      [eventSlug],
    );
    return rows.map((r) => ({
      eventSlug: r.event_slug,
      attendeeKey: r.attendee_key,
      userId: typeof r.user_id === 'string' ? r.user_id : undefined,
      email: typeof r.email === 'string' ? r.email : undefined,
      hasTicket: r.has_ticket === true,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
      data:
        r.data && typeof r.data === 'object'
          ? (r.data as Record<string, unknown>)
          : {},
    }));
  }

  async get(eventSlug: string, attendeeKey: string): Promise<EventAttendee | null> {
    if (!eventSlug || !attendeeKey) return null;
    if (!(await ready())) throw new Error('[PgEventAttendeeStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT event_slug, attendee_key, user_id, email, has_ticket, created_at, updated_at, data
         FROM event_attendees
        WHERE event_slug = $1 AND attendee_key = $2`,
      [eventSlug, attendeeKey],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      eventSlug: r.event_slug,
      attendeeKey: r.attendee_key,
      userId: typeof r.user_id === 'string' ? r.user_id : undefined,
      email: typeof r.email === 'string' ? r.email : undefined,
      hasTicket: r.has_ticket === true,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
      data:
        r.data && typeof r.data === 'object'
          ? (r.data as Record<string, unknown>)
          : {},
    };
  }

  async upsert(
    eventSlug: string,
    attendeeKey: string,
    data: Record<string, unknown>,
    opts: {
      userId?: string;
      email?: string;
      hasTicket?: boolean;
      createdAt?: string;
    } = {},
  ): Promise<void> {
    if (!eventSlug || !attendeeKey) return;
    if (!(await ready())) throw new Error('[PgEventAttendeeStore] Postgres schema not ready');
    const now = new Date();
    const d = data && typeof data === 'object' ? data : {};
    const emailNorm = typeof opts.email === 'string' ? opts.email.trim().toLowerCase() : undefined;
    const createdAt = toTimestamp(opts.createdAt) ?? now;
    const hasTicket = opts.hasTicket === true;
    const mergedData = { ...d };
    if (opts.userId) mergedData.uid = opts.userId;
    if (emailNorm) mergedData.email = emailNorm;
    mergedData.hasTicket = hasTicket;
    if (!mergedData.timestamp && (opts.createdAt || d.timestamp)) {
      mergedData.timestamp = opts.createdAt ?? d.timestamp;
    }
    const pool = getMagazinePgPool()!;
    await pool.query(
      `INSERT INTO event_attendees
         (event_slug, attendee_key, user_id, email, has_ticket, created_at, updated_at, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (event_slug, attendee_key) DO UPDATE SET
         user_id    = COALESCE(EXCLUDED.user_id, event_attendees.user_id),
         email      = COALESCE(EXCLUDED.email, event_attendees.email),
         has_ticket = EXCLUDED.has_ticket,
         updated_at = EXCLUDED.updated_at,
         data       = event_attendees.data || '{}'::jsonb || EXCLUDED.data`,
      [
        eventSlug,
        attendeeKey,
        opts.userId ?? null,
        emailNorm ?? null,
        hasTicket,
        createdAt,
        now,
        JSON.stringify(mergedData),
      ],
    );
  }

  async delete(eventSlug: string, attendeeKey: string): Promise<void> {
    if (!eventSlug || !attendeeKey) return;
    if (!(await ready())) throw new Error('[PgEventAttendeeStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    await pool.query(
      `DELETE FROM event_attendees WHERE event_slug = $1 AND attendee_key = $2`,
      [eventSlug, attendeeKey],
    );
  }
}

/* ========================================================================== */
/*  STORE: Event Interests                                                    */
/* ========================================================================== */

export interface EventInterestRecord {
  id: string;               // base64url(eventId::email) stable dedupe
  eventId: string;
  email: string;
  emailLower: string;
  firstName?: string;
  createdAt?: string;
  updatedAt?: string;
  data: Record<string, unknown>;
}

export class PgEventInterestStore {
  async get(id: string): Promise<{ exists: boolean; data?: Record<string, unknown> }> {
    if (!id) return { exists: false };
    if (!(await ready())) throw new Error('[PgEventInterestStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT data FROM event_interests WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return { exists: false };
    const d =
      rows[0].data && typeof rows[0].data === 'object'
        ? (rows[0].data as Record<string, unknown>)
        : {};
    return { exists: true, data: d };
  }

  async upsert(
    record: Omit<EventInterestRecord, 'emailLower' | 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
    },
    opts: { merge: boolean },
  ): Promise<void> {
    if (!record.id || !record.eventId || !record.email) return;
    if (!(await ready())) throw new Error('[PgEventInterestStore] Postgres schema not ready');
    const emailLower = record.email.toLowerCase();
    const firstName = record.firstName ?? undefined;
    const now = new Date();
    const createdAt = toTimestamp(record.createdAt) ?? now;
    const d = record.data ?? {};
    const mergedData: Record<string, unknown> = {
      ...d,
      id: record.id,
      email: record.email,
      emailLower,
      firstName: firstName ?? null,
      eventId: record.eventId,
      updatedAt: now.toISOString(),
    };

    const pool = getMagazinePgPool()!;
    if (opts.merge) {
      await pool.query(
        `INSERT INTO event_interests
           (id, event_id, email, email_lower, first_name, created_at, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           email_lower  = EXCLUDED.email_lower,
           first_name   = COALESCE(EXCLUDED.first_name, event_interests.first_name),
           updated_at   = EXCLUDED.updated_at,
           data         = event_interests.data || '{}'::jsonb || EXCLUDED.data`,
        [
          record.id,
          record.eventId,
          record.email,
          emailLower,
          firstName ?? null,
          createdAt,
          now,
          JSON.stringify(mergedData),
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO event_interests
           (id, event_id, email, email_lower, first_name, created_at, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           email_lower  = EXCLUDED.email_lower,
           first_name   = EXCLUDED.first_name,
           created_at   = EXCLUDED.created_at,
           updated_at   = EXCLUDED.updated_at,
           data         = EXCLUDED.data`,
        [
          record.id,
          record.eventId,
          record.email,
          emailLower,
          firstName ?? null,
          createdAt,
          now,
          JSON.stringify(mergedData),
        ],
      );
    }
  }
}

/* ========================================================================== */
/*  STORE: Event Tickets (Stripe purchases)                                   */
/* ========================================================================== */

export interface EventTicketRecord {
  id?: string;
  eventSlug: string;
  stripeSessionId?: string;
  userId?: string;
  email?: string;
  amountPaid?: number;
  currency?: string;
  purchasedAt?: string;
  paymentStatus?: string;
  ticketQuantity?: number;
  data: Record<string, unknown>;
}

export class PgEventTicketStore {
  async create(ticket: EventTicketRecord): Promise<{ id: string }> {
    if (!(await ready())) throw new Error('[PgEventTicketStore] Postgres schema not ready');
    const id =
      typeof ticket.id === 'string' && ticket.id
        ? ticket.id
        : [...Array(20)]
            .map(() =>
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
                Math.floor(Math.random() * 62)
              ],
            )
            .join('');
    const purchasedAt = toTimestamp(ticket.purchasedAt) ?? new Date();
    const qty = Number.isFinite(ticket.ticketQuantity) ? Number(ticket.ticketQuantity) : 1;
    const d: Record<string, unknown> = { ...(ticket.data ?? {}) };
    d.eventSlug = ticket.eventSlug;
    if (ticket.stripeSessionId) d.stripeSessionId = ticket.stripeSessionId;
    if (ticket.userId) d.userId = ticket.userId;
    if (ticket.email) d.email = ticket.email;
    if (typeof ticket.amountPaid === 'number') d.amountPaid = ticket.amountPaid;
    if (ticket.currency) d.currency = ticket.currency;
    d.purchasedAt = purchasedAt.toISOString();
    if (ticket.paymentStatus) d.paymentStatus = ticket.paymentStatus;
    d.ticketQuantity = qty;
    d.id = id;

    const pool = getMagazinePgPool()!;
    await pool.query(
      `INSERT INTO event_tickets
         (id, event_slug, stripe_session_id, user_id, email, amount_paid, currency,
          purchased_at, payment_status, ticket_quantity, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, event_tickets.stripe_session_id),
         user_id           = COALESCE(EXCLUDED.user_id, event_tickets.user_id),
         email             = COALESCE(EXCLUDED.email, event_tickets.email),
         amount_paid       = COALESCE(EXCLUDED.amount_paid, event_tickets.amount_paid),
         currency          = COALESCE(EXCLUDED.currency, event_tickets.currency),
         purchased_at      = COALESCE(EXCLUDED.purchased_at, event_tickets.purchased_at),
         payment_status    = COALESCE(EXCLUDED.payment_status, event_tickets.payment_status),
         ticket_quantity   = EXCLUDED.ticket_quantity,
         data              = EXCLUDED.data`,
      [
        id,
        ticket.eventSlug,
        ticket.stripeSessionId ?? null,
        ticket.userId ?? null,
        typeof ticket.email === 'string' ? ticket.email : null,
        typeof ticket.amountPaid === 'number' ? ticket.amountPaid : null,
        ticket.currency ?? null,
        purchasedAt,
        ticket.paymentStatus ?? null,
        qty,
        JSON.stringify(d),
      ],
    );
    return { id };
  }
}

/* ========================================================================== */
/*  Singleton exports                                                         */
/* ========================================================================== */

let _e: PgEventStore | null = null;
let _a: PgEventAttendeeStore | null = null;
let _i: PgEventInterestStore | null = null;
let _t: PgEventTicketStore | null = null;

export function getPgEventStore() { if (!_e) _e = new PgEventStore(); return _e; }
export function getPgEventAttendeeStore() { if (!_a) _a = new PgEventAttendeeStore(); return _a; }
export function getPgEventInterestStore() { if (!_i) _i = new PgEventInterestStore(); return _i; }
export function getPgEventTicketStore() { if (!_t) _t = new PgEventTicketStore(); return _t; }

export const _internals = { pgSchemaReady: () => schemaReady };
