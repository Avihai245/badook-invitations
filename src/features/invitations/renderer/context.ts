import type { InvitationDocument, Locale, TemplateManifest } from '../contracts/types';
import { formatHebrewDate } from '../lib/hebrew-date';
import { createRenderContext, type RenderContext, type RenderOptions } from './context-core';

export type { RenderContext, RenderMode, RenderOptions } from './context-core';

/** The Hebrew date line for `locale` (null when the host turned it off). */
export function hebrewDateFor(doc: Pick<InvitationDocument, 'event'>, locale: Locale): string | null {
  return doc.event.hebrewDate === 'off'
    ? null
    : formatHebrewDate(doc.event.date, doc.event.hebrewDate, locale);
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
