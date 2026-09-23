import { createUpload } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/uploads { contentType, size } — a signed upload URL for
 * invitation-media/{owner}/{invitation}/{uuid}.{ext} after the MIME/size checks (§4 storage).
 * The browser then uploads the file straight to Supabase Storage with the returned token.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => createUpload(userId, id, body, deps));
}
