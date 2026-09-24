import 'server-only';
import { planPrices } from '@/features/billing/server/account';
import { serverEnv } from '@/lib/env';
import type { UiLocale } from '@/lib/i18n/app';
import type { LegalContext } from './types';

/** When the policies were last revised (update with any change to their text). */
export const LEGAL_UPDATED = '2026-09-24';

/** The operator's details for the policies, from the deployment's settings. */
export function legalContext(locale: UiLocale): LegalContext {
  const env = serverEnv();
  const prices = planPrices();
  return {
    locale,
    brand: env.INVITES_BRAND_NAME,
    site: env.INVITES_PUBLIC_BASE_URL,
    operator: {
      name: env.INVITES_LEGAL_NAME.trim(),
      id: env.INVITES_LEGAL_ID.trim(),
      address: env.INVITES_LEGAL_ADDRESS.trim(),
      phone: env.INVITES_LEGAL_PHONE.trim(),
      email: env.INVITES_SUPPORT_EMAIL.trim(),
    },
    a11y: {
      name: env.INVITES_ACCESSIBILITY_COORDINATOR.trim(),
      phone: env.INVITES_ACCESSIBILITY_PHONE.trim(),
      email: env.INVITES_ACCESSIBILITY_EMAIL.trim(),
    },
    prices: { pro: prices.pro, business: prices.business },
    updated: new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${LEGAL_UPDATED}T00:00:00Z`)),
  };
}
