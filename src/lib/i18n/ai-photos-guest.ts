import type { Locale } from '@/features/invitations/contracts/types';
import { aiPhotosGuestAm } from './ai-photos-guest.am';
import { aiPhotosGuestAr } from './ai-photos-guest.ar';
import { aiPhotosGuestEn } from './ai-photos-guest.en';
import { aiPhotosGuestEs } from './ai-photos-guest.es';
import { aiPhotosGuestFr } from './ai-photos-guest.fr';
import { aiPhotosGuestHe, type AiPhotosGuestDict } from './ai-photos-guest.he';
import { aiPhotosGuestRu } from './ai-photos-guest.ru';

/** The AI photos on the gallery's guest page in every invitation language. */
export const AI_PHOTOS_GUEST: Record<Locale, AiPhotosGuestDict> = {
  he: aiPhotosGuestHe,
  en: aiPhotosGuestEn,
  ru: aiPhotosGuestRu,
  ar: aiPhotosGuestAr,
  fr: aiPhotosGuestFr,
  es: aiPhotosGuestEs,
  am: aiPhotosGuestAm,
};

export type { AiPhotosGuestDict };
