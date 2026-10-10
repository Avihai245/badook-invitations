import { coreDb } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { deployment } from '@/features/admin/server/system';
import { SystemScreen } from '@/features/admin/ui/system/SystemScreen.client';

/** The system now: jobs, queues, services (yes / no only), templates' version, the build, the live channel. */
export default async function AdminSystemPage() {
  const staff = await requireStaff('system.view', '/app/admin/system');
  const state = await coreDb.system(staff.userId);
  return <SystemScreen state={state} deployment={await deployment()} />;
}
