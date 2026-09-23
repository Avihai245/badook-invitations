import 'server-only';
import { cookies } from 'next/headers';
import { dictFor, isUiLocale, UI_LOCALE_COOKIE, type AppDict, type UiLocale } from './app';

/** The host-app UI language: the `ui_lang` cookie, Hebrew by default. */
export async function getUiLocale(): Promise<UiLocale> {
  const value = (await cookies()).get(UI_LOCALE_COOKIE)?.value;
  return isUiLocale(value) ? value : 'he';
}

export async function getUi(): Promise<{ locale: UiLocale; t: AppDict }> {
  const locale = await getUiLocale();
  return { locale, t: dictFor(locale) };
}
