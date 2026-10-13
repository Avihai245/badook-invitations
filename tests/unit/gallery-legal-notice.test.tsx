// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestPageData } from '@/features/live-gallery/server/pages';
import { galleryGuestEn as EN } from '@/lib/i18n/gallery-guest.en';

// The guests' page with version 2 of the legal documents in force: the notice before a device's first
// upload (once, remembered on the phone, working without storage), its acknowledgement sent to the
// server without the upload waiting for it, the face-search line only where face search is on, the
// legal links — and, with `legal: null`, the page exactly as it was.

const TOKEN = 'tok_ABCDEFGHIJKLMNOPQRST'.slice(0, 24);
const UPLOADER = 'testuploader0123456789';

const api = vi.hoisted(() => ({ calls: [] as { path: string; body: Record<string, unknown> }[], ack: 200 }));
vi.mock('@/features/live-gallery/client/api', () => ({
  galleryApi: vi.fn(async (path: string, body: Record<string, unknown>) => {
    api.calls.push({ path, body });
    if (path === '/api/gallery/acknowledge') return { status: api.ack, ok: api.ack === 200, body: null };
    return {
      status: 200,
      ok: true,
      body: {
        ok: true,
        state: 'open',
        mode: 'instant',
        opensAt: null,
        items: [],
        next: null,
        now: '2026-10-13T10:00:00.000Z',
        expiresAt: 0,
        mine: [],
        realtime: null,
      },
    };
  }),
}));
vi.mock('@/features/live-gallery/client/idb', () => ({
  openStore: async () => ({
    persistent: false,
    getMeta: async () => null,
    setMeta: async () => undefined,
  }),
}));
vi.mock('@/features/live-gallery/client/uploader', () => ({
  randomToken: () => UPLOADER,
  Uploader: class {
    opts: { onChange(s: unknown): void };
    constructor(opts: { onChange(s: unknown): void }) {
      this.opts = opts;
    }
    snapshot() {
      return { items: [], preparing: 0, blocked: null, online: true, passive: false, persistent: false };
    }
    async start() {
      this.opts.onChange(this.snapshot());
    }
    stop() {}
    unblock() {}
    retryAll() {}
    async remove() {}
    async add() {
      return { added: 0, errors: [] };
    }
    async thumbnail() {
      return null;
    }
  },
}));
vi.mock('@/features/faces/client/upload-indexer', () => ({
  UploadFaceIndexer: class {
    add() {}
    stop() {}
  },
}));
vi.mock('@/lib/live/client', () => ({ useLiveRefresh: () => 'polling' }));
vi.mock('@/features/site/AccessibilityMenu.client', () => ({ AccessibilityPanel: () => null }));
vi.mock('@/features/faces/ui/FaceSearch', () => ({ FaceSearch: () => null }));
vi.mock('@/features/ai-photos/ui/AiPhotoStudio', () => ({ AiPhotoStudio: () => null }));

const { GuestGallery } = await import('@/features/live-gallery/ui/guest/GuestGallery');

function pageData(over: Partial<GuestPageData> = {}): GuestPageData {
  return {
    slug: 'noa-itay',
    event: {
      title: 'Noa & Itay',
      titles: { en: 'Noa & Itay' },
      eventType: 'wedding',
      date: '2026-10-20',
      locales: ['en'],
      defaultLocale: 'en',
      accent: '#1C1917',
      accentInk: '#FFFFFF',
    },
    state: 'open',
    mode: 'instant',
    opensAt: null,
    closesAt: null,
    needsCode: false,
    initial: null,
    brand: 'Badook',
    limits: { imageBytes: 1, videoBytes: 1, videoMinutes: 1 },
    faces: null,
    aiPhotos: false,
    legal: { active: true, rulesVersion: '2' },
    ...over,
  } as GuestPageData;
}

let picker: ReturnType<typeof vi.fn>;
beforeEach(() => {
  api.calls = [];
  api.ack = 200;
  picker = vi.fn();
  HTMLInputElement.prototype.click = picker as unknown as () => void;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  // the name was asked on an earlier visit: the notice is the only step in the way of the picker
  localStorage.setItem('badook-gallery:asked', '1');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function mount(data: GuestPageData = pageData()) {
  render(<GuestGallery data={data} token={TOKEN} guest={null} lang="en" />);
  const button = await screen.findByTestId('gallery-share');
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  return button;
}
const acks = () => api.calls.filter((c) => c.path === '/api/gallery/acknowledge');
const ackKey = `badook-gallery:ack:2:${TOKEN}`;

describe('the first-upload notice', () => {
  it('is a labelled modal dialog on the first share, and the picker waits', async () => {
    const share = await mount();
    share.focus();
    fireEvent.click(share);
    const dialog = await screen.findByRole('dialog', { name: EN.legal.notice.title });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(picker).not.toHaveBeenCalled();
    // the five points (four without face search) and the two links, which open in a new tab
    const points = within(dialog)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('data-point'));
    expect(points).toEqual(['seen', 'own', 'location', 'copies']);
    expect(within(dialog).getByText(EN.legal.notice.seen)).toBeTruthy();
    const rules = within(dialog).getByRole('link', { name: new RegExp(EN.legal.notice.rules) });
    const privacy = within(dialog).getByRole('link', { name: new RegExp(EN.legal.notice.privacy) });
    for (const a of [rules, privacy]) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    expect(rules.getAttribute('href')).toBe('/gallery-rules?lang=en');
    expect(privacy.getAttribute('href')).toBe('/privacy?lang=en');
    // it says what the acknowledgement is not
    expect(within(dialog).getByText(EN.legal.notice.ackOnly)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: EN.legal.notice.understand })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: EN.legal.notice.cancel })).toBeTruthy();
    // focus moved in
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('"I understand" continues to the picker, is remembered, is sent to the server, and is not shown again', async () => {
    const share = await mount();
    fireEvent.click(share);
    fireEvent.click(await screen.findByRole('button', { name: EN.legal.notice.understand }));
    expect(picker).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(ackKey)).toBe('1');
    await waitFor(() => expect(acks()).toHaveLength(1));
    // the same device id the other calls send, the gallery link, the rules version — and nothing else
    expect(acks()[0]!.body).toEqual({ t: TOKEN, uploader: UPLOADER, version: '2' });
    // the next share goes straight to the picker, with no second request
    fireEvent.click(screen.getByTestId('share-story'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picker).toHaveBeenCalledTimes(2);
    expect(acks()).toHaveLength(1);
  });

  it('is not shown on a device that acknowledged this version before', async () => {
    localStorage.setItem(ackKey, '1');
    const share = await mount();
    fireEvent.click(share);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(acks()).toHaveLength(0);
  });

  it('is shown again for another rules version or another gallery', async () => {
    localStorage.setItem(`badook-gallery:ack:1:${TOKEN}`, '1');
    localStorage.setItem('badook-gallery:ack:2:someotherlinktoken00000', '1');
    const share = await mount();
    fireEvent.click(share);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('Cancel, Escape and a tap outside do nothing: no picker, no request, nothing stored, focus back', async () => {
    const share = await mount();
    share.focus();
    fireEvent.click(share);
    fireEvent.click(await screen.findByRole('button', { name: EN.legal.notice.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(picker).not.toHaveBeenCalled();
    expect(acks()).toHaveLength(0);
    expect(localStorage.getItem(ackKey)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(share));
    // it comes back on the next share
    fireEvent.click(share);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(picker).not.toHaveBeenCalled();
    expect(acks()).toHaveLength(0);
    expect(localStorage.getItem(ackKey)).toBeNull();
  });

  it('works without storage: the upload goes on (after the name sheet storage-less phones always get), and the notice is not repeated in the same visit', async () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', broken);
    const share = await mount();
    fireEvent.click(share);
    fireEvent.click(await screen.findByRole('button', { name: EN.legal.notice.understand }));
    await waitFor(() => expect(acks()).toHaveLength(1));
    // without storage the page never knows the name was asked: its sheet comes next, as it always did
    fireEvent.click(await screen.findByTestId('name-continue'));
    expect(picker).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('name-sheet')).toBeNull());
    fireEvent.click(share);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picker).toHaveBeenCalledTimes(2);
  });

  it('the upload goes on when the acknowledgement fails (offline, 404, 429)', async () => {
    for (const status of [0, 404, 429]) {
      cleanup();
      localStorage.clear();
      localStorage.setItem('badook-gallery:asked', '1');
      picker.mockClear();
      api.ack = status;
      const share = await mount();
      fireEvent.click(share);
      fireEvent.click(await screen.findByRole('button', { name: EN.legal.notice.understand }));
      expect(picker).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(acks().length).toBeGreaterThan(0));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('goes on to the name sheet first-time guests get, then the picker', async () => {
    localStorage.removeItem('badook-gallery:asked');
    const share = await mount();
    fireEvent.click(share);
    fireEvent.click(await screen.findByRole('button', { name: EN.legal.notice.understand }));
    expect(picker).not.toHaveBeenCalled();
    expect(await screen.findByTestId('name-sheet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('name-continue'));
    expect(picker).toHaveBeenCalledTimes(1);
  });

  it('the face-search line is there only where face search is on', async () => {
    const off = await mount(pageData({ faces: null }));
    fireEvent.click(off);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(EN.legal.notice.faces)).toBeNull();
    cleanup();
    const on = await mount(pageData({ faces: { until: '2026-11-19' } }));
    fireEvent.click(on);
    const withFaces = await screen.findByRole('dialog');
    expect(within(withFaces).getByText(EN.legal.notice.faces)).toBeTruthy();
    expect(
      within(withFaces)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('data-point')),
    ).toEqual(['seen', 'own', 'location', 'copies', 'faces']);
  });

  it('keeps the page’s footer line and adds the rules, report and privacy-request links', async () => {
    await mount();
    const footer = document.querySelector('footer')!;
    expect(within(footer).getByText(EN.footer.consent)).toBeTruthy();
    const rules = within(footer).getByRole('link', { name: EN.legal.footer.rules });
    const report = within(footer).getByRole('link', { name: EN.legal.footer.report });
    const request = within(footer).getByRole('link', { name: EN.legal.footer.privacyRequest });
    expect(rules.getAttribute('href')).toBe('/gallery-rules?lang=en');
    expect(report.getAttribute('href')).toBe(`/report?g=${TOKEN}&lang=en`);
    expect(request.getAttribute('href')).toBe('/privacy-request?lang=en');
    for (const a of [rules, report, request]) expect(a.getAttribute('rel')).toContain('noopener');
  });
});

describe('with version 2 not in force (legal: null)', () => {
  it('is the page as it was: no notice, no request, no new links', async () => {
    const share = await mount(pageData({ legal: null }));
    fireEvent.click(share);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picker).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(acks()).toHaveLength(0);
    expect(localStorage.getItem(ackKey)).toBeNull();
    const footer = document.querySelector('footer')!;
    expect(within(footer).getByText(EN.footer.consent)).toBeTruthy();
    for (const href of ['/gallery-rules', '/report', '/privacy-request'])
      expect(footer.querySelector(`a[href^="${href}"]`)).toBeNull();
    expect(screen.queryByTestId('gallery-report-content')).toBeNull();
  });

  it('treats { active: false } the same', async () => {
    const share = await mount(pageData({ legal: { active: false, rulesVersion: '2' } }));
    fireEvent.click(share);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picker).toHaveBeenCalledTimes(1);
  });
});
