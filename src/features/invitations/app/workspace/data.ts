import 'server-only';
import { cache } from 'react';
import { hostDb, type InvitationSummary } from '../../server/host-db';

/** The host's invitations, read once per request (the workspace layout and its pages both need them). */
export const ownerInvitations = cache((ownerId: string) => hostDb.list(ownerId));

/** One of the host's invitations as its list card sees it (counts included), or null. */
export const ownerInvitation = cache(
  async (ownerId: string, id: string): Promise<InvitationSummary | null> =>
    (await ownerInvitations(ownerId)).find((i) => i.id === id) ?? null,
);
