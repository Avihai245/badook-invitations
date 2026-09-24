import { deleteGuests, importGuests, listGuests } from '@/features/invitations/server/guests';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/guests — the guest list with each guest's delivery and reply. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => listGuests(userId, id));
}

/** POST /api/invitations/:id/guests — { guests: [...] } from a spreadsheet or typed by hand. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => importGuests(userId, id, body));
}

/** DELETE /api/invitations/:id/guests — { ids } (their replies stay, unlinked). */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => deleteGuests(userId, id, body));
}
