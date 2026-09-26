import { loadSeating, saveSeating } from '@/features/seating/api';
import { seatingDeps, seatingRoute } from '@/features/seating/server';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/seating — the floor plan, tables, units, seats and rules of the event. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return seatingRoute(request, (userId) => loadSeating(userId, id, seatingDeps));
}

/** POST /api/invitations/:id/seating { version, plan } — saves the plan (409 when another window saved first). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return seatingRoute(request, (userId, body) => saveSeating(userId, id, body, seatingDeps));
}
