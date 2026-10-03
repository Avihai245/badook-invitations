import type { NavKey } from '@/features/invitations/app/workspace/stages';

/** A text in the host app's two languages. */
export interface L2 {
  he: string;
  en: string;
}

/** Where an article sits in the guide: the quick start, the event's four stages, the account, the FAQ. */
export const GUIDE_SECTIONS = ['start', 'plan', 'invite', 'arrange', 'celebrate', 'account', 'faq'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

/**
 * One article of the written guide (/app/guide, the help panel, the assistant's knowledge): what it is,
 * why it matters, 3–6 numbered steps, tips, and where to go next. Plain data (no markup): the guide's
 * screens render it, its search reads it, and the assistant is given it word for word.
 */
export interface GuideArticle {
  /** the URL's last part: /app/guide/<slug> */
  slug: string;
  section: GuideSection;
  title: L2;
  /** one or two sentences: what it is */
  what: L2;
  /** one or two sentences: why it helps */
  why: L2;
  /** 3–6 numbered steps, each one action in the app as it is now */
  steps: L2[];
  /** optional short tips or things to know */
  tips?: L2[];
  /** slugs of the articles to read next ("continue to…") */
  next: string[];
  /** extra words people search with (synonyms, English and Hebrew terms) */
  keywords: L2;
  /** the event's screens this article explains (the "?" on that screen opens it) */
  screens?: NavKey[];
}

/** A question and its short answer (the FAQ section). */
export interface GuideFaq {
  q: L2;
  a: L2;
  /** an article that explains it fully */
  more?: string;
}
