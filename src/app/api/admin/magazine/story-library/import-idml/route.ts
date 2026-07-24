import { NextRequest, NextResponse } from 'next/server';
import { importIdmlToStoryLibraryFromUrlAction } from '@/app/actions/magazineActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const issueId = String(body?.issueId || '').trim();
    const fileUrl = String(body?.fileUrl || '').trim();
    const fileName = String(body?.fileName || '').trim();

    if (!issueId || !fileUrl || !fileName) {
      return NextResponse.json(
        { success: false, error: 'issueId, fileUrl, and fileName are required' },
        { status: 400 },
      );
    }

    const result = await importIdmlToStoryLibraryFromUrlAction(issueId, fileUrl, fileName);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to import IDML stories' },
      { status: 500 },
    );
  }
}
