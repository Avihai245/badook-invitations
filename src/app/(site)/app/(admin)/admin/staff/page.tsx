import { adminDb } from '@/features/admin/server/db';
import { requireStaff } from '@/features/admin/server/gate';
import { StaffScreen } from '@/features/admin/ui/staff/StaffScreen.client';

/** The console's staff and what each role may do (staff.view; changes: staff.manage). */
export default async function AdminStaffPage() {
  const staff = await requireStaff('staff.view', '/app/admin/staff');
  const members = await adminDb.staffList(staff.userId);
  return <StaffScreen members={members} />;
}
