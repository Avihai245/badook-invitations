import { readWords } from '@/features/seating/api';
import { seatingDeps, seatingRoute } from '@/features/seating/server';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/seating/words { text } — the host's wishes in words, read into rules to approve. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return seatingRoute(request, (userId, body) => readWords(userId, id, body, seatingDeps));
}
