import type { Metadata } from 'next';
import { TasksScreen } from '@/features/planning/ui/TasksScreen';
import { PlanOff } from '@/features/planning/ui/PlanOff';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { planMetadata, planPageData } from '@/features/planning/server/page';

type Params = Promise<{ id: string }>;

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> =>
  planMetadata(params, (t) => t.planning.tasks.metaTitle);

/** /app/invitations/[id]/plan/tasks — the event's tasks. */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const data = await planPageData(id, '/tasks');
  if (data.off) return <PlanOff id={id} />;
  return (
    <PlanProvider id={id} initial={data.view}>
      <TasksScreen />
    </PlanProvider>
  );
}
