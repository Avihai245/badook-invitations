import { describe, expect, it, vi } from 'vitest';
import type { InvitationDocument } from '@/features/invitations/contracts/types';

/**
 * The guest page's extras: the gallery section's links. The page is public, so the album's link (which
 * asks for no code) stays out of it when the host keeps the gallery behind an access code.
 */

vi.mock('server-only', () => ({}));
vi.mock('react', async (actual) => ({
  ...(await actual<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
const gallery = vi.fn();
vi.mock('@/features/live-gallery/server/link', () => ({ invitationGalleryUrl: () => gallery() }));
vi.mock('@/features/album/server/link', () => ({
  invitationAlbumUrl: async () => '/e/noa/album?a=album-token',
}));
vi.mock('@/features/flags/server', () => ({
  featuresFor: async () => new Set(['live_gallery', 'album', 'analytics']),
}));

const { pageExtras } = await import('@/features/invitations/server/page-extras');
const doc = {
  share: { slug: 'noa' },
  sections: [{ type: 'live_gallery', enabled: true }],
} as unknown as InvitationDocument;

describe('the gallery section’s links on the public page', () => {
  it('the album after the event, when the gallery is open to anyone with its link', async () => {
    gallery.mockResolvedValueOnce({ url: '/e/noa/upload?t=upload-token', hasCode: false });
    expect((await pageExtras('inv-1', doc)).liveGallery).toEqual({
      url: '/e/noa/upload?t=upload-token',
      album: '/e/noa/album?a=album-token',
    });
  });

  it('no album link when the host keeps the gallery behind an access code', async () => {
    gallery.mockResolvedValueOnce({ url: '/e/noa/upload?t=upload-token', hasCode: true });
    const extras = await pageExtras('inv-2', doc);
    expect(extras.liveGallery).toEqual({ url: '/e/noa/upload?t=upload-token', album: null });
    expect(JSON.stringify(extras)).not.toContain('album-token');
    expect(JSON.stringify(extras)).not.toContain('hasCode');
  });
});
