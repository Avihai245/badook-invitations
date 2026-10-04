'use client';

import { useTransition } from 'react';
import { Segmented } from '@/components/app';
import type { UiLocale } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { setUiLocale } from './ui-locale';

/** עב | EN — switches the host-app UI language (not an invitation's languages). */
export function UiLanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useUi();
  const [pending, start] = useTransition();
  return (
    <Segmented<UiLocale>
      className={className}
      label={t.shell.uiLanguage}
      value={locale}
      disabled={pending}
      options={[
        { value: 'he', label: 'עב', ariaLabel: t.common.hebrew },
        { value: 'en', label: 'EN', ariaLabel: t.common.english },
      ]}
      onValueChange={(value) =>
        start(async () => {
          await setUiLocale(value);
          // a full load: the other language's dictionary is its own chunk (lib/i18n/provider-lazy),
          // and the page turns around (rtl ↔ ltr) — a soft refresh would blank it while that loads
          window.location.reload();
        })
      }
    />
  );
}
