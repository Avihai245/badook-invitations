import { NewTicketSkeleton } from '@/features/support/tickets/ui/skeletons';

/** Shaped like the new ticket's form (skeletons, not spinners). */
export default function NewTicketLoading() {
  return <NewTicketSkeleton />;
}
