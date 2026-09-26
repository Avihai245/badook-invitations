import type { Locale } from '@/features/invitations/contracts/types';
import { galleryGuestAm } from './gallery-guest.am';
import { galleryGuestAr } from './gallery-guest.ar';
import { galleryGuestEn } from './gallery-guest.en';
import { galleryGuestEs } from './gallery-guest.es';
import { galleryGuestFr } from './gallery-guest.fr';
import { galleryGuestHe, type GalleryGuestDict } from './gallery-guest.he';
import { galleryGuestRu } from './gallery-guest.ru';

/** The live gallery's guest pages in every invitation language. */
export const GALLERY_GUEST: Record<Locale, GalleryGuestDict> = {
  he: galleryGuestHe,
  en: galleryGuestEn,
  ru: galleryGuestRu,
  ar: galleryGuestAr,
  fr: galleryGuestFr,
  es: galleryGuestEs,
  am: galleryGuestAm,
};

export type { GalleryGuestDict };
