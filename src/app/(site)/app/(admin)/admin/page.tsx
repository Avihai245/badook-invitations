import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

type Search = Promise<{ denied?: string | string[] }>;

/** The console's overview. `?denied=`: an area the staff member's role may not open sent them here. */
export default async function AdminOverviewPage({ searchParams }: { searchParams: Search }) {
  await requireStaff('dashboard.view', '/app/admin');
  const { denied } = await searchParams;
  return <AdminAreaStub area="overview" denied={!!denied} />;
}
