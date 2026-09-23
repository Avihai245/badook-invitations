'use server';

import { cookies } from 'next/headers';
import { isUiLocale, UI_LOCALE_COOKIE } from '@/lib/i18n/app';

/** Host-app UI language (Hebrew by default); the page refreshes itself afterwards. */
export async function setUiLocale(locale: string): Promise<void> {
  if (!isUiLocale(locale)) return;
  (await cookies()).set(UI_LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
}
