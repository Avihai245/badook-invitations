import type { Locale } from '@/features/invitations/contracts/types';
import { albumGuestAm } from './album-guest.am';
import { albumGuestAr } from './album-guest.ar';
import { albumGuestEn } from './album-guest.en';
import { albumGuestEs } from './album-guest.es';
import { albumGuestFr } from './album-guest.fr';
import { albumGuestHe, type AlbumGuestDict } from './album-guest.he';
import { albumGuestRu } from './album-guest.ru';

/** The album's guest page in every invitation language. */
export const ALBUM_GUEST: Record<Locale, AlbumGuestDict> = {
  he: albumGuestHe,
  en: albumGuestEn,
  ru: albumGuestRu,
  ar: albumGuestAr,
  fr: albumGuestFr,
  es: albumGuestEs,
  am: albumGuestAm,
};

export type { AlbumGuestDict };
