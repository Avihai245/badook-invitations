'use client';

import { useMemo } from 'react';
import type { Locale } from '../../contracts/types';
import { createRenderContext } from '../context-core';
import { InvitationSections } from '../InvitationSections';
import type { LivePayload } from './payload';

/**
 * The sections in another locale, rendered in the browser (loaded on demand by LiveLocale). Never
 * hydrated — the server always renders the page's own locale — so browser date formatting is safe.
 */
export function LiveSections({ payload, locale }: { payload: LivePayload; locale: Locale }) {
  const ctx = useMemo(
    () =>
      createRenderContext(payload.doc, payload.template, locale, {
        ...payload.options,
        mode: 'live',
        hebrewDate: payload.locales[locale]?.hebrewDate ?? null,
      }),
    [payload, locale],
  );
  return <InvitationSections ctx={ctx} />;
}
