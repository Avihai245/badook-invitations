import 'server-only';
import { planPrices } from '@/features/billing/server/account';
import { deploymentFeatures } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import type { UiLocale } from '@/lib/i18n/app';
import { legalReadiness, type LegalReadiness } from './readiness';
import type { LegalContext } from './types';

/** The date version 1 took effect — the text that was live before version 2 (registry.ts). */
export const LEGAL_V1_EFFECTIVE = '2026-10-10';

/** Whether version 2 of the legal documents is in force on this deployment (see readiness.ts). */
export function legalStatus(): LegalReadiness {
  return legalReadiness(serverEnv());
}

function formatDate(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** The date a version took effect (ISO): version 1's own, version 2's from the deployment. */
export function effectiveOf(version: string): string {
  return version === '1' ? LEGAL_V1_EFFECTIVE : (legalStatus().effective ?? LEGAL_V1_EFFECTIVE);
}

/**
 * The operator's details for the policies, from the deployment's settings. `version` selects the
 * version being rendered (its own effective date is shown); the default is the one in force.
 */
export function legalContext(locale: UiLocale, version?: string): LegalContext {
  const env = serverEnv();
  const prices = planPrices();
  const status = legalStatus();
  const v = version ?? (status.active ? '2' : '1');
  const iso = effectiveOf(v);
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
      manualReview: env.INVITES_ACCESSIBILITY_REVIEW_DATE
        ? formatDate(env.INVITES_ACCESSIBILITY_REVIEW_DATE, locale)
        : '',
    },
    privacyEmail: env.INVITES_PRIVACY_EMAIL.trim() || env.INVITES_SUPPORT_EMAIL.trim(),
    prices: { pro: prices.pro, business: prices.business },
    updated: formatDate(iso, locale),
    version: v,
    faceSearch: deploymentFeatures(env).has('face_albums'),
  };
}
