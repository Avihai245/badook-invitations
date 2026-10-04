import type { Metadata } from 'next';
import { IdeasScreen } from '@/features/planning/ui/IdeasScreen';
import { PlanOff } from '@/features/planning/ui/PlanOff';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { planMetadata, planPageData } from '@/features/planning/server/page';

type Params = Promise<{ id: string }>;

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> =>
  planMetadata(params, (t) => t.planning.ideas.metaTitle);

/** /app/invitations/[id]/plan/ideas — notes and ideas. */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const data = await planPageData(id, '/ideas');
  if (data.off) return <PlanOff id={id} />;
  return (
    <PlanProvider id={id} initial={data.view}>
      <IdeasScreen />
    </PlanProvider>
  );
}
