import type { InvitationDocument, Locale, TemplateManifest } from '../../contracts/types';
import { pageTitle } from '../calendar-event';
import { buildRenderContext, type RenderOptions } from '../context';
import { themedDoc, themeVars } from '../theme';
import type { LivePayload } from './payload';

/**
 * The live language switch's payload (null for a single-locale invitation). `links(locale)` gives the
 * address of the page in that locale and the pill's plain link to it.
 */
export function buildLivePayload(
  doc: InvitationDocument,
  template: TemplateManifest,
  options: Omit<RenderOptions, 'mode'>,
  links: (locale: Locale) => { url: string; href: string },
): LivePayload | null {
  if (doc.locales.length < 2) return null;
  const locales: LivePayload['locales'] = {};
  for (const locale of doc.locales) {
    const ctx = buildRenderContext(doc, template, locale, { ...options, mode: 'live' });
    locales[locale] = {
      hebrewDate: ctx.hebrewDate,
      vars: themeVars(template, themedDoc(doc, options.cinematic ?? true), locale),
      title: pageTitle(ctx),
      ...links(locale),
      labels: { switch: ctx.t('locale.switch'), play: ctx.t('music.play'), pause: ctx.t('music.pause') },
    };
  }
  return { doc, template, options, locales };
}
