import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { devRoutesEnabled } from '@/lib/dev-routes';

type Params = Promise<{ file: string }>;

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
};

// Read per request so the INVITES_DEV_ROUTES gate is evaluated at runtime.
export const dynamic = 'force-dynamic';

/**
 * Dev/QA only: the synthetic media of tests/fixtures/media (scripts/make-test-media.mjs,
 * make-gallery-media.mjs), used by `/dev/invitations/render/…?cover=fixture&music=fixture&gallery=…`.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  if (!devRoutesEnabled()) return new NextResponse(null, { status: 404 });
  const { file } = await params;
  // a video that never arrives: headers, then silence (the cover's stall fallback must kick in)
  if (file === 'never-loads.webm')
    return new NextResponse(new ReadableStream({ start() {} }), {
      headers: { 'content-type': 'video/webm', 'cache-control': 'no-store' },
    });
  const ext = file.split('.').pop() ?? '';
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/.test(file) || !TYPES[ext]) return new NextResponse(null, { status: 404 });
  try {
    const body = await readFile(join(process.cwd(), 'tests/fixtures/media', file));
    return new NextResponse(body, { headers: { 'content-type': TYPES[ext], 'cache-control': 'no-store' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
