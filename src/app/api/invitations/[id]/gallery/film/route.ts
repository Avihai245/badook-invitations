import { getFilm, postFilm } from '@/features/film/server/api';
import { filmDeps } from '@/features/film/server/deps';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/invitations/:id/gallery/film — the highlights film studio's view: the gallery's photos
 * and clips to choose from (signed URLs), the invitation's names, date, palette, fonts and song.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => getFilm(userId, id, filmDeps()));
}

/**
 * POST /api/invitations/:id/gallery/film — the film made in the host's browser joins the gallery:
 * { step: 'reserve', original, display, thumb, width, height, durationMs } → signed upload URLs;
 * { step: 'done', id, show } → checked in storage and added (shown to guests when `show`).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => postFilm(userId, id, body, filmDeps()));
}
