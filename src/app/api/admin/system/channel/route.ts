import { actionDeps } from '@/features/admin/server/action-deps';
import { renameChannel } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

/**
 * POST /api/admin/system/channel {} — a new name for the console's live channel (owners): pages opened
 * before it stop hearing (e.g. a laptop lost with the console open).
 */
export async function POST(request: Request) {
  return adminRoute(request, 'staff.owners', (staff) => renameChannel(staff, actionDeps(staff)));
}
