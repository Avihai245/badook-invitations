'use client';

import { ArrowRight, ChevronLeft, CircleHelp, ExternalLink, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { NavKey } from '@/features/invitations/app/workspace/stages';
import { GUIDE_ARTICLES, GUIDE_FAQ } from './articles';
import { articlesFor, searchFaq, searchGuide } from './search';
import { GUIDE_SECTIONS, type GuideArticle } from './types';

export const articleBySlug = (slug: string | null) =>
  slug ? (GUIDE_ARTICLES.find((a) => a.slug === slug) ?? null) : null;

/**
 * The guide's index: a search over every article (and the FAQ), this screen's articles first (when
 * there is a screen), then the articles by the event's stages. `onOpen` shows an article (the panel
 * keeps it in place; the page links to its own address).
 */
export function GuideIndex({
  screen = null,
  onOpen,
  onAsk,
  compact = false,
}: {
  /** the event screen the help was opened from */
  screen?: NavKey | null;
  onOpen: (slug: string) => void;
  /** "ask the assistant" when nothing was found */
  onAsk?: (question: string) => void;
  compact?: boolean;
}) {
  const { t, locale, plural, number } = useUi();
  const H = t.helpCenter;
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchGuide(GUIDE_ARTICLES, query, locale), [query, locale]);
  const faqHits = useMemo(() => searchFaq(GUIDE_FAQ, query), [query]);
  const here = articlesFor(GUIDE_ARTICLES, screen);
  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-5" data-testid="guide-index">
      <label className="relative block">
        <span className="sr-only">{H.search}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={H.searchPlaceholder}
          data-testid="guide-search"
          className="h-11 w-full rounded-[12px] border border-line-strong bg-surface ps-9 pe-3 text-[15px] outline-none placeholder:text-faint focus:border-brand focus:shadow-[0_0_0_3px_rgba(160,112,63,0.15)]"
        />
      </label>

      {searching ? (
        <section aria-live="polite">
          <p className="text-[12.5px] font-semibold text-muted">
            {plural(H.results, hits.length + faqHits.length, { n: number(hits.length + faqHits.length) })}
          </p>
          {hits.length || faqHits.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {hits.map(({ article }) => (
                <li key={article.slug}>
                  <ArticleLink article={article} onOpen={onOpen} />
                </li>
              ))}
              {faqHits.map((f) => (
                <li key={f.q.he} className="rounded-[12px] bg-subtle px-3 py-2.5">
                  <p className="text-[14px] font-semibold">{f.q[locale]}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{f.a[locale]}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-[14px] bg-subtle p-4 text-[13.5px] text-muted">
              <p>{H.noResults}</p>
              {onAsk ? (
                <button
                  type="button"
                  onClick={() => onAsk(query)}
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-deep hover:underline"
                >
                  <Sparkles aria-hidden className="size-4" />
                  {H.askInstead}
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <>
          {here.length ? (
            <Section title={H.forThisScreen} highlight>
              {here.map((a) => (
                <li key={a.slug}>
                  <ArticleLink article={a} onOpen={onOpen} />
                </li>
              ))}
            </Section>
          ) : null}
          {GUIDE_SECTIONS.filter((s) => s !== 'faq').map((section) => {
            const list = GUIDE_ARTICLES.filter((a) => a.section === section);
            if (!list.length) return null;
            return (
              <Section key={section} title={H.sections[section]} grid={!compact}>
                {list.map((a) => (
                  <li key={a.slug}>
                    <ArticleLink article={a} onOpen={onOpen} />
                  </li>
                ))}
              </Section>
            );
          })}
          <section>
            <h3 className="text-[13px] font-bold text-muted">{H.sections.faq}</h3>
            <div className="mt-2 flex flex-col gap-2">
              {GUIDE_FAQ.map((f) => (
                <details
                  key={f.q.he}
                  className="group rounded-[12px] border border-line bg-surface px-3 py-2.5"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
                    <CircleHelp aria-hidden className="size-4 shrink-0 text-brand-deep" />
                    <span className="flex-1">{f.q[locale]}</span>
                  </summary>
                  <p className="mt-2 text-[13.5px] text-muted">{f.a[locale]}</p>
                  {f.more && articleBySlug(f.more) ? (
                    <button
                      type="button"
                      onClick={() => onOpen(f.more!)}
                      className="mt-1.5 text-[13px] font-semibold text-brand-deep hover:underline"
                    >
                      {articleBySlug(f.more)!.title[locale]}
                    </button>
                  ) : null}
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  highlight = false,
  grid = false,
}: {
  title: string;
  children: ReactNode;
  highlight?: boolean;
  grid?: boolean;
}) {
  return (
    <section>
      <h3 className={cn('text-[13px] font-bold', highlight ? 'text-brand-deep' : 'text-muted')}>{title}</h3>
      <ul className={cn('mt-2 grid gap-2', grid && 'sm:grid-cols-2')}>{children}</ul>
    </section>
  );
}

function ArticleLink({ article, onOpen }: { article: GuideArticle; onOpen: (slug: string) => void }) {
  const { locale } = useUi();
  return (
    <button
      type="button"
      onClick={() => onOpen(article.slug)}
      data-article={article.slug}
      className="group flex w-full items-start gap-2 rounded-[12px] border border-line bg-surface px-3 py-2.5 text-start transition-colors hover:border-brand-line hover:bg-brand-soft/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{article.title[locale]}</span>
        <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{article.what[locale]}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="icon-dir mt-1 size-4 shrink-0 text-faint group-hover:text-brand-deep"
      />
    </button>
  );
}

/**
 * One article: what it is, why it helps, the numbered steps, what's good to know, and where to go next.
 * `onBack` (the panel) or a link back (the page); `full`: a link to the article's own page.
 */
export function GuideArticleView({
  article,
  onOpen,
  onBack,
  full = false,
}: {
  article: GuideArticle;
  onOpen: (slug: string) => void;
  onBack?: () => void;
  /** in the panel: a link to open it as a page */
  full?: boolean;
}) {
  const { t, locale, number } = useUi();
  const H = t.helpCenter;
  return (
    <article className="flex flex-col gap-4" data-testid="guide-article" data-slug={article.slug}>
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-btn text-[13px] font-semibold text-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden className="icon-dir size-4" />
            {H.back}
          </button>
        ) : (
          <span />
        )}
        {full ? (
          <Link
            href={`/app/guide/${article.slug}`}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-deep hover:underline"
          >
            {H.openFull}
            <ExternalLink aria-hidden className="icon-dir size-3.5" />
          </Link>
        ) : null}
      </div>
      <header>
        <p className="text-[12.5px] font-semibold text-brand-deep">{H.sections[article.section]}</p>
        <h2 className="mt-1 text-[22px] leading-tight font-extrabold">{article.title[locale]}</h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] bg-brand-soft/50 p-3.5">
          <h3 className="text-[12.5px] font-bold text-brand-deep">{H.what}</h3>
          <p className="mt-1 text-[14px] leading-[1.6]">{article.what[locale]}</p>
        </div>
        <div className="rounded-[14px] bg-subtle p-3.5">
          <h3 className="text-[12.5px] font-bold text-muted">{H.why}</h3>
          <p className="mt-1 text-[14px] leading-[1.6]">{article.why[locale]}</p>
        </div>
      </div>
      <section>
        <h3 className="text-[15px] font-bold">{H.steps}</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {article.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white"
              >
                {number(i + 1)}
              </span>
              <span className="pt-0.5 text-[14.5px] leading-[1.6]">{s[locale]}</span>
            </li>
          ))}
        </ol>
      </section>
      {article.tips?.length ? (
        <section className="rounded-[14px] border border-info-line bg-info-bg/60 p-3.5">
          <h3 className="text-[13px] font-bold text-info">{H.tips}</h3>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-[13.5px] leading-[1.6]">
            {article.tips.map((tip, i) => (
              <li key={i}>{tip[locale]}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {article.next.length ? (
        <section>
          <h3 className="text-[13px] font-bold text-muted">{H.next}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {article.next.map((slug) => {
              const a = articleBySlug(slug);
              return a ? (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onOpen(slug)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-brand-deep hover:bg-brand-soft"
                >
                  {a.title[locale]}
                  <ArrowRight aria-hidden className="icon-dir size-3.5" />
                </button>
              ) : null;
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
