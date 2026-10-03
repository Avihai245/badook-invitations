import { hostRoute } from '@/features/invitations/server/host-route';
import { loadPlan, planOperation } from '@/features/planning/server/api';
import { planningDeps } from '@/features/planning/server/deps';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/planning — the event's whole plan (tasks, budget, vendors, ideas). */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => loadPlan(userId, id, planningDeps));
}

/**
 * POST /api/invitations/:id/planning — { op: 'init' | 'settings' | 'dates' | 'ack_headcount', … }: makes
 * the plan from a template, changes its settings, moves the dates after the event's date changed, or
 * marks a change in the guest numbers as seen.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => planOperation(userId, id, body, planningDeps));
}
