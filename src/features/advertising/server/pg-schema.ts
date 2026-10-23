import { getMagazinePgPool } from '@/features/magazine/server/read-store/pg-client';

/**
 * Idempotent schema init for YBW advertising bookings.
 *
 * YBW has no migration runner — like every other YBW table, the schema is
 * created in code on first use. The table lives in the same `ybw_magazine`
 * database as the magazine tables and is reached through the same pool.
 *
 * Capacity rule: a booking holds its slot once it is 'paid' or 'approved'.
 * Unpaid enquiries and rejected/cancelled rows do not consume inventory.
 *
 * `booking_ref` is written empty on insert and back-filled from the row id in
 * the same transaction, so the unique index is partial — otherwise two
 * simultaneous enquiries would collide on the empty placeholder.
 */
const SCHEMA_SQL = `
DO $$ BEGIN
  CREATE TYPE ybw_ad_booking_kind AS ENUM ('directory', 'classified', 'ad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ybw_ad_booking_status AS ENUM ('enquiry', 'paid', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ybw_ad_bookings (
  id                    BIGSERIAL PRIMARY KEY,
  booking_ref           TEXT NOT NULL DEFAULT '',
  issue_id              TEXT NOT NULL,
  issue_label           TEXT NOT NULL DEFAULT '',
  issue_publish_date    TIMESTAMPTZ,
  kind                  ybw_ad_booking_kind NOT NULL,
  slot_key              TEXT NOT NULL,
  status                ybw_ad_booking_status NOT NULL DEFAULT 'enquiry',
  client                TEXT NOT NULL,
  paid_category         TEXT,
  body_html             TEXT,
  logo_url              TEXT,
  supplied_pdf_path     TEXT,
  placement_size        TEXT,
  page_affinity         INT,
  member_rate           BOOLEAN NOT NULL DEFAULT FALSE,
  contact_name          TEXT,
  contact_email         TEXT,
  contact_phone         TEXT,
  website_url           TEXT,
  amount_pence          INT NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  paid_at               TIMESTAMPTZ,
  editorial_note        TEXT,
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ybw_ad_bookings_ref_unique
  ON ybw_ad_bookings (booking_ref) WHERE booking_ref <> '';
CREATE INDEX IF NOT EXISTS idx_ybw_ad_bookings_issue_status
  ON ybw_ad_bookings (issue_id, status);
CREATE INDEX IF NOT EXISTS idx_ybw_ad_bookings_issue_slot
  ON ybw_ad_bookings (issue_id, slot_key);
CREATE INDEX IF NOT EXISTS idx_ybw_ad_bookings_email
  ON ybw_ad_bookings (lower(contact_email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_ybw_ad_bookings_stripe_session_unique
  ON ybw_ad_bookings (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function initAdBookingSchema(): Promise<void> {
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
