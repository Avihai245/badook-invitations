import { notFound } from 'next/navigation';
import type { Locale, Section } from '@/features/invitations/contracts/types';
import { isLocale, loadDevDocument } from '@/features/invitations/dev/load-dev-document';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext, type RenderOptions } from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { buildLivePayload } from '@/features/invitations/renderer/live/build';
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
 *   music=fixture          the synthetic music track
 *   live=0                 the language pill as a plain link (default: switches in place, like /i/…)
 */
export default async function RenderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  assertDevRoutes();
  const [{ template, lang, doc: docKey }, sp] = await Promise.all([params, searchParams]);
  const loaded = loadDevDocument(template, docKey);
  if (!loaded || !isLocale(lang)) notFound();
  const { doc, entry } = loaded;

  const tl = one(sp.tl);
  const sections: Section[] =
    tl && TIMELINE_VARIANTS.includes(tl)
      ? doc.sections.map((s): Section => (s.type === 'timeline' ? { ...s, variant: tl } : s))
      : doc.sections;
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
  const music = one(sp.music) === 'fixture' ? { ...doc.music, enabled: true } : doc.music;

  const env = serverEnv();
  const rendered = { ...doc, sections, music };
  const options: Omit<RenderOptions, 'mode'> = {
    brand: env.INVITES_BRAND_NAME,
    now,
    coverMedia,
    musicUrl: one(sp.music) === 'fixture' ? '/dev/media/music.webm' : undefined,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
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
