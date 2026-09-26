import { notFound } from 'next/navigation';
import {
  DEFAULT_SECTION_ANIMATION,
  ENTER_PRESETS,
  OPENING_PRESETS,
  type EnterPreset,
  type Locale,
  type OpeningPreset,
  type Section,
} from '@/features/invitations/contracts/types';
import { isLocale, loadDevDocument } from '@/features/invitations/dev/load-dev-document';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext, type RenderOptions } from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { buildLivePayload } from '@/features/invitations/renderer/live/build';
import { SEED_COPY } from '@/features/invitations/templates/seed-copy';
import { assertDevRoutes } from '@/lib/dev-routes';
import { serverEnv } from '@/lib/env';

type Params = Promise<{ template: string; lang: string; doc: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TIMELINE_VARIANTS = ['vertical', 'horizontal-icons', 'flip-cards'];

// Rendered per request so the INVITES_DEV_ROUTES gate is read at runtime, never baked in at build.
export const dynamic = 'force-dynamic';

/**
 * Kitchen-sink render of one invitation. Query:
 *   open=1                 skip the cover (like the public page)
 *   mode=preview           editor-preview look (no language pill, no cover)
 *   now=<ISO datetime>     freeze "now" (countdown, RSVP deadline) — used by visual tests
 *   tl=<variant>           force a timeline variant (vertical | horizontal-icons | flip-cards)
 *   cover=fixture          the video-first cover with the synthetic media of tests/fixtures/media
 *                          (cover=stall: a video that never loads → the cover must still open)
 *   music=fixture          the synthetic music track (music=mp3: a 12s MP3 with a new note every
 *                          second; musicStart=<s> its start second, like a host's)
 *   live=0                 the language pill as a plain link (default: switches in place, like /i/…)
 *   gallery=carousel|grid  a gallery of the 5 test photos before the footer
 *   reveal=scratch|tap|spin  the reveal section's mechanic (added before the footer when missing)
 *   followup=1             a published full invitation to link to (a save-the-date's, /i/noa-and-itay)
 *   hero=video|youtube     the hero as an uploaded video (the test clip) or a YouTube link
 *   videoSound=1           the hero video's sound instead of a track (the host's "video sound" option)
 *   opening=gate|curtain|fireworks|gold_dust|envelope   the host's cinematic opening (cover.opening)
 *   cinematic=0            the event without the `cinematic` feature: the plain rendering
 *   motion=<enter preset>  every section comes in with that preset (rise, zoom, tilt…) — the scroll-
 *                          driven entrances on any document
 * Document `cinematic` (every v2 layout and motion) reads its pictures from /dev/media.
 */
export default async function RenderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  assertDevRoutes();
  const [{ template, lang, doc: docKey }, sp] = await Promise.all([params, searchParams]);
  const loaded = loadDevDocument(template, docKey);
  if (!loaded || !isLocale(lang)) notFound();
  const { doc, entry } = loaded;

  const tl = one(sp.tl);
  let sections: Section[] =
    tl && TIMELINE_VARIANTS.includes(tl)
      ? doc.sections.map((s): Section => (s.type === 'timeline' ? { ...s, variant: tl } : s))
      : doc.sections;
  const beforeFooter = (extra: Section) => {
    const at = sections.findIndex((s) => s.type === 'footer');
    sections = at < 0 ? [...sections, extra] : [...sections.slice(0, at), extra, ...sections.slice(at)];
  };
  const gallery = one(sp.gallery);
  if (gallery === 'carousel' || gallery === 'grid') {
    beforeFooter({
      id: 'gallery-dev',
      type: 'gallery',
      enabled: true,
      data: {
        title: { he: 'רגעים', en: 'Moments' },
        layout: gallery,
        images: [1, 2, 3, 4, 5].map((n) => ({
          id: `photo-${n}`,
          src: `upload:gallery-${n}.jpg`,
          alt: { he: `תמונה ${n}`, en: `Photo ${n}` },
        })),
      },
    });
  }
  const mechanic = one(sp.reveal);
  if (mechanic === 'scratch' || mechanic === 'tap' || mechanic === 'spin') {
    if (sections.some((s) => s.type === 'reveal'))
      sections = sections.map((s): Section =>
        s.type === 'reveal'
          ? { ...s, enabled: true, data: { ...s.data, mechanic, prompt: SEED_COPY.revealPrompt[mechanic] } }
          : s,
      );
    else
      beforeFooter({
        id: 'reveal-dev',
        type: 'reveal',
        enabled: true,
        data: {
          title: { he: 'שמרו את התאריך', en: 'Save the Date' },
          mechanic,
          prompt: SEED_COPY.revealPrompt[mechanic],
          showCalendarButton: true,
        },
      });
  }
  const heroParam = one(sp.hero);
  if (heroParam === 'video' || heroParam === 'youtube')
    sections = sections.map((s): Section =>
      s.type === 'hero'
        ? {
            ...s,
            data: {
              ...s.data,
              media:
                heroParam === 'video'
                  ? {
                      kind: 'video',
                      src: 'upload:cover-open.webm',
                      poster: 'upload:cover-poster.png',
                      focalPoint: { x: 0.5, y: 0.5 },
                    }
                  : {
                      kind: 'video',
                      src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                      poster: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                      focalPoint: { x: 0.5, y: 0.5 },
                    },
            },
          }
        : s,
    );
  const motionParam = one(sp.motion);
  if ((ENTER_PRESETS as readonly string[]).includes(motionParam ?? '')) {
    const preset = motionParam as EnterPreset;
    sections = sections.map((s): Section => ({
      ...s,
      animation: { ...DEFAULT_SECTION_ANIMATION, enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset } },
    }));
  }
  const nowParam = one(sp.now);
  const now = nowParam && !Number.isNaN(Date.parse(nowParam)) ? Date.parse(nowParam) : undefined;
  const mode = one(sp.mode) === 'preview' ? 'preview' : 'live';

  const cover = one(sp.cover);
  const coverMedia =
    cover === 'fixture' || cover === 'stall'
      ? {
          poster: '/dev/media/cover-poster.png',
          video: cover === 'stall' ? '/dev/media/never-loads.webm' : '/dev/media/cover-open.webm',
          posterDesktop: null,
          videoDesktop: null,
          overlay: entry.manifest.cover.overlay.image ? '/dev/media/seal-blank.png' : null,
        }
      : undefined;
  const musicParam = one(sp.music);
  const fixtureMusic = musicParam === 'fixture' || musicParam === 'mp3';
  const videoSound = one(sp.videoSound) === '1';
  const music =
    fixtureMusic || videoSound
      ? {
          ...doc.music,
          enabled: true,
          startAtSec: Math.max(0, Number(one(sp.musicStart)) || 0),
          videoSound,
        }
      : doc.music;

  const openingParam = one(sp.opening);
  const opening = (OPENING_PRESETS as readonly string[]).includes(openingParam ?? '')
    ? (openingParam as OpeningPreset)
    : doc.cover.opening;
  const env = serverEnv();
  // another opening than the document's: its own call to action, not the template's seeded one
  const hint = opening && opening !== 'envelope' && opening !== doc.cover.opening ? null : doc.cover.hint;
  const rendered = { ...doc, sections, music, cover: { ...doc.cover, opening, hint } };
  const options: Omit<RenderOptions, 'mode'> = {
    brand: env.INVITES_BRAND_NAME,
    cinematic: one(sp.cinematic) !== '0',
    now,
    coverMedia,
    musicUrl: fixtureMusic ? `/dev/media/music.${musicParam === 'mp3' ? 'mp3' : 'webm'}` : undefined,
    followUp: one(sp.followup) === '1' ? { slug: 'noa-and-itay', locales: ['he', 'en'] } : null,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    bases: {
      ...assetBasesFromEnv({
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
        templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
      }),
      // the test photos and clip are "uploads" served by /dev/media
      ...(gallery || heroParam === 'video' || docKey === 'cinematic' ? { uploads: '/dev/media' } : {}),
    },
  };
  const ctx = buildRenderContext(rendered, entry.manifest, lang, { ...options, mode });

  const next = doc.locales[(doc.locales.indexOf(lang) + 1) % doc.locales.length] as Locale;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  ).toString();
  const path = (l: Locale) => `/dev/invitations/render/${template}/${l}/${docKey}`;
  const href = (l: Locale) => `${path(l)}${query ? `?${query}` : ''}`;
  const live =
    mode === 'live' && one(sp.live) !== '0'
      ? buildLivePayload(rendered, entry.manifest, options, (l) => ({ url: path(l), href: href(l) }))
      : null;

  return (
    <InvitationBody ctx={ctx} showCover={one(sp.open) !== '1'} langSwitchHref={href(next)} live={live} />
  );
}
