import { liveBodyFor } from '@/features/invitations/server/live-body';
import { invitationsEnabled } from '@/lib/feature';

type Params = Promise<{ slug: string }>;

// Cached like the invitation's page (ISR, on the server and the CDN): refreshed at once when the
// invitation changes (server/revalidate.ts), at most ten minutes after anything else.
export const dynamic = 'force-static';
export const revalidate = 600;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

/**
 * `GET /i/<slug>/live.json` — what the live language switch needs to render the invitation's other
 * languages in the browser: its document, template and render options (renderer/live/payload.ts). The
 * page carries only the small part (the language names, titles, fonts); this comes when a guest reaches
 * for another language — or a few seconds after the cover opens. Never indexed.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404 });
  const { slug } = await params;
  const body = await liveBodyFor(slug);
  if (!body) return new Response('Not found', { status: 404 });
  return Response.json(body, { headers: { 'x-robots-tag': 'noindex, nofollow, noarchive' } });
}
