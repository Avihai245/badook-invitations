import { ART_DIRECTION } from '@/features/art-direction/config';
import { createConcepts } from '@/features/art-direction/server/api';
import { artDeps } from '@/features/art-direction/server/deps';
import { hostRoute } from '@/features/invitations/server/host-route';

/**
 * POST /api/art-direction — "design it for me": three design concepts from the host's photos
 * (small JPEGs made on their device) for the editor's invitation or a new one (feature
 * `art_direction`). The photos are never logged or kept.
 */
export async function POST(request: Request) {
  return hostRoute(request, (_userId, body, _deps, user) => createConcepts(user, body, artDeps()), {
    maxBytes: ART_DIRECTION.maxBodyBytes,
  });
}
