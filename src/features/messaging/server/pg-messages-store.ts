import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';
import type { Message, MessageThread } from '@/lib/messages';

/* -------------------------------------------------------------------------- */
/*  Schema init                                                               */
/* -------------------------------------------------------------------------- */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS message_threads (
  id          TEXT PRIMARY KEY,
  updated_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  data        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated ON message_threads (updated_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS thread_participants (
  thread_id   TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON thread_participants (user_id, updated_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL,
  read_flag   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL,
  data        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages (thread_id, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_thread_sender   ON messages (thread_id, sender_id, read_flag)
  WHERE read_flag = false;
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initMessagesPgSchema(): Promise<void> {
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
    await initMessagesPgSchema();
    return getMagazinePgPool() !== null;
  } catch (err) {
    console.warn('[messages-pg-store] schema init failed:', err);
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

function autoId(): string {
  return [...Array(20)]
    .map(() =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
        Math.floor(Math.random() * 62)
      ],
    )
    .join('');
}

/* ========================================================================== */
/*  STORE: Message Threads                                                    */
/* ========================================================================== */

export type DbMessageThreadRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: Partial<MessageThread> & Record<string, unknown>;
};

function threadFromRow(row: {
  id: string;
  updated_at: unknown;
  created_at: unknown;
  data: unknown;
} | undefined): DbMessageThreadRecord | null {
  if (!row) return null;
  const dataRaw = row.data ?? {};
  const data =
    dataRaw && typeof dataRaw === 'object'
      ? (dataRaw as Partial<MessageThread> & Record<string, unknown>)
      : ({} as Partial<MessageThread> & Record<string, unknown>);
  return {
    id: row.id,
    createdAt: toIso(row.created_at) ?? toIso(data.createdAt) ?? '',
    updatedAt: toIso(row.updated_at) ?? toIso(data.updatedAt) ?? '',
    data,
  };
}

function threadToDomain(r: DbMessageThreadRecord): MessageThread {
  const d = r.data;
  const participants = Array.isArray(d.participants) && d.participants.every((p) => typeof p === 'string')
    ? (d.participants as string[])
    : [];
  const participantDetails =
    d.participantDetails && typeof d.participantDetails === 'object'
      ? (d.participantDetails as MessageThread['participantDetails'])
      : {};
  const unreadCount =
    d.unreadCount && typeof d.unreadCount === 'object'
      ? (d.unreadCount as Record<string, number>)
      : {};
  const lastMessage =
    d.lastMessage && typeof d.lastMessage === 'object'
      ? (d.lastMessage as NonNullable<MessageThread['lastMessage']>)
      : undefined;
  return {
    id: r.id,
    participants,
    participantDetails,
    unreadCount,
    lastMessage,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...(d as any),
  } as MessageThread;
}

export class PgMessageThreadStore {
  async listForUser(userId: string, limit = 50): Promise<MessageThread[]> {
    if (!userId) return [];
    if (!(await ready())) throw new Error('[PgMessageThreadStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT mt.id, mt.updated_at, mt.created_at, mt.data
         FROM message_threads mt
         JOIN thread_participants tp ON tp.thread_id = mt.id
        WHERE tp.user_id = $1
        ORDER BY mt.updated_at DESC NULLS LAST
        LIMIT $2`,
      [userId, limit],
    );
    const records = rows.map(threadFromRow).filter((r): r is DbMessageThreadRecord => r !== null);
    return records.map(threadToDomain);
  }

  async get(id: string): Promise<MessageThread | null> {
    if (!id) return null;
    if (!(await ready())) throw new Error('[PgMessageThreadStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT id, updated_at, created_at, data FROM message_threads WHERE id = $1`,
      [id],
    );
    const rec = threadFromRow(rows[0]);
    return rec ? threadToDomain(rec) : null;
  }

  async upsert(
    id: string,
    thread: Partial<MessageThread> | Record<string, unknown>,
    opts: {
      merge: boolean;
      createdAt?: string;
      updatedAt?: string;
    } = { merge: true },
  ): Promise<MessageThread> {
    if (!(await ready())) throw new Error('[PgMessageThreadStore] Postgres schema not ready');
    const now = new Date();
    const threadW: Record<string, unknown> =
      thread && typeof thread === 'object' ? (thread as Record<string, unknown>) : {};
    const created = toTimestamp(opts.createdAt ?? threadW.createdAt) ?? now;
    const updated = toTimestamp(opts.updatedAt ?? threadW.updatedAt) ?? now;
    const existing = await this.get(id);

    const participantsRaw = threadW.participants;
    const participants: string[] = Array.isArray(participantsRaw)
      ? (participantsRaw.filter((p) => typeof p === 'string') as string[])
      : existing?.participants ?? [];

    const participantDetails =
      threadW.participantDetails ?? existing?.participantDetails ?? {};
    const unreadCount =
      threadW.unreadCount ?? existing?.unreadCount ?? {};
    const lastMessage =
      threadW.lastMessage ?? existing?.lastMessage;

    const mergedData: Record<string, unknown> = {
      ...(opts.merge ? ((existing as unknown as Record<string, unknown>) ?? {}) : {}),
      ...threadW,
      id,
      participants,
      participantDetails,
      unreadCount,
      ...(lastMessage ? { lastMessage } : {}),
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    };

    const pool = getMagazinePgPool()!;
    if (opts.merge) {
      await pool.query(
        `INSERT INTO message_threads (id, updated_at, created_at, data)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           updated_at = EXCLUDED.updated_at,
           data       = message_threads.data || '{}'::jsonb || EXCLUDED.data`,
        [id, updated, created, JSON.stringify(mergedData)],
      );
    } else {
      await pool.query(
        `INSERT INTO message_threads (id, updated_at, created_at, data)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           updated_at = EXCLUDED.updated_at,
           created_at = EXCLUDED.created_at,
           data       = EXCLUDED.data`,
        [id, updated, created, JSON.stringify(mergedData)],
      );
    }
    for (const userId of participants) {
      await pool.query(
        `INSERT INTO thread_participants (thread_id, user_id, updated_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (thread_id, user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
        [id, userId, updated],
      );
    }
    return threadToDomain({ id, createdAt: created.toISOString(), updatedAt: updated.toISOString(), data: mergedData });
  }

  async updateNestedFields(
    id: string,
    fields: Record<string, unknown>,
    opts: { bumpUpdatedAt?: boolean } = { bumpUpdatedAt: true },
  ): Promise<void> {
    if (!id) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const base = await this.get(id) ?? ({} as Record<string, unknown>);
    const baseData = { ...(base as MessageThread) } as Record<string, unknown>;
    delete (baseData as any).id;
    const patched: Record<string, unknown> = applyDotPathMerge(baseData, fields);
    if (opts.bumpUpdatedAt) patched.updatedAt = nowIso;
    await this.upsert(id, patched, {
      merge: true,
      updatedAt: opts.bumpUpdatedAt ? nowIso : undefined,
    });
  }

  async countAll(): Promise<number> {
    if (!(await ready())) throw new Error('[PgMessageThreadStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM message_threads`);
    return Number.isFinite(Number(rows?.[0]?.c)) ? Number(rows[0].c) : 0;
  }
}

function applyDotPathMerge<T extends Record<string, unknown>>(base: T, updates: Record<string, unknown>): T {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in cursor) || cursor[p] === null || typeof cursor[p] !== 'object') {
        cursor[p] = {};
      }
      cursor = cursor[p] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}

/* ========================================================================== */
/*  STORE: Messages                                                           */
/* ========================================================================== */

export type DbMessageRecord = {
  id: string;
  threadId: string;
  senderId: string;
  read: boolean;
  createdAt: string;
  data: Record<string, unknown>;
};

function messageFromRow(row: {
  id: string;
  thread_id: unknown;
  sender_id: unknown;
  read_flag: unknown;
  created_at: unknown;
  data: unknown;
} | undefined): DbMessageRecord | null {
  if (!row) return null;
  const dataRaw = row.data ?? {};
  const data =
    dataRaw && typeof dataRaw === 'object'
      ? (dataRaw as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const threadId = typeof row.thread_id === 'string' ? row.thread_id : (data.threadId as string) ?? '';
  const senderId = typeof row.sender_id === 'string' ? row.sender_id : (data.senderId as string) ?? '';
  const createdAt = toIso(row.created_at) ?? toIso(data.createdAt) ?? '';
  return {
    id: row.id,
    threadId,
    senderId,
    read: row.read_flag === true,
    createdAt,
    data,
  };
}

function messageToDomain(r: DbMessageRecord): Message {
  return {
    id: r.id,
    threadId: r.threadId,
    senderId: r.senderId,
    senderName: typeof r.data.senderName === 'string' ? r.data.senderName : '',
    senderImage: typeof r.data.senderImage === 'string' ? r.data.senderImage : undefined,
    content: typeof r.data.content === 'string' ? r.data.content : '',
    read: r.read,
    createdAt: r.createdAt,
    ...(r.data as any),
  } as Message;
}

export class PgMessageStore {
  async listForThread(threadId: string, limit = 50): Promise<Message[]> {
    if (!threadId) return [];
    if (!(await ready())) throw new Error('[PgMessageStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const { rows } = await pool.query(
      `SELECT id, thread_id, sender_id, read_flag, created_at, data
         FROM messages
        WHERE thread_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT $2`,
      [threadId, limit],
    );
    const records = rows.map(messageFromRow).filter((r): r is DbMessageRecord => r !== null);
    return records.reverse().map(messageToDomain);
  }

  async create(
    message: Omit<Message, 'id' | 'createdAt'> & { createdAt?: string },
    preferredId?: string,
  ): Promise<Message & { id: string }> {
    if (!(await ready())) throw new Error('[PgMessageStore] Postgres schema not ready');
    const id = preferredId && preferredId.length > 0 ? preferredId : autoId();
    const now = new Date();
    const created = toTimestamp(message.createdAt) ?? now;
    const data: Record<string, unknown> = {
      threadId: message.threadId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderImage: message.senderImage,
      content: message.content,
      read: message.read === true,
      createdAt: created.toISOString(),
    };
    const pool = getMagazinePgPool()!;
    await pool.query(
      `INSERT INTO messages (id, thread_id, sender_id, read_flag, created_at, data)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         read_flag  = EXCLUDED.read_flag,
         created_at = EXCLUDED.created_at,
         data       = EXCLUDED.data`,
      [
        id,
        message.threadId,
        message.senderId,
        message.read === true,
        created,
        JSON.stringify(data),
      ],
    );
    return {
      id,
      threadId: message.threadId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderImage: message.senderImage,
      content: message.content,
      read: message.read === true,
      createdAt: created.toISOString(),
    } satisfies Message as Message & { id: string };
  }

  async markRead(messageIds: string[]): Promise<string[]> {
    if (messageIds.length === 0) return [];
    if (!(await ready())) throw new Error('[PgMessageStore] Postgres schema not ready');
    const pool = getMagazinePgPool()!;
    const params = messageIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await pool.query(
      `UPDATE messages SET read_flag = true WHERE id IN (${params}) AND read_flag = false RETURNING id`,
      messageIds,
    );
    return rows.map((r) => String(r.id));
  }
}

/* ========================================================================== */
/*  Singleton exports                                                         */
/* ========================================================================== */

let _threadStore: PgMessageThreadStore | null = null;
let _msgStore: PgMessageStore | null = null;

export function getPgMessageThreadStore() { if (!_threadStore) _threadStore = new PgMessageThreadStore(); return _threadStore; }
export function getPgMessageStore() { if (!_msgStore) _msgStore = new PgMessageStore(); return _msgStore; }

export const _internals = { pgSchemaReady: () => schemaReady };
