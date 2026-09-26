import { reviewGuestAm } from '@/lib/i18n/review-guest.am';
import { reviewGuestAr } from '@/lib/i18n/review-guest.ar';
import { reviewGuestEn } from '@/lib/i18n/review-guest.en';
import { reviewGuestEs } from '@/lib/i18n/review-guest.es';
import { reviewGuestFr } from '@/lib/i18n/review-guest.fr';
import { reviewGuestHe, type ReviewGuestDict } from '@/lib/i18n/review-guest.he';
import { reviewGuestRu } from '@/lib/i18n/review-guest.ru';

/**
 * The review page's words, in each language an invitation can be in (the draft's language on the
 * page; the gone page's from the address). A language without a dictionary falls back to English.
 */
export const REVIEW_TEXT: Readonly<Record<string, ReviewGuestDict>> = {
  he: reviewGuestHe,
  en: reviewGuestEn,
  ru: reviewGuestRu,
  ar: reviewGuestAr,
  fr: reviewGuestFr,
  es: reviewGuestEs,
  am: reviewGuestAm,
};

export const reviewText = (locale: string): ReviewGuestDict => REVIEW_TEXT[locale] ?? reviewGuestEn;
