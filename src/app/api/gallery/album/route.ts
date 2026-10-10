import { albumRefresh } from '@/features/album/server/api';
import { albumDeps } from '@/features/album/server/deps';
import { galleryRoute } from '@/features/live-gallery/server/route';

/** POST /api/gallery/album { a } — fresh URLs of the album's photos for a page left open. */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => albumRefresh(body, ip, albumDeps()));
}
