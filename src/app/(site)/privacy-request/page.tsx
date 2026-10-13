import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { legalContext } from '@/features/legal/context';
import { legalStatus } from '@/features/legal/status';
import { isRequestKind } from '@/features/legal-requests/config';
import { CollectionNotice } from '@/features/legal-requests/ui/CollectionNotice';
import { PrivacyRequestForm } from '@/features/legal-requests/ui/PrivacyRequestForm.client';
import { RequestPageShell } from '@/features/legal-requests/ui/RequestPageShell';
import { isUiLocale, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';
import { getUiLocale } from '@/lib/i18n/server';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function localeOf(q: Awaited<Search>): Promise<UiLocale> {
  const asked = one(q.lang);
  return asked && isUiLocale(asked) ? asked : await getUiLocale();
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  if (!legalStatus().active) return {};
  const t = dictFor(await localeOf(await searchParams)).legalRequests.privacyRequest;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: true, follow: true },
  };
}

/**
 * /privacy-request — a request about personal information, with a short explainer of who handles what.
 * ?kind=child_photo pre-selects the child's photo request (the link from the gallery notice). Not found
 * until version 2 of the legal documents is in force.
 */
export default async function PrivacyRequestPage({ searchParams }: { searchParams: Search }) {
  if (!legalStatus().active) notFound();
  const q = await searchParams;
  const locale = await localeOf(q);
  const t = dictFor(locale);
  const r = t.legalRequests.privacyRequest;
  const kind = one(q.kind);
  const e = r.explainer;
  return (
    <RequestPageShell
      t={t}
      locale={locale}
      title={r.title}
      subtitle={r.subtitle}
      aside={
        <section
          aria-labelledby="request-explainer"
          className="rounded-[18px] border border-brand-line bg-brand-soft/60 p-5 text-[14px]"
          data-testid="request-explainer"
        >
          <h2 id="request-explainer" className="flex items-center gap-2 text-[15px] font-bold">
            <ShieldCheck aria-hidden className="size-5 shrink-0 text-brand" />
            {e.title}
          </h2>
          <dl className="mt-3 flex flex-col gap-3">
            {[e.who, e.verify, e.deletion, e.time].map((x) => (
              <div key={x.title}>
                <dt className="font-semibold">{x.title}</dt>
                <dd className="text-pretty text-muted">{x.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-pretty">{e.child}</p>
        </section>
      }
    >
      <PrivacyRequestForm
        t={r}
        locale={locale}
        defaultKind={kind && isRequestKind(kind) ? kind : 'access'}
        notice={
          <CollectionNotice
            kind="request"
            t={t.legalRequests.notice}
            operator={legalContext(locale).operator}
          />
        }
      />
    </RequestPageShell>
  );
}
