import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlanOff } from '@/features/planning/ui/PlanOff';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { PlanStart } from '@/features/planning/ui/PlanStart';
import { planMetadata, planPageData } from '@/features/planning/server/page';

type Params = Promise<{ id: string }>;

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> =>
  planMetadata(params, (t) => t.planning.metaTitle);

/**
 * /app/invitations/[id]/plan — setting the plan up; once it exists the planning's tools are in the
 * event's navigation and its next step on the event's home (one next step, not three), so this leads there.
 */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const data = await planPageData(id, '');
  if (data.off) return <PlanOff id={id} />;
  if (data.view.settings) redirect(`/app/invitations/${id}`);
  return (
    <PlanProvider id={id} initial={data.view}>
      <PlanStart />
    </PlanProvider>
  );
}
