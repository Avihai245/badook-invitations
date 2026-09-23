import { checkSlug } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

/** GET /api/invitations/slug?slug=&id= — { valid, available } for the publish dialog (§9B.3-F). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';
  const id = url.searchParams.get('id');
  return hostRoute(request, (_userId, _body, deps) => checkSlug(slug, id, deps));
}
