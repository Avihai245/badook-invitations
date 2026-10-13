import { NextResponse } from 'next/server';
import { adminRoute } from '@/features/admin/server/gate';
import { adminReportAct } from '@/features/legal-requests/server/admin-api';
import { adminLegalDeps, legalRequestsActive } from '@/features/legal-requests/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/legal/reports/:id { action, note } — support.reply: one decision on a report (the
 * database checks the role again: removing an item for good needs an owner or an admin). Not found
 * until version 2 of the legal documents is in force.
 */
export async function POST(request: Request, { params }: Params) {
  if (!legalRequestsActive()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) =>
    adminReportAct(staff, id, body, adminLegalDeps()),
  );
}
