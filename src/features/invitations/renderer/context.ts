import type { InvitationDocument, Locale, TemplateManifest } from '../contracts/types';
import { formatHebrewDate, showsHebrewDate } from '../lib/hebrew-date';
import { createRenderContext, type RenderContext, type RenderOptions } from './context-core';

export type { RenderContext, RenderMode, RenderOptions } from './context-core';

/**
 * The Hebrew date line for `locale` — null when the host turned it off, or off for this language
 * (`event.hebrewDateLocales`: Hebrew and English unless the host chose otherwise).
 */
export function hebrewDateFor(doc: Pick<InvitationDocument, 'event'>, locale: Locale): string | null {
  const mode = doc.event.hebrewDate;
  return mode !== 'off' && showsHebrewDate(doc.event, locale)
    ? formatHebrewDate(doc.event.date, mode, locale)
    : null;
}

/** The render context, Hebrew date included (see `createRenderContext`). */
export function buildRenderContext(
  doc: InvitationDocument,
  template: TemplateManifest,
  locale: Locale,
  options: RenderOptions,
): RenderContext {
  return createRenderContext(doc, template, locale, { ...options, hebrewDate: hebrewDateFor(doc, locale) });
}
