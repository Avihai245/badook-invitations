/**
 * Short headline copy for the design concepts the composer makes without the AI: the hero's eyebrow
 * and the footer's closing line, in three tones — classic, warm, playful — per kind of event. Hebrew
 * and English; a language the bank doesn't have keeps the invitation's own text (the concept leaves
 * that line as it is). `{primary}` is the host's name (a live token, interpolated on the page).
 */
import type { EventType, L10n, Locale } from '../invitations/contracts/types';

export type Tone = 'classic' | 'warm' | 'playful';
type Line = { he: string; en: string };
type Lines = { eyebrow: Line; closing: Line };

type Group = 'couple' | 'mitzvah' | 'baby' | 'birthday' | 'general';

const GROUP: Record<EventType, Group> = {
  wedding: 'couple',
  engagement: 'couple',
  henna: 'couple',
  save_the_date: 'couple',
  bar_mitzvah: 'mitzvah',
  bat_mitzvah: 'mitzvah',
  brit: 'baby',
  baby_shower: 'baby',
  birthday: 'birthday',
  corporate: 'general',
  other: 'general',
};

const BANK: Record<Group, Record<Tone, Lines>> = {
  couple: {
    classic: {
      eyebrow: { he: 'בשמחה ובהתרגשות', en: 'With joy and love' },
      closing: { he: 'נשמח לחגוג איתכם', en: 'We can’t wait to celebrate with you' },
    },
    warm: {
      eyebrow: { he: 'אנחנו מתחתנים!', en: 'We’re getting married!' },
      closing: { he: 'מחכים לראות אתכם, באהבה', en: 'See you there, with all our love' },
    },
    playful: {
      eyebrow: { he: 'זה קורה!', en: 'It’s happening!' },
      closing: { he: 'בואו לרקוד איתנו', en: 'Come dance with us' },
    },
  },
  mitzvah: {
    classic: {
      eyebrow: { he: 'בשמחה רבה', en: 'With great joy' },
      closing: { he: 'נשמח לראותכם בשמחתנו', en: 'We would be honored by your presence' },
    },
    warm: {
      eyebrow: { he: 'מתרגשים להזמין אתכם', en: 'We’re delighted to invite you' },
      closing: { he: 'מחכים לחגוג איתכם', en: 'We can’t wait to celebrate together' },
    },
    playful: {
      eyebrow: { he: 'מגיעים לחגוג!', en: 'Come celebrate!' },
      closing: { he: 'יהיה שמח!', en: 'It’s going to be a blast!' },
    },
  },
  baby: {
    classic: {
      eyebrow: { he: 'בשמחה רבה', en: 'With joy' },
      closing: { he: 'נשמח לחגוג איתכם', en: 'We’d love to celebrate with you' },
    },
    warm: {
      eyebrow: { he: 'המשפחה גדלה!', en: 'Our family is growing!' },
      closing: { he: 'מחכים לחבק אתכם', en: 'With love and hugs' },
    },
    playful: {
      eyebrow: { he: 'הגיע הזמן לחגוג!', en: 'Time to celebrate!' },
      closing: { he: 'בואו לחגוג איתנו', en: 'Come celebrate with us' },
    },
  },
  birthday: {
    classic: {
      eyebrow: { he: 'חוגגים יום הולדת', en: 'A birthday celebration' },
      closing: { he: 'נשמח לראותכם', en: 'Hope to see you there' },
    },
    warm: {
      eyebrow: { he: 'בואו לחגוג איתנו', en: 'Come celebrate with us' },
      closing: { he: 'יהיה שמח ומרגש', en: 'It will be a joy to see you' },
    },
    playful: {
      eyebrow: { he: 'מסיבה!', en: 'Party time!' },
      closing: { he: 'מביאים מצב רוח!', en: 'Bring your dancing shoes!' },
    },
  },
  general: {
    classic: {
      eyebrow: { he: 'הזמנה', en: 'You’re invited' },
      closing: { he: 'נשמח לראותכם', en: 'We look forward to seeing you' },
    },
    warm: {
      eyebrow: { he: 'מוזמנים לחגוג איתנו', en: 'Join us to celebrate' },
      closing: { he: 'מחכים לכם', en: 'See you there' },
    },
    playful: {
      eyebrow: { he: 'בואו!', en: 'Come along!' },
      closing: { he: 'יהיה כיף!', en: 'It’s going to be fun!' },
    },
  },
};

/** The warm eyebrow says what the event is where the group's line would be wrong for it. */
const WARM_EYEBROW: Partial<Record<EventType, Line>> = {
  engagement: { he: 'התארסנו!', en: 'We’re engaged!' },
  henna: { he: 'חוגגים חינה!', en: 'A henna celebration!' },
  save_the_date: { he: 'שמרו את התאריך', en: 'Save the date' },
  brit: { he: 'נולד לנו בן!', en: 'Our son is here!' },
  baby_shower: { he: 'תינוק בדרך!', en: 'A baby is on the way!' },
};

/** A line in every one of `locales`, or null when the bank lacks one of them. */
function l10n(line: Line, locales: readonly Locale[]): L10n | null {
  const out: L10n = {};
  for (const l of locales) {
    const text = (line as Partial<Record<Locale, string>>)[l];
    if (!text) return null;
    out[l] = text;
  }
  return out;
}

export function headlineCopy(
  eventType: EventType,
  tone: Tone,
  locales: readonly Locale[],
): { eyebrow: L10n | null; closing: L10n | null } {
  const lines = BANK[GROUP[eventType]][tone];
  const eyebrow = tone === 'warm' ? (WARM_EYEBROW[eventType] ?? lines.eyebrow) : lines.eyebrow;
  return { eyebrow: l10n(eyebrow, locales), closing: l10n(lines.closing, locales) };
}
