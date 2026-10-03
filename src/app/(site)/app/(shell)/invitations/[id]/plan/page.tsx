import type { Metadata } from 'next';
import { PlanOverviewScreen } from '@/features/planning/ui/PlanOverviewScreen';
import { PlanOff } from '@/features/planning/ui/PlanOff';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { planMetadata, planPageData } from '@/features/planning/server/page';

type Params = Promise<{ id: string }>;

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> =>
  planMetadata(params, (t) => t.planning.metaTitle);

/** /app/invitations/[id]/plan — the planning overview: the next step, this week, the budget meter and the vendors. */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const data = await planPageData(id, '');
  if (data.off) return <PlanOff id={id} />;
  return (
    <PlanProvider id={id} initial={data.view}>
      <PlanOverviewScreen />
    </PlanProvider>
  );
}
