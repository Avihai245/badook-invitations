import { BillingSkeleton } from '@/features/invitations/app/skeletons';

/** Shaped like the plan and billing screen (§9B.3-H: skeletons, not spinners). */
export default function BillingLoading() {
  return <BillingSkeleton />;
}
