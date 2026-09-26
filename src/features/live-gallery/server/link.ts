import 'server-only';
import { galleryDb } from './db';
import { linkToken } from './tokens';

/**
 * The gallery's upload page for the invitation's own page (its gallery section): the guests' link —
 * derived here from the stored nonce with the server's key — while the gallery is on. null when the
 * event has no gallery, it is off, or the server's key changed since the link was made (the host's
 * screen then offers a new one).
 */
export async function invitationGalleryUrl(
  invitationId: string,
  slug: string,
): Promise<{ url: string } | null> {
  const g = await galleryDb.invitationLink(invitationId);
  if (!g || !g.enabled) return null;
  const token = linkToken('upload', invitationId, g.uploadTokenNonce, g.uploadTokenHash);
  return token ? { url: `/e/${slug}/upload?t=${token}` } : null;
}
