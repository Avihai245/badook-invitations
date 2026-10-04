'use client';

import dynamic from 'next/dynamic';

/**
 * The invitation's optional client parts, each in a chunk of its own: still rendered on the server
 * (the guest's HTML is the same), but a page downloads the script only of the parts it has — not every
 * template's scroll scene, the gallery and the flip cards for an invitation that has none of them. The
 * section views and InvitationBody import them from here. Only parts below the first screen (or with
 * nothing to show in it): what the guest sees first — the cover and its openings — stays in the page's
 * own chunk, so its markup never waits behind a lazy boundary.
 */
export const SceneDriver = dynamic(() => import('./scene/SceneDriver.client').then((m) => m.SceneDriver));
export const SceneCta = dynamic(() => import('./scene/SceneCta.client').then((m) => m.SceneCta));
export const CinematicCover = dynamic(() => import('./cover/Openings.client').then((m) => m.CinematicCover));
export const Gallery = dynamic(() => import('../sections/gallery/Gallery.client').then((m) => m.Gallery));
export const LiveGalleryCard = dynamic(() =>
  import('../sections/live-gallery/LiveGallery.client').then((m) => m.LiveGalleryCard),
);
export const FlipCards = dynamic(() =>
  import('../sections/timeline/FlipCards.client').then((m) => m.FlipCards),
);
export const Reveal = dynamic(() => import('../sections/reveal/Reveal.client').then((m) => m.Reveal));
