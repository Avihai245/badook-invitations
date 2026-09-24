import { OverviewSkeleton, WorkspaceHeaderSkeleton } from '@/features/invitations/app/skeletons';

/**
 * Entering an invitation: its header and tabs and the overview's shape, while the workspace layout
 * (and its page) load.
 */
export default function InvitationLoading() {
  return (
    <>
      <WorkspaceHeaderSkeleton />
      <OverviewSkeleton />
    </>
  );
}
