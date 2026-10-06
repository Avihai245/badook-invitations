import { adminFeed } from '@/features/admin/server/activity/feed';
import { coreDb } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { financeSummary } from '@/features/admin/server/summaries/finance';
import { hostPathSummary } from '@/features/admin/server/summaries/host-path';
import { supportSummary } from '@/features/admin/server/summaries/support';
import { OverviewScreen } from '@/features/admin/ui/overview/OverviewScreen.client';

type Search = Promise<{ denied?: string | string[] }>;

/**
 * The console's overview: the business now — its numbers, the last 30 days and the live feed — with
 * the money and the tickets from their areas (when the role may see them). `?denied=`: an area the
 * staff member's role may not open sent them here. It reads again whenever the server says something
 * changed (the layout's live channel).
 */
export default async function AdminOverviewPage({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaff('dashboard.view', '/app/admin');
  const { denied } = await searchParams;
  const quietly = <T,>(area: string, p: Promise<T | null>) =>
    p.catch((err) => (console.error(`[admin] overview: ${area}`, err), null));
  const [data, feed, finance, support, path] = await Promise.all([
    coreDb.overview(staff.userId),
    adminFeed(staff),
    quietly('finance', financeSummary(staff)),
    quietly('support', supportSummary(staff)),
    hostPathSummary(),
  ]);
  return (
    <OverviewScreen
      data={data}
      feed={feed}
      finance={finance}
      support={support}
      path={path}
      denied={!!denied}
    />
  );
}
