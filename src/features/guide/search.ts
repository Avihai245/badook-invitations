import type { UiLocale } from '@/lib/i18n/app';
import type { NavKey } from '@/features/invitations/app/workspace/stages';
import type { GuideArticle, GuideFaq } from './types';

/** Comparable text: lower case, no Hebrew points, no punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״׳"'`’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface GuideHit {
  article: GuideArticle;
  score: number;
}

/**
 * The guide's search: every word of the query has to appear somewhere in the article (either language —
 * hosts type in both); the title counts most, then the keywords, then what it is and its steps. Best first.
 */
export function searchGuide(articles: readonly GuideArticle[], query: string, locale: UiLocale): GuideHit[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const hits: GuideHit[] = [];
  for (const a of articles) {
    const fields: [string, number][] = [
      [normalize(`${a.title[locale]} ${a.title.he} ${a.title.en}`), 6],
      [normalize(`${a.keywords.he} ${a.keywords.en}`), 4],
      [normalize(`${a.what[locale]} ${a.why[locale]}`), 2],
      [normalize([...a.steps, ...(a.tips ?? [])].map((s) => `${s.he} ${s.en}`).join(' ')), 1],
    ];
    let score = 0;
    let all = true;
    for (const w of words) {
      let best = 0;
      for (const [text, weight] of fields) if (text.includes(w)) best = Math.max(best, weight);
      if (!best) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) hits.push({ article: a, score });
  }
  return hits.sort((x, y) => y.score - x.score);
}

export function searchFaq(faq: readonly GuideFaq[], query: string): GuideFaq[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return faq.filter((f) => {
    const text = normalize(`${f.q.he} ${f.q.en} ${f.a.he} ${f.a.en}`);
    return words.every((w) => text.includes(w));
  });
}

/** The articles that explain a screen of the event (the "?" there, the help panel's "for this screen"). */
export function articlesFor(articles: readonly GuideArticle[], key: NavKey | null): GuideArticle[] {
  if (!key) return [];
  return articles.filter((a) => a.screens?.includes(key));
}

/** The guide's articles as plain text, for the assistant's knowledge (the same words the guide shows). */
export function guideAsText(
  articles: readonly GuideArticle[],
  faq: readonly GuideFaq[],
  locale: UiLocale,
): string {
  const parts = articles.map((a) =>
    [
      `### ${a.title[locale]} (/app/guide/${a.slug})`,
      a.what[locale],
      a.why[locale],
      ...a.steps.map((s, i) => `${i + 1}. ${s[locale]}`),
      ...(a.tips ?? []).map((s) => `- ${s[locale]}`),
    ].join('\n'),
  );
  const qa = faq.map((f) => `- ${f.q[locale]} — ${f.a[locale]}`).join('\n');
  return `${parts.join('\n\n')}\n\n### FAQ\n${qa}`;
}
