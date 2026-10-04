import 'server-only';
import { cache } from 'react';
import { featuresFor } from '@/features/flags/server';
import { invitationGalleryUrl } from '@/features/live-gallery/server/link';
import type { InvitationDocument } from '../contracts/types';

/** What the guest's page adds when the event has it (its cached HTML is the same for every guest). */
export interface PageExtras {
  /** the beacon of how guests use the invitation (feature `analytics`) */
  insights: boolean;
  /** the gallery section's link to the live gallery (feature `live_gallery`, and the gallery on) */
  liveGallery: { url: string } | null;
}

const NONE: PageExtras = { insights: false, liveGallery: null };

/**
 * The event's extras for its guest page, asked once per request (the layout and the page share it).
 * When the event's features can't be read (a database hiccup), the page renders without them.
 */
export const pageExtras = cache(
  async (invitationId: string, doc: InvitationDocument): Promise<PageExtras> => {
    const wantsGallery = doc.sections.some((s) => s.type === 'live_gallery' && s.enabled);
    // the gallery's link is asked beside the features (not after them): one round trip, not two
    const gallery = wantsGallery
      ? invitationGalleryUrl(invitationId, doc.share.slug).catch((err) => {
          console.error('page extras: the gallery’s link is unavailable', err);
          return null;
        })
      : Promise.resolve(null);
    let features: Awaited<ReturnType<typeof featuresFor>>;
    try {
      features = await featuresFor(invitationId);
    } catch (err) {
      console.error('page extras: the event’s features are unavailable', err);
      return NONE;
    }
    const link = await gallery;
    return {
      insights: features.has('analytics'),
      liveGallery: features.has('live_gallery') ? link : null,
    };
  },
);
