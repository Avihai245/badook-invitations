import { ResponsesSkeleton } from '@/features/invitations/app/skeletons';

/** Shaped like the RSVPs, under the invitation's header: head, KPI cards, bars, replies (§9B.3-H). */
export default function ResponsesLoading() {
  return <ResponsesSkeleton />;
}
