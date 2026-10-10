import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import {
  autoShareDescription,
  calendarTitle,
  firstVenue,
  pageDescription,
  pageTitle,
} from '@/features/invitations/renderer/calendar-event';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';

/**
 * The link preview's texts when the host wrote none (the editor's share fields show them, filled in):
 * the names for the title; the date, the Hebrew date and the place for the description.
 */

vi.mock('server-only', () => ({}));
const { invitationOgImage } = await import('@/features/invitations/server/og-image');

const OPTIONS = {
  brand: 'Badook',
  publicBaseUrl: 'https://invites.test',
  bases: assetBasesFromEnv({ supabaseUrl: 'https://db.test' }),
};
const doc = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
const ctxOf = (d: InvitationDocument, locale: Locale) =>
  buildRenderContext(d, requireTemplate(d.templateId).manifest, locale, OPTIONS);

describe('the share card filled in from the invitation', () => {
  it('title: the names; description: the date, the Hebrew date and the place', () => {
    for (const locale of ['he', 'en'] as const) {
      const d = doc();
      d.share.ogTitle = null;
      d.share.ogDescription = null;
      const ctx = ctxOf(d, locale);
      expect(pageTitle(ctx)).toBe(calendarTitle(ctx));
      const description = pageDescription(ctx);
      expect(description).toBe(autoShareDescription(ctx));
      expect(description.startsWith(ctx.eventDateLong)).toBe(true);
      if (ctx.hebrewDate) expect(description).toContain(ctx.hebrewDate);
      const venue = firstVenue(ctx);
      if (venue) expect(description).toContain(ctx.text(venue.name));
      expect(description).not.toMatch(/ · $|^ · | ·  · /);
    }
  });

  it('the host’s own texts win, per language', () => {
    const d = doc();
    d.share.ogTitle = { he: 'בואו לחגוג איתנו' };
    d.share.ogDescription = { he: 'ערב של אהבה' };
    expect(pageTitle(ctxOf(d, 'he'))).toBe('בואו לחגוג איתנו');
    expect(pageDescription(ctxOf(d, 'he'))).toBe('ערב של אהבה');
    // English has none of its own: the automatic texts, not the Hebrew ones
    const en = ctxOf(d, 'en');
    expect(pageTitle(en)).toBe(calendarTitle(en));
    expect(pageDescription(en)).toBe(autoShareDescription(en));
  });

  it('without a place the description is the dates alone', () => {
    const d = doc();
    d.sections = d.sections.map((s) =>
      s.type === 'venues' || s.type === 'where' ? { ...s, enabled: false } : s,
    );
    const ctx = ctxOf(d, 'he');
    expect(autoShareDescription(ctx)).toBe([ctx.eventDateLong, ctx.hebrewDate].filter(Boolean).join(' · '));
  });
});

describe('the share image', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** a solid picture served as WebP — how every photo the host uploads is stored */
  async function serve(color: { r: number; g: number; b: number }) {
    const webp = await sharp({ create: { width: 800, height: 600, channels: 3, background: color } })
      .webp()
      .toBuffer();
    const fetch = vi.fn(async () => new Response(webp, { headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }
  /** the card's pixels: (x, y) → [r, g, b] */
  async function pixels(res: Response) {
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1200, 630]);
    return (x: number, y: number) => {
      const i = (y * info.width + x) * 3;
      return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
    };
  }
  const withHeroPhoto = () => {
    const d = doc();
    d.share.ogImage = null;
    d.sections = d.sections.map((s) =>
      s.type === 'hero'
        ? { ...s, data: { ...s.data, media: { kind: 'image', src: 'upload:u/i/photo.webp', poster: null } } }
        : s,
    ) as InvitationDocument['sections'];
    return d;
  };

  it('draws the hero photo even when it is WebP', async () => {
    const fetch = await serve({ r: 0, g: 160, b: 0 });
    const res = await invitationOgImage(ctxOf(withHeroPhoto(), 'he'));
    expect(fetch).toHaveBeenCalledWith(
      'https://db.test/storage/v1/object/public/invitation-media/u/i/photo.webp',
      expect.anything(),
    );
    // a corner, away from the names: the green photo under the overlay
    const [r, g, b] = (await pixels(res))(20, 20);
    expect(g).toBeGreaterThan(r + 40);
    expect(g).toBeGreaterThan(b + 40);
  });

  it('the host’s own share image fills the card, without text over it', async () => {
    await serve({ r: 200, g: 0, b: 0 });
    const d = withHeroPhoto();
    d.share.ogImage = 'upload:u/i/own.webp';
    const at = await pixels(await invitationOgImage(ctxOf(d, 'he')));
    for (const [x, y] of [
      [20, 20],
      [600, 315],
      [1180, 610],
    ] as const) {
      const [r, g, b] = at(x, y);
      expect(r).toBeGreaterThan(150);
      expect(g + b).toBeLessThan(80);
    }
  });

  it('falls back to the generated card when the host’s image can’t be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 })),
    );
    const d = doc();
    d.share.ogImage = 'upload:u/i/missing.webp';
    const res = await invitationOgImage(ctxOf(d, 'he'));
    expect(res.headers.get('content-type')).toBe('image/png');
    await pixels(res);
  });
});
