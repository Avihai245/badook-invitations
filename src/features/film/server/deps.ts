import 'server-only';
import { featureInput } from '@/features/flags/server';
import type { InvitationDocument, Locale, TemplateManifest } from '@/features/invitations/contracts/types';
import { fontFaceCss, fontStack, pageFontFaces } from '@/features/invitations/fonts';
import { scriptsOf } from '@/features/invitations/lib/locales';
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

/**
 * The cards' fonts for each of the invitation's languages — its design's faces as its own pages set
 * that language: the script's face first (the pair's Hebrew or Latin one, a Cyrillic stand-in, the
 * Arabic or Ethiopic face of the design's style), then the other languages' — and the faces to declare.
 */
export function filmFonts(
  template: TemplateManifest,
  doc: Pick<InvitationDocument, 'locales' | 'theme'>,
): FilmFonts {
  const pair = resolveFontPair(template, doc);
  const display: Partial<Record<Locale, string>> = {};
  const heading: Partial<Record<Locale, string>> = {};
  for (const l of doc.locales) {
    const scripts = scriptsOf([l, ...doc.locales]);
    display[l] = fontStack(pair, 'display', l, scripts);
    heading[l] = fontStack(pair, 'heading', l, scripts);
  }
  // the faces of those stacks, declared as the invitation's page declares them for its languages
  const used = new Set(
    [...Object.values(display), ...Object.values(heading)].flatMap((stack) =>
      [...(stack ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]!),
    ),
  );
  return {
    display,
    heading,
    faces: pageFontFaces(template, pair.id, doc.locales).filter((f) => used.has(f.family)),
  };
}

async function invitation(id: string, userId: string): Promise<FilmInvitation | null> {
  const inv = await hostDb.get(id, userId);
  if (!inv) return null;
  // the film shows the invitation as guests see it (the draft before it is published)
  const doc = inv.published ?? inv.draft;
  const template = getTemplate(doc.templateId)?.manifest;
  if (!template) return null;
  const env = serverEnv();
  const bases = assetBasesFromEnv({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
  });
  return {
    slug: inv.slug,
    doc,
    palette: resolvePalette(template, doc),
    fonts: filmFonts(template, doc),
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

/** @font-face rules for the film's cards: the invitation's display and heading faces, every script. */
export function filmFontCss(fonts: FilmFonts): string {
  return fontFaceCss(fonts.faces, [400, 700]);
}
