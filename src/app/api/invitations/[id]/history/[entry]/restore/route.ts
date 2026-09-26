import { restoreEntry } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; entry: string }> };

/**
 * POST /api/invitations/:id/history/:entry/restore — a publish or a save becomes the draft; the draft
 * it replaces is kept in the history first.
 */
export async function POST(request: Request, { params }: Params) {
  const { id, entry } = await params;
  return hostRoute(request, (userId, _body, deps) => restoreEntry(userId, id, Number(entry), deps));
}
