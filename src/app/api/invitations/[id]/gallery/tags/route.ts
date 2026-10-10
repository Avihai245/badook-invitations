import { isUuid } from '@/features/invitations/server/host-db';
import { galleryDb } from '@/features/live-gallery/server/db';
import { tagsCsv } from '@/features/live-gallery/server/host-api';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/invitations/:id/gallery/tags — the guests who asked to be tagged on Instagram, as CSV for
 * Excel: their username and profile link, their name, how many photos and which (named as in the ZIP).
 */
export async function GET(_request: Request, { params }: Params) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const { id } = await params;
  if (!isUuid(id)) return new Response('Not found', { status: 404, headers: NO_STORE });
  const [gallery, items, { t }] = await Promise.all([
    galleryDb.ownerGet(id, user.id),
    galleryDb.ownerTags(id, user.id),
    getUi(),
  ]);
  if (!gallery || !items) return new Response('Not found', { status: 404, headers: NO_STORE });
  const csv = tagsCsv(items, gallery.timezone ?? 'Asia/Jerusalem', t.liveGallery.tags.csv);
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="instagram-tags-${gallery.slug}.csv"`,
    },
  });
}
