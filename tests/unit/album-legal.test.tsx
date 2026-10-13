// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumView } from '@/features/album/ui/AlbumView';
import type { AlbumPageData, AlbumPhoto } from '@/features/album/types';
import { albumGuestEn as EN } from '@/lib/i18n/album-guest.en';

// The album with version 2 of the legal documents in force: a "Report" link on the photo in the viewer
// (to the report form with the album link and the item), and the legal links below. Without it: as it was.

const TOKEN = 'a'.repeat(24);
const photo = (id: string): AlbumPhoto => ({
  id,
  kind: 'image',
  thumb: `https://t/${id}.jpg`,
  display: `https://d/${id}.jpg`,
  video: null,
  width: 800,
  height: 600,
  durationMs: null,
  at: '2026-10-03T18:30:00Z',
  name: 'Dana',
});
const data = (): AlbumPageData => ({
  slug: 'noa-itay',
  state: 'open',
  opensAt: null,
  event: {
    eventType: 'wedding',
    date: '2026-10-03',
    timezone: 'Asia/Jerusalem',
    locales: ['en'],
    defaultLocale: 'en',
    names: { en: 'Noa & Itay' },
    phrase: { en: 'at our wedding' },
    palette: {
      bg: '#ffffff',
      surface: '#ffffff',
      ink: '#111111',
      inkMuted: '#555555',
      accent: '#aa3355',
      accentInk: '#ffffff',
      line: '#dddddd',
    },
    fonts: { display: {}, heading: {} },
  },
  title: {},
  message: {},
  items: [photo('item-1'), photo('item-2')],
  layout: {
    cover: null,
    highlights: [],
    chapters: [
      {
        key: 'c1',
        label: null,
        auto: 'heart',
        icon: null,
        time: null,
        start: null,
        ids: ['item-1', 'item-2'],
      },
    ],
  },
  expiresAt: 0,
  brand: 'Badook',
});

beforeEach(() => {
  // the rows are laid out for the width of their box, which jsdom does not have
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal(
    'Image',
    class {
      src = '';
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openFirst = () => fireEvent.click(screen.getAllByRole('button', { name: /^Open photo/ })[0]!);

describe('the album with version 2', () => {
  it('has a report link on the photo in the viewer, to the form with the album link and the item', () => {
    render(<AlbumView data={data()} token={TOKEN} lang={null} legal />);
    openFirst();
    const viewer = screen.getByRole('dialog');
    const link = within(viewer).getByRole('link', { name: EN.legal.photo });
    expect(link.getAttribute('href')).toBe(`/report?a=${TOKEN}&i=item-1&lang=en`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toContain(EN.legal.short);
  });

  it('links the rules, the report form, the privacy policy and the privacy request below', () => {
    render(<AlbumView data={data()} token={TOKEN} lang={null} legal />);
    const links = screen.getByTestId('album-legal');
    expect(within(links).getByRole('link', { name: EN.legal.rules }).getAttribute('href')).toBe(
      '/gallery-rules?lang=en',
    );
    expect(within(links).getByRole('link', { name: EN.legal.report }).getAttribute('href')).toBe(
      `/report?a=${TOKEN}&lang=en`,
    );
    expect(within(links).getByRole('link', { name: EN.legal.privacy }).getAttribute('href')).toBe(
      '/privacy?lang=en',
    );
    expect(within(links).getByRole('link', { name: EN.legal.privacyRequest }).getAttribute('href')).toBe(
      '/privacy-request?lang=en',
    );
  });

  it('is the album as it was without it: no report link, no legal links', () => {
    render(<AlbumView data={data()} token={TOKEN} lang={null} />);
    openFirst();
    expect(screen.queryByRole('link', { name: EN.legal.photo })).toBeNull();
    expect(screen.queryByTestId('album-legal')).toBeNull();
    expect(document.querySelector('a[href^="/report"], a[href^="/gallery-rules"]')).toBeNull();
  });
});
