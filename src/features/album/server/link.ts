import 'server-only';
import { linkToken } from '@/features/live-gallery/server/tokens';
import { albumDb } from './db';

/**
 * The album for the invitation's own page (its gallery section, after the event): the album's link —
 * derived here from the stored nonce with the server's key — while the album and the gallery are on.
 * null when there is no album, it is off, or the server's key changed since the link was made.
 */
export async function invitationAlbumUrl(invitationId: string, slug: string): Promise<string | null> {
  const a = await albumDb.invitationLink(invitationId);
  if (!a) return null;
  const token = linkToken('album', invitationId, a.tokenNonce, a.tokenHash);
  return token ? `/e/${slug}/album?a=${token}` : null;
}
