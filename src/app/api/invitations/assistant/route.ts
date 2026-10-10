import { assistantTurn } from '@/features/invitations/assistant/server/api';
import { assistantDeps } from '@/features/invitations/assistant/server/deps';
import { hostRoute } from '@/features/invitations/server/host-route';

/**
 * POST /api/invitations/assistant — one turn of the AI questionnaire: the host's answers in a short
 * chat → the details so far and the next question. Creating the invitation is POST /api/invitations.
 */
export async function POST(request: Request) {
  return hostRoute(request, (_userId, body, _deps, user) => assistantTurn(user, body, assistantDeps(user)));
}
