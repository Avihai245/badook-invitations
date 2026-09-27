import { actionDeps } from '@/features/admin/server/action-deps';
import { removeStaff, setStaff } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

/** POST /api/admin/staff { email, role, note } — adds a member of the staff or changes their role. */
export async function POST(request: Request) {
  return adminRoute(request, 'staff.manage', (staff, body) => setStaff(staff, body, actionDeps(staff)));
}

/** DELETE /api/admin/staff { email } — the member leaves the console. */
export async function DELETE(request: Request) {
  return adminRoute(request, 'staff.manage', (staff, body) => removeStaff(staff, body, actionDeps(staff)));
}
