import { createInvitation } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

/** POST /api/invitations — the wizard: seeds a draft from the template (§7.2) → { id, slug }. */
export async function POST(request: Request) {
  return hostRoute(request, (userId, body, deps) => createInvitation(userId, body, deps));
}
