import 'server-only';
import { notFound } from 'next/navigation';
import { serverEnv } from './env';

/** Feature flag `invitations` (INVITES_FEATURE_ENABLED): when off, every invitation route is a 404. */
export function invitationsEnabled(): boolean {
  return serverEnv().INVITES_FEATURE_ENABLED;
}

export function assertInvitationsEnabled(): void {
  if (!invitationsEnabled()) notFound();
}
