import { partnerRoute } from '@/features/partner/http';
import { getVenue, MAX_PLAN_BYTES, putVenue } from '@/features/partner/venues';
import { venueDeps } from '@/features/partner/venues-server';

type Params = { params: Promise<{ venueId: string }> };

/** A floor plan in base64 is a third bigger than the file, plus the rest of the JSON. */
const MAX_BODY = Math.ceil((MAX_PLAN_BYTES * 4) / 3) + 64 * 1024;

/** The request's JSON, read no further than `max` bytes (null: not JSON; 'too_large'). */
async function readJson(request: Request, max: number): Promise<unknown | 'too_large'> {
  if (Number(request.headers.get('content-length') ?? 0) > max) return 'too_large';
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return 'too_large';
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * PUT /api/partner/v1/venues/{venueId} — Badook Events creates or updates one of its venues, with its
 * floor plan by URL or base64 (docs/partner-api.md).
 */
export async function PUT(request: Request, { params }: Params) {
  const venueId = decode((await params).venueId);
  // the body is read only once the key checked out
  return partnerRoute(request, async (deps) => {
    const body = await readJson(request, MAX_BODY);
    if (body === 'too_large')
      return { status: 413, body: { ok: false, code: 'too_large', max: MAX_PLAN_BYTES } };
    return putVenue(venueId, body, venueDeps(deps));
  });
}

/** GET /api/partner/v1/venues/{venueId} — the venue and its floor plan. */
export async function GET(request: Request, { params }: Params) {
  const venueId = decode((await params).venueId);
  return partnerRoute(request, (deps) => getVenue(venueId, venueDeps(deps)));
}

/** The path's id as sent (a malformed escape is just an invalid id). */
function decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
