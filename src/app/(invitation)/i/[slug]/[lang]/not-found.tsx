import { MissingInvitation } from '@/features/invitations/renderer/MissingInvitation';
import { serverEnv } from '@/lib/env';

/** An invitation link with nothing to show (unknown, unpublished or archived) — see layout.tsx. */
export default function InvitationNotFound() {
  return <MissingInvitation brand={serverEnv().INVITES_BRAND_NAME} />;
}
