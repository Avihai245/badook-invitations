import { ListSkeleton } from '@/features/invitations/app/skeletons';

/** Shaped like the list: the greeting header and the invitation cards (§9B.3-H: never a page spinner). */
export default function Loading() {
  return <ListSkeleton />;
}
