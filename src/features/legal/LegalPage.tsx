import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { fmt, type AppDict } from '@/lib/i18n/app';
import type { LegalBlock, LegalContext, LegalDoc } from './types';

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
  children,
}: {
  t: AppDict;
  doc: LegalDoc;
  context: LegalContext;
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
            <p className="mt-2 text-[14px] text-muted">{fmt(l.updated, { date: context.updated })}</p>
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
          </article>
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
