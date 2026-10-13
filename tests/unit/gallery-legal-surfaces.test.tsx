// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '@/features/live-gallery/types';
import { GuestTextProvider } from '@/features/live-gallery/ui/guest-text';
import { FeedPost } from '@/features/live-gallery/ui/guest/FeedPost';
import { groupPosts } from '@/features/live-gallery/ui/guest/posts';
import { StoryViewer } from '@/features/live-gallery/ui/guest/StoryViewer';
import { groupStories } from '@/features/live-gallery/ui/guest/stories';
import { legalPage, privacyRequestLink, reportLink } from '@/features/live-gallery/ui/legal';
import { aiPhotosGuestEn as AI } from '@/lib/i18n/ai-photos-guest.en';
import { galleryGuestEn as EN } from '@/lib/i18n/gallery-guest.en';
import { galleryGuestHe as HE } from '@/lib/i18n/gallery-guest.he';

// Version 2 of the legal documents on the guests' page: the report action on a feed post and in the
// story viewer (never on the guest's own uploads), the face-search consent screen's added lines, the AI
// studio's notice above the create button — and nothing of it while the version is not in force.

vi.mock('@/features/live-gallery/client/api', () => ({
  galleryApi: vi.fn(async (path: string) =>
    path === '/api/gallery/ai/state'
      ? {
          status: 200,
          ok: true,
          body: {
            ai: {
              people: [{ id: 'p1', role: 'groom', name: { he: 'איתי', en: 'Itay' } }],
              perGuest: 3,
              left: 3,
              eventFull: false,
              toGallery: true,
              mine: [],
            },
          },
        }
      : { status: 200, ok: true, body: { items: [] } },
  ),
}));

const { FaceSearch } = await import('@/features/faces/ui/FaceSearch');
const { AiPhotoStudio } = await import('@/features/ai-photos/ui/AiPhotoStudio');

class FakePointerEvent extends MouseEvent {
  pointerId = 1;
  pointerType = 'touch';
}
beforeEach(() => {
  window.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let n = 0;
const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: `item-${++n}`,
  kind: 'image',
  thumb: `https://t/${n}.jpg`,
  display: `https://d/${n}.jpg`,
  video: null,
  width: 800,
  height: 600,
  durationMs: null,
  takenAt: null,
  at: '2026-10-03T18:30:00Z',
  name: 'Dana',
  by: 'aaaa',
  ...over,
});

describe('the legal links', () => {
  it('carry the page’s language only for the two the legal pages speak', () => {
    expect(legalPage('/privacy', 'he')).toBe('/privacy?lang=he');
    expect(legalPage('/privacy', 'en')).toBe('/privacy?lang=en');
    expect(legalPage('/privacy', 'ru')).toBe('/privacy');
    expect(reportLink({ gallery: 'g'.repeat(24), item: 'i1' }, 'fr')).toBe(
      `/report?g=${'g'.repeat(24)}&i=i1`,
    );
    expect(reportLink({ album: 'a'.repeat(24) }, 'he')).toBe(`/report?a=${'a'.repeat(24)}&lang=he`);
    expect(privacyRequestLink('en', 'biometric_exclusion')).toBe(
      '/privacy-request?kind=biometric_exclusion&lang=en',
    );
    expect(privacyRequestLink('ar')).toBe('/privacy-request');
  });
});

describe('the report action on a feed post', () => {
  const mountPost = (report?: (i: FeedItem) => string | null, kind: 'image' | 'video' = 'image') => {
    const post = groupPosts([item({ kind, video: kind === 'video' ? 'https://v/1.mp4' : null })])[0]!;
    render(
      <GuestTextProvider locale="en">
        <FeedPost
          post={post}
          author="Dana"
          likes={undefined}
          fresh={false}
          onLike={() => undefined}
          onOpen={() => undefined}
          report={report}
        />
      </GuestTextProvider>,
    );
    return post;
  };

  it('is a link named for what it reports, to the report form for that item, in a new tab', () => {
    const post = mountPost((i) => reportLink({ gallery: 'g'.repeat(24), item: i.id }, 'en'));
    const link = screen.getByRole('link', { name: EN.legal.report.photo });
    expect(link.getAttribute('href')).toBe(`/report?g=${'g'.repeat(24)}&i=${post.items[0]!.id}&lang=en`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('says video for a video', () => {
    mountPost(() => '/report', 'video');
    expect(screen.getByRole('link', { name: EN.legal.report.video })).toBeTruthy();
  });

  it('is not there for the guest’s own upload (null) or while version 2 is not in force (absent)', () => {
    mountPost(() => null);
    expect(screen.queryByRole('link', { name: EN.legal.report.photo })).toBeNull();
    cleanup();
    mountPost(undefined);
    expect(screen.queryByRole('link', { name: EN.legal.report.photo })).toBeNull();
  });
});

describe('the report action in the story viewer', () => {
  const mountViewer = (opts: { report?: (i: FeedItem) => string | null; own?: string[] }) => {
    const feed = [item(), item()];
    const all = groupStories(feed);
    render(
      <GuestTextProvider locale="he">
        <StoryViewer
          stories={all}
          startKey={all[0]!.key}
          nameOf={() => 'Dana'}
          onClose={() => undefined}
          onWatched={() => undefined}
          canDelete={(i) => (opts.own ?? []).includes(i.id)}
          onDelete={() => undefined}
          report={opts.report}
        />
      </GuestTextProvider>,
    );
    return all[0]!.items;
  };

  it('is a link for the item on screen, in the page’s language', () => {
    const items = mountViewer({ report: (i) => `/report?i=${i.id}` });
    const link = screen.getByRole('link', { name: HE.legal.report.photo });
    expect(link.getAttribute('href')).toBe(`/report?i=${items[0]!.id}`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toContain(HE.legal.report.short);
    // the next item has its own
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('link', { name: HE.legal.report.photo }).getAttribute('href')).toBe(
      `/report?i=${items[1]!.id}`,
    );
  });

  it('is not offered on the guest’s own upload, where deleting is; and not at all without version 2', () => {
    const feed = [item()];
    const all = groupStories(feed);
    render(
      <GuestTextProvider locale="he">
        <StoryViewer
          stories={all}
          startKey={all[0]!.key}
          nameOf={() => 'Dana'}
          onClose={() => undefined}
          onWatched={() => undefined}
          canDelete={() => true}
          onDelete={() => undefined}
          report={(i) => (i.id === feed[0]!.id ? null : '/report')}
        />
      </GuestTextProvider>,
    );
    expect(screen.queryByRole('link', { name: HE.legal.report.photo })).toBeNull();
    expect(screen.getByRole('button', { name: HE.mine.delete })).toBeTruthy();
    cleanup();
    mountViewer({});
    expect(screen.queryByRole('link', { name: HE.legal.report.photo })).toBeNull();
  });
});

describe('the face-search consent screen', () => {
  const open = async (legal: boolean) => {
    render(
      <GuestTextProvider locale="en">
        <FaceSearch token={'g'.repeat(24)} code={() => null} until="2026-11-19" legal={legal} />
      </GuestTextProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: EN.faces.start }));
    return screen.findByTestId('face-consent');
  };

  it('with version 2 says whose consent this is, links the exclusion request and the rules, and keeps the checkbox apart and unticked', async () => {
    const consent = await open(true);
    const added = within(consent).getByTestId('face-consent-legal');
    expect(within(added).getByText(EN.legal.faces.mine)).toBeTruthy();
    expect(within(added).getByText(EN.legal.faces.others)).toBeTruthy();
    expect(within(added).getByText(EN.legal.faces.children)).toBeTruthy();
    const exclude = within(added).getByRole('link', { name: EN.legal.faces.exclude });
    expect(exclude.getAttribute('href')).toBe('/privacy-request?kind=biometric_exclusion&lang=en');
    expect(within(added).getByRole('link', { name: EN.legal.faces.rules }).getAttribute('href')).toBe(
      '/gallery-rules?lang=en',
    );
    expect(within(added).getByRole('link', { name: EN.legal.faces.report }).getAttribute('href')).toBe(
      `/report?g=${'g'.repeat(24)}&lang=en`,
    );
    // the consent itself is the same single, separate, unticked box; continue waits for it
    const box = within(consent).getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(added.contains(box)).toBe(false);
    expect((within(consent).getByTestId('face-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(within(consent).getAllByRole('checkbox')).toHaveLength(1);
  });

  it('without it is the consent screen as it was', async () => {
    const consent = await open(false);
    expect(within(consent).queryByTestId('face-consent-legal')).toBeNull();
    expect(within(consent).queryByText(EN.legal.faces.others)).toBeNull();
    expect(consent.querySelector('a[href^="/privacy-request"]')).toBeNull();
  });
});

describe('the AI studio’s notice', () => {
  const mountStudio = async (legal: boolean) => {
    render(
      <GuestTextProvider locale="en">
        <AiPhotoStudio
          token={'g'.repeat(24)}
          code={() => null}
          uploader="testuploader0123456789"
          guest={null}
          name="Dana"
          eventType="wedding"
          legal={legal}
          onShared={() => undefined}
        />
      </GuestTextProvider>,
    );
    fireEvent.click(await screen.findByTestId('ai-photos-open'));
  };

  it('says what is sent to the outside provider, and promises nothing about the provider’s own retention', async () => {
    await mountStudio(true);
    const notice = await screen.findByTestId('ai-legal-notice');
    expect(notice.textContent).toContain('OpenAI');
    for (const line of [AI.notice.send, AI.notice.children, AI.notice.result, AI.notice.retention])
      expect(notice.textContent).toContain(line);
    expect(AI.notice.retention).toMatch(/provider/);
    const link = within(notice).getByRole('link', { name: new RegExp(AI.notice.privacy) });
    expect(link.getAttribute('href')).toBe('/privacy?lang=en');
    expect(link.getAttribute('target')).toBe('_blank');
    // above the create button
    const create = screen.getByTestId('ai-create');
    expect(notice.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is not there without version 2', async () => {
    await mountStudio(false);
    await waitFor(() => expect(screen.getByTestId('ai-create')).toBeTruthy());
    expect(screen.queryByTestId('ai-legal-notice')).toBeNull();
  });
});
