import type { Metadata } from 'next';
import { VendorsScreen } from '@/features/planning/ui/VendorsScreen';
import { PlanOff } from '@/features/planning/ui/PlanOff';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { planMetadata, planPageData } from '@/features/planning/server/page';

type Params = Promise<{ id: string }>;

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> =>
  planMetadata(params, (t) => t.planning.vendors.metaTitle);

/** /app/invitations/[id]/plan/vendors — the event's vendors. */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const data = await planPageData(id, '/vendors');
  if (data.off) return <PlanOff id={id} />;
  return (
    <PlanProvider id={id} initial={data.view}>
      <VendorsScreen />
    </PlanProvider>
  );
}
