import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

/**
 * Diagnostic v2: confirm the maintenance script's Postgres is the same
 * database the app serves, inspect the target edition row, and reveal the
 * app's env source via the systemd unit.
 */

function host(v: string | undefined): string {
  if (!v) return '(unset)';
  try {
    return v.replace(/:\/\/[^@/]+@/, '://***@');
  } catch {
    return '(unparsable)';
  }
}

async function main() {
  console.log('=== env ===');
  const url = process.env.DATABASE_URL;
  console.log('DATABASE_URL:', host(url));

  const pool = getMagazinePgPool();
  console.log('pool:', pool ? 'present' : 'null');
  if (!pool) {
    console.log('no pool configured — cannot inspect DB');
    return;
  }

  console.log('=== server ===');
  const who = await pool.query('SELECT current_database() AS db, current_user AS usr, inet_server_port() AS port, version() AS v');
  const row = who.rows[0];
  console.log(JSON.stringify({ db: row.db, usr: row.usr, port: row.port, version: row.v.split(' ').slice(0, 4).join(' ') }));

  console.log('=== magazine_reader_editions ===');
  const rowsRes = await pool.query(
    `SELECT count(*) AS total,
            count(data) AS has_data,
            count(data_light) AS has_light
     FROM magazine_reader_editions`,
  );
  console.log(JSON.stringify(rowsRes.rows[0]));

  const slugRes = await pool.query(
    `SELECT id,
            slug,
            length(data::text) AS data_len,
            length((data_light)::text) AS light_len,
            (data->>'generatedAt') AS generated_at,
            (data->>'updatedAt') AS updated_at,
            (data->>'publishDate') AS publish_date
     FROM magazine_reader_editions
     WHERE slug = $1
     ORDER BY (data->>'updatedAt') DESC NULLS LAST, id DESC
     LIMIT 3`,
    ['yorkshire-business-woman-summer-2026-edition'],
  );
  if (!slugRes.rows.length) {
    console.log('slug target: NOT FOUND');
  }
  for (const r of slugRes.rows) {
    console.log('row:', JSON.stringify(r));
  }

  console.log('=== first classifieds entry (by slug, newest) ===');
  const top = await pool.query(
    `SELECT data FROM magazine_reader_editions
     WHERE slug = $1
     ORDER BY (data->>'updatedAt') DESC NULLS LAST, id DESC
     LIMIT 1`,
    ['yorkshire-business-woman-summer-2026-edition'],
  );
  if (top.rows.length) {
    const e = top.rows[0].data as { pages?: Array<{ template?: string; content?: { entries?: unknown[]; generatedAt?: string } }> };
    const pages = Array.isArray(e.pages) ? e.pages : [];
    const cls = pages.find((p) => String(p.template || '').toLowerCase() === 'classifieds');
    const content = cls?.content ?? {};
    const entries = Array.isArray(content.entries) ? content.entries : [];
    console.log('pages:', pages.length, '| entries:', entries.length);
    console.log('generatedAt:', String(content.generatedAt || ''));
    console.log('first entry:', JSON.stringify(entries[0] ?? null));
  } else {
    console.log('no data row for slug');
  }

  console.log('=== systemd unit env source ===');
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});