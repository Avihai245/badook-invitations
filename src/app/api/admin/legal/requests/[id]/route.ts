import { NextResponse } from 'next/server';
import { adminRoute } from '@/features/admin/server/gate';
import { adminRequestSet } from '@/features/legal-requests/server/admin-api';
import { adminLegalDeps, legalRequestsActive } from '@/features/legal-requests/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/legal/requests/:id { status, note, includeNote } — support.reply: the status of a
 * privacy request (a final one tells the requester). Not found until version 2 of the legal documents
 * is in force.
 */
export async function POST(request: Request, { params }: Params) {
  if (!legalRequestsActive()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) =>
    adminRequestSet(staff, id, body, adminLegalDeps()),
  );
}
