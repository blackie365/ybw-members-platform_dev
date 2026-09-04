/**
 * One-time migration: Firestore `newMemberCollection` → Postgres `member_profiles`.
 *
 * Copies every member profile document into the PG members table. Billing
 * fields (membershipTier, stripeCustomerId, subscriptionId, subscriptionStatus,
 * billingInterval, lastPaymentDate, etc.) are COPIED for audit/transition only —
 * they are NOT the source of truth for gating (Ghost is, after this migration).
 *
 * Usage (run from repo root):
 *   source .env.local
 *   PGPASSWORD='...' PGUSER=ybw_app PGDATABASE=ybw_magazine \
 *     npx tsx scripts/migrate-members-to-pg.ts [--dry]
 *
 *   --dry  print what would be written without writing.
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: false });

const DRY = process.argv.includes('--dry');

async function main(): Promise<void> {
  const { initMemberPgSchema } = await import('../src/features/members/server/member-schema');
  const { getMagazinePgPool } = await import(
    '../src/features/magazine/server/read-store/pg-client'
  );
  const { adminDb } = await import('../src/lib/firebase-admin');

  const pool = getMagazinePgPool();
  if (!pool) {
    console.error('No Postgres pool. Set PGPASSWORD/PGUSER/PGDATABASE (or DATABASE_URL). Aborting.');
    process.exit(1);
  }

  if (DRY) {
    console.log('DRY RUN — nothing will be written.');
  } else {
    await initMemberPgSchema();
    console.log('Schema ensured.');
  }

  const payloadToProfile = (id: string, data: Record<string, unknown>) => {
    const email = (data.email as string) || undefined;
    const emailLower = (data.emailLower as string) || (email ? email.trim().toLowerCase() : undefined);
    const memberSlug =
      (data.memberSlug as string) || (data.slug as string) || (data.id as string) || undefined;
    const isFeatured = !!data.isFeatured;
    const isActive =
      data.isActive === false ? false : data.userInactive === true ? false : true;
    const role = (data.role as string) || undefined;
    const createdAt = data.createdAt instanceof Date
      ? data.createdAt.toISOString()
      : typeof data.createdAt === 'string'
      ? (() => {
          const d = new Date(data.createdAt as string);
          return Number.isNaN(d.getTime()) ? null : d.toISOString();
        })()
      : null;
    const updatedAt = data.updatedAt instanceof Date
      ? data.updatedAt.toISOString()
      : typeof data.updatedAt === 'string'
      ? (() => {
          const d = new Date(data.updatedAt as string);
          return Number.isNaN(d.getTime()) ? null : d.toISOString();
        })()
      : null;
    return { email, emailLower, memberSlug, isFeatured, isActive, role, createdAt, updatedAt };
  };

  if (!adminDb) {
    console.error('adminDb not available — cannot read newMemberCollection.');
    process.exit(1);
  }

  console.log('Reading newMemberCollection…');
  const snapshot = await adminDb.collection('newMemberCollection').get();
  let n = 0;
  for (const doc of snapshot.docs) {
    const id = doc.id;
    const raw = { ...(doc.data() || {}) } as Record<string, unknown>;
    const profile = {
      ...raw,
      clerkId: id,
      id,
    };
    const { email, emailLower, memberSlug, isFeatured, isActive, role, createdAt, updatedAt } =
      payloadToProfile(id, profile);
    if (DRY) {
      console.log(`  [member] would write ${id} email=${email ?? 'null'}`);
      n += 1;
      continue;
    }
    await pool.query(
      `INSERT INTO member_profiles
         (clerk_id, data, email, email_lower, member_slug, is_featured, is_active, role, created_at, updated_at)
       VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (clerk_id) DO UPDATE SET
         data = EXCLUDED.data, email = EXCLUDED.email, email_lower = EXCLUDED.email_lower,
         member_slug = EXCLUDED.member_slug, is_featured = EXCLUDED.is_featured,
         is_active = EXCLUDED.is_active, role = EXCLUDED.role,
         created_at = COALESCE(member_profiles.created_at, EXCLUDED.created_at),
         updated_at = COALESCE(EXCLUDED.updated_at, member_profiles.updated_at)`,
      [id, JSON.stringify(profile), email, emailLower, memberSlug, isFeatured, isActive, role, createdAt, updatedAt],
    );
    n += 1;
  }

  console.log(`\nMigration complete: ${n} member profiles (${DRY ? 'DRY RUN' : 'written'}).`);
  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
