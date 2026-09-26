import { hostRoute } from '@/features/invitations/server/host-route';
import { hostGalleryDeps } from '@/features/live-gallery/server/deps';
import { deleteGallery, getGallery, turnOn, updateSettings } from '@/features/live-gallery/server/host-api';
import { maybeHousekeeping } from '@/features/live-gallery/server/sweep';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/gallery — the live gallery's state: settings, links, QR code, counts, features. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  // housekeeping rides on the hosts' traffic (at most every ten minutes per server)
  void maybeHousekeeping();
  return hostRoute(request, (userId) => getGallery(userId, id, base, hostGalleryDeps()));
}

/** POST /api/invitations/:id/gallery — turns the gallery on (needs live_gallery in the plan). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => turnOn(userId, id, base, hostGalleryDeps()));
}

/** PATCH /api/invitations/:id/gallery { enabled?, mode?, paused?, opensAt?, closesAt?, accessCode? } */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => updateSettings(userId, id, body, base, hostGalleryDeps()));
}

/** DELETE /api/invitations/:id/gallery — the gallery with every photo and video in it. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => deleteGallery(userId, id, hostGalleryDeps()));
}
