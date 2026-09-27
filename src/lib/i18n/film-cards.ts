import type { Locale } from '@/features/invitations/contracts/types';
import { filmEn } from './film.en';
import { filmHe } from './film.he';

/**
 * The highlights film's title and end cards in every invitation language — what is drawn on them
 * besides the names and the date: the end card's line. The host picks the cards' language among the
 * invitation's own (features/film/ui/FilmStudio.tsx); the studio itself stays in Hebrew and English
 * (film.he.ts, film.en.ts, whose `cards` these are).
 */
export const FILM_CARDS: Record<Locale, { thanks: string }> = {
  he: filmHe.cards,
  en: filmEn.cards,
  ru: { thanks: 'Спасибо, что праздновали с нами' },
  ar: { thanks: 'شكرًا لأنكم احتفلتم معنا' },
  fr: { thanks: 'Merci d’avoir fêté ce moment avec nous' },
  es: { thanks: 'Gracias por celebrarlo con nosotros' },
  am: { thanks: 'ከእኛ ጋር ስላከበሩ እናመሰግናለን' },
};
