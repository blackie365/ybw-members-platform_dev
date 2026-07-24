import { NextRequest, NextResponse } from 'next/server';
import {
  importIdmlToStoryLibraryFromStoragePathAction,
  importIdmlToStoryLibraryFromUrlAction,
} from '@/app/actions/magazineActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const issueId = String(body?.issueId || '').trim();
    const fileUrl = String(body?.fileUrl || '').trim();
    const storagePath = String(body?.storagePath || '').trim();
    const fileName = String(body?.fileName || '').trim();

    if (!issueId || (!fileUrl && !storagePath) || !fileName) {
      return NextResponse.json(
        { success: false, error: 'issueId plus either fileUrl or storagePath, and fileName are required' },
        { status: 400 },
      );
    }

    const result = storagePath
      ? await importIdmlToStoryLibraryFromStoragePathAction(issueId, storagePath, fileName)
      : await importIdmlToStoryLibraryFromUrlAction(issueId, fileUrl, fileName);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to import IDML stories' },
      { status: 500 },
    );
  }
}
