import { legalStatus } from '@/features/legal/context';
import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestAcknowledge } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';
import { serviceDb } from '@/lib/supabase/server';

/**
 * POST /api/gallery/acknowledge { t, code?, uploader, version } — this phone saw the notice before its
 * first upload (version 2 of the legal documents; 404 until that version is in force). Fire and forget
 * from the page: the upload never waits for it.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) =>
    guestAcknowledge(body, ip, {
      ...guestDeps(),
      legalActive: () => legalStatus().active,
      async acknowledge(invitationId, uploaderHash, version) {
        const { error } = await serviceDb().rpc('gallery_acknowledge', {
          p_invitation_id: invitationId,
          p_uploader_hash: uploaderHash,
          p_version: version,
        });
        if (error) throw new Error(`gallery_acknowledge: ${error.message}`);
      },
    }),
  );
}
