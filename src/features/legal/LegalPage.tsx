import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { fmt, type AppDict } from '@/lib/i18n/app';
import { legalHref, legalVersionHref } from './links';
import type { LegalBlock, LegalContext, LegalDoc, LegalDocKey } from './types';

/** What a page shows about the document's versions (built by legal/render.tsx). */
export interface LegalVersionInfo {
  key: LegalDocKey;
  /** the version being shown */
  version: string;
  /** it is the version in force */
  current: boolean;
  /** when the newer version took effect, formatted (archived versions only) */
  until?: string;
  /** every version a visitor may open */
  history: readonly { version: string; effective: string; current: boolean }[];
  /** the documents this one links to (version 2 only) */
  related: readonly LegalDocKey[];
}

export function legalMetadata(doc: LegalDoc, brand: string): Metadata {
  return {
    title: doc.title,
    description: doc.description,
    robots: { index: true, follow: true },
    openGraph: { title: `${doc.title} · ${brand}`, description: doc.description, type: 'article' },
  };
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string')
    return <p className="mt-3 text-[15.5px] leading-[1.75] text-pretty">{block}</p>;
  if ('list' in block)
    return (
      <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15.5px] leading-[1.7] marker:text-brand">
        {block.list.map((item) => (
          <li key={item} className="text-pretty">
            {item}
          </li>
        ))}
      </ul>
    );
  return (
    <p className="mt-4 rounded-card border border-brand-line bg-brand-soft/60 px-4 py-3 text-[15px] leading-[1.7] font-medium text-pretty">
      {block.note}
    </p>
  );
}

/**
 * A policy page (privacy, terms, cookies, accessibility): the site's header and footer, the title with
 * the date of the last update, a table of contents beside the text on wide screens, and the sections.
 */
export function LegalPage({
  t,
  doc,
  context,
  info,
  children,
}: {
  t: AppDict;
  doc: LegalDoc;
  context: LegalContext;
  info?: LegalVersionInfo;
  children?: ReactNode;
}) {
  const l = t.site.legal;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="border-b border-line bg-[radial-gradient(60%_120%_at_85%_0%,#F8E3D6,transparent_70%)]">
          <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-10 sm:px-6">
            <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.01em] sm:text-[44px]">
              {doc.title}
            </h1>
            <p className="mt-2 text-[14px] text-muted">
              {info
                ? fmt(l.versionLine, { version: info.version, date: context.updated })
                : fmt(l.updated, { date: context.updated })}
            </p>
            {info && !info.current && (
              <p
                role="note"
                className="mt-4 max-w-[72ch] rounded-card border border-brand-line bg-brand-soft/60 px-4 py-3 text-[15px] leading-[1.7]"
              >
                {info.until
                  ? fmt(l.archivedNotice, { version: info.version, until: info.until })
                  : fmt(l.archivedNoticeNoDate, { version: info.version })}{' '}
                <Link className="font-bold underline" href={legalHref(info.key)}>
                  {l.currentLink}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label={l.contents} className="max-lg:hidden">
            <div className="sticky top-24">
              <p className="text-[13px] font-bold tracking-wide text-muted uppercase">{l.contents}</p>
              <ol className="mt-3 flex flex-col gap-1.5 border-s border-line ps-4 text-[14px]">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="rounded-btn text-muted hover:text-ink">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <article className="max-w-[72ch] min-w-0">
            {doc.intro.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 pt-8">
                <h2 className="text-[20px] font-bold">{s.heading}</h2>
                {s.body.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </section>
            ))}
            {children}
            {info && info.related.length > 0 && (
              <nav aria-labelledby="legal-related" className="pt-10">
                <h2 id="legal-related" className="text-[20px] font-bold">
                  {l.related}
                </h2>
                <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15.5px] marker:text-brand">
                  {info.related.map((k) => (
                    <li key={k}>
                      <Link className="underline" href={legalHref(k)}>
                        {l.docNames[k]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {info && info.history.length > 1 && (
              <nav aria-labelledby="legal-history" className="pt-10">
                <h2 id="legal-history" className="text-[20px] font-bold">
                  {l.history}
                </h2>
                <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15.5px] marker:text-brand">
                  {info.history.map((h) => (
                    <li key={h.version}>
                      <Link
                        className="underline"
                        href={h.current ? legalHref(info.key) : legalVersionHref(info.key, h.version)}
                        aria-current={h.version === info.version ? 'page' : undefined}
                      >
                        {h.current
                          ? fmt(l.historyCurrent, { version: h.version })
                          : fmt(l.historyItem, { version: h.version, date: h.effective })}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </article>
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
