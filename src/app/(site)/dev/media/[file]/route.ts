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
export async function GET(request: Request, { params }: { params: Params }) {
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
    const headers = { 'content-type': TYPES[ext], 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
    // byte ranges, like Supabase Storage: audio/video seek with them (the music's start second)
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range') ?? '');
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
      if (start > end)
        return new NextResponse(null, {
          status: 416,
          headers: { 'content-range': `bytes */${body.length}` },
        });
      return new NextResponse(body.subarray(start, end + 1), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}` },
      });
    }
    return new NextResponse(body, { headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
