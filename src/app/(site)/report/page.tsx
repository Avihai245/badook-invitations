import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { legalContext } from '@/features/legal/context';
import { legalStatus } from '@/features/legal/status';
import { CollectionNotice } from '@/features/legal-requests/ui/CollectionNotice';
import { ReportForm } from '@/features/legal-requests/ui/ReportForm.client';
import { RequestPageShell } from '@/features/legal-requests/ui/RequestPageShell';
import { isUiLocale, type UiLocale } from '@/lib/i18n/app';
import { dictFor } from '@/lib/i18n/dict';
import { getUiLocale } from '@/lib/i18n/server';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The page's language: the link's ?lang (he / en), else the site's. */
async function localeOf(q: Awaited<Search>): Promise<UiLocale> {
  const asked = one(q.lang);
  return asked && isUiLocale(asked) ? asked : await getUiLocale();
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  if (!legalStatus().active) return {};
  const t = dictFor(await localeOf(await searchParams)).legalRequests.report;
  // the link carries a gallery's secret: never indexed, never sent on as a referrer
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/**
 * /report — "Report content / request removal". Not found until version 2 of the legal documents is in
 * force. ?g= (the gallery's upload link) or ?a= (the album's) and ?i= (the item) come from the "report"
 * link on a gallery; the form asks the server whether they open a gallery (POST /api/legal/report/link),
 * without showing the item.
 */
export default async function ReportPage({ searchParams }: { searchParams: Search }) {
  if (!legalStatus().active) notFound();
  const q = await searchParams;
  const locale = await localeOf(q);
  const t = dictFor(locale);
  const [g, a, i] = [one(q.g), one(q.a), one(q.i)];
  const o = legalContext(locale).operator;
  return (
    <RequestPageShell
      t={t}
      locale={locale}
      title={t.legalRequests.report.title}
      subtitle={t.legalRequests.report.subtitle}
    >
      <ReportForm
        t={t.legalRequests.report}
        locale={locale}
        token={{ ...(g ? { g } : {}), ...(a ? { a } : {}), ...(i ? { i } : {}) }}
        notice={<CollectionNotice kind="report" t={t.legalRequests.notice} operator={o} />}
      />
    </RequestPageShell>
  );
}
