import { createPlanUpload } from '@/features/seating/api';
import { seatingDeps, seatingRoute } from '@/features/seating/server';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/seating/upload { contentType, size } — a signed upload URL for the event's
 * floor plan image (PNG, JPEG or WebP, up to 15 MB; a PDF is turned into an image in the browser first).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return seatingRoute(request, (userId, body) => createPlanUpload(userId, id, body, seatingDeps));
}
