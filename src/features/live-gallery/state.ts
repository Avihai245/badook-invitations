import type { GalleryState } from './types';

/**
 * Where a gallery stands at `now`: off (turned off, or the invitation archived), not open yet, over
 * (its window ended — guests still see the photos), paused by the host, or open for uploads.
 */
export function galleryState(
  g: { enabled: boolean; paused: boolean; opensAt: string | null; closesAt: string | null },
  invitationStatus: string,
  now: number,
): GalleryState {
  if (!g.enabled || invitationStatus === 'archived') return 'off';
  if (g.opensAt && now < Date.parse(g.opensAt)) return 'scheduled';
  if (g.closesAt && now >= Date.parse(g.closesAt)) return 'ended';
  if (g.paused) return 'paused';
  return 'open';
}

/** Guests may look at the photos in every state but off. */
export const feedVisible = (state: GalleryState): boolean => state !== 'off';
