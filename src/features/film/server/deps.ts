import 'server-only';
import { featureInput } from '@/features/flags/server';
import { fontFaceCss } from '@/features/invitations/fonts';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { musicUrl } from '@/features/invitations/renderer/cover/media';
import { resolveFontPair, resolvePalette } from '@/features/invitations/renderer/theme';
import { getTemplate } from '@/features/invitations/templates/registry';
import { hostDb } from '@/features/invitations/server/host-db';
import { galleryDb } from '@/features/live-gallery/server/db';
import { broadcastRefresh } from '@/features/live-gallery/server/realtime';
import { galleryStorage } from '@/features/live-gallery/server/storage';
import { serverEnv } from '@/lib/env';
import type { FilmDeps, FilmFonts, FilmInvitation } from './api';

/** The real dependencies of the film's API (tests pass their own). */

async function invitation(id: string, userId: string): Promise<FilmInvitation | null> {
  const inv = await hostDb.get(id, userId);
  if (!inv) return null;
  // the film shows the invitation as guests see it (the draft before it is published)
  const doc = inv.published ?? inv.draft;
  const template = getTemplate(doc.templateId)?.manifest;
  if (!template) return null;
  const pair = resolveFontPair(template, doc);
  const env = serverEnv();
  const bases = assetBasesFromEnv({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
  });
  const fonts: FilmFonts = {
    display: { he: pair.display.hebrew, en: pair.display.latin },
    heading: { he: pair.heading.hebrew, en: pair.heading.latin },
  };
  return {
    slug: inv.slug,
    doc,
    palette: resolvePalette(template, doc),
    fonts,
    musicUrl: musicUrl(doc, template, bases),
  };
}

export function filmDeps(): FilmDeps {
  return {
    db: galleryDb,
    storage: galleryStorage,
    featureInput,
    invitation,
    broadcast: broadcastRefresh,
    now: () => Date.now(),
  };
}

/** @font-face rules for the film's cards: the invitation's display and heading faces. */
export function filmFontCss(fonts: FilmFonts): string {
  return fontFaceCss(
    new Set([fonts.display.he, fonts.display.en, fonts.heading.he, fonts.heading.en]),
    [400, 700],
  );
}
