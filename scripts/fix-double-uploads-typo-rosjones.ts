#!/usr/bin/env -S npx tsx
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_EMAIL = 'rosjones@businesswellbeing.club';

async function main() {
  const probe = await pool.query(`
    SELECT clerk_id, email, data->>'profileImage' AS pi, data FROM member_profiles
    WHERE email = $1 LIMIT 1
  `, [TARGET_EMAIL]);

  if (probe.rowCount === 0) { console.log('No row for', TARGET_EMAIL); await pool.end(); return; }
  const row = probe.rows[0];
  const origPi = row.pi;
  console.log('clerk:', row.clerk_id, '  email:', row.email, '  profileImage:', origPi);

  if (!origPi || !origPi.startsWith('/uploads/uploads/')) {
    console.log('No double-uploads typo present — skipping.');
    await pool.end();
    return;
  }

  const fixedPi = '/uploads/' + origPi.slice('/uploads/uploads/'.length);
  console.log('Target after fix:', fixedPi);

  const now = new Date().toISOString();
  if (!apply) {
    console.log('\n[DRYRUN] would update data->profileImage to', fixedPi);
    console.log('Run with --apply to write.');
    await pool.end();
    return;
  }

  const patch = { profileImage: fixedPi, updatedAt: now };
  const beforeData = JSON.stringify(row.data);
  const res = await pool.query(`
    UPDATE member_profiles
    SET data = data || $2::jsonb,
        updated_at = $3::timestamptz,
        member_slug = COALESCE(member_slug, $4)
    WHERE clerk_id = $1
    RETURNING data->>'profileImage' AS pi_after
  `, [row.clerk_id, JSON.stringify(patch), now, row.data.memberSlug || null]);

  // audit log
  await pool.query(`
    INSERT INTO member_audit_log (action, target_type, target_id, email_lower, operator, fields_changed, note, created_at)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
  `, ['typo_fix_profileimage_double_uploads', 'member_profile', row.clerk_id, TARGET_EMAIL.toLowerCase(), 'system',
      JSON.stringify({ profileImage: { before: origPi, after: fixedPi } }),
      'Stripped duplicate /uploads/uploads/ prefix → /uploads/', now]);

  console.log('APPLIED. New profileImage:', res.rows[0].pi_after);
  console.log('audit_log row inserted.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
