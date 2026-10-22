/**
 *   GET /api/advertise/catalogue
 *
 * The public rate card with live availability for the issue that is currently
 * open for booking. Never throws — a broken database degrades to prices with
 * availability marked unknown.
 */
import { NextResponse } from 'next/server';
import { publicCatalogue } from '@/features/advertising/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const catalogue = await publicCatalogue();
  return NextResponse.json(catalogue);
}
