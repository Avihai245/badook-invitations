import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { guidePage } from '@/features/event-day/server/pages';
import { DayUnavailable } from '@/features/event-day/ui/DayUnavailable';
import { TableGuide } from '@/features/event-day/ui/guide/TableGuide';
import { ipFromHeaders } from '@/lib/client-ip';
import { serverEnv } from '@/lib/env';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe } from '@/lib/i18n/event-day-guest.he';
import { fill } from '@/lib/i18n/guest';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ g?: string | string[]; lang?: string | string[] }>;

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const load = cache(async (slug: string, token: string | undefined) =>
  token
    ? guidePage(slug, token, ipFromHeaders(await headers()))
    : ({ ok: false, code: 'not_found' } as const),
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const r = await load(slug, one(q.g));
  const lang =
    one(q.lang) === 'en' ? 'en' : one(q.lang) === 'he' ? 'he' : r.ok ? r.data.event.defaultLocale : 'he';
  const t = lang === 'en' ? eventDayGuestEn : eventDayGuestHe;
  const name = r.ok ? r.data.event.titles[lang] || r.data.event.title : '';
  return {
    title: name ? fill(t.guide.metaTitle, { name }) : t.guide.yourTable,
    description: t.guide.metaDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/table?g=<a guest's personal link token> — the guest's table and the way to it (feature
 * seating_guide), their entrance QR (checkin); kept on the phone for the evening. The link opens only
 * with the invitation's current address.
 */
export default async function TableGuidePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.g);
  const lang = one(q.lang);
  const r = await load(slug, token);
  if (!r.ok || !token)
    return (
      <DayUnavailable
        locale={lang === 'en' ? 'en' : 'he'}
        kind={!r.ok && r.code === 'rate' ? 'rate' : 'guide'}
      />
    );
  return (
    <TableGuide
      data={r.data}
      lang={lang === 'en' || lang === 'he' ? lang : null}
      brand={serverEnv().INVITES_BRAND_NAME}
    />
  );
}
