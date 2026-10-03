import 'server-only';
import { cache } from 'react';
import { withDesign } from '../../server/design-summary';
import { hostDb, type InvitationSummary } from '../../server/host-db';

/**
 * The host's invitations, read once per request (the workspace layout and its pages both need them),
 * each with its design for the screens (server/design-summary.ts).
 */
export const ownerInvitations = cache(async (ownerId: string) =>
  (await hostDb.list(ownerId)).map(withDesign),
);

/** One of the host's invitations as its list card sees it (counts included), or null. */
export const ownerInvitation = cache(
  async (ownerId: string, id: string): Promise<InvitationSummary | null> =>
    (await ownerInvitations(ownerId)).find((i) => i.id === id) ?? null,
);
