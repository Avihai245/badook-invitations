'use client';

import { useMemo } from 'react';
import type { Locale } from '../../contracts/types';
import { createRenderContext } from '../context-core';
import { InvitationSections } from '../InvitationSections';
import type { LiveBody } from './payload';

/**
 * The sections in another locale, rendered in the browser (loaded on demand by LiveLocale). Never
 * hydrated — the server always renders the page's own locale — so browser date formatting is safe.
 * `hebrewDate`: the Hebrew date line, formatted on the server (hebcal stays out of the browser).
 */
export function LiveSections({
  body,
  locale,
  hebrewDate,
}: {
  body: LiveBody;
  locale: Locale;
  hebrewDate: string | null;
}) {
  const ctx = useMemo(
    () =>
      createRenderContext(body.doc, body.template, locale, {
        ...body.options,
        mode: 'live',
        hebrewDate,
      }),
    [body, locale, hebrewDate],
  );
  return <InvitationSections ctx={ctx} />;
}
