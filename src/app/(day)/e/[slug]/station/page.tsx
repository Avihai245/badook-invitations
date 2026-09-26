import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { stationPage } from '@/features/event-day/server/pages';
import { DayUnavailable } from '@/features/event-day/ui/DayUnavailable';
import { Station } from '@/features/event-day/ui/station/Station';
import { ipFromHeaders } from '@/lib/client-ip';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe } from '@/lib/i18n/event-day-guest.he';
import { fill } from '@/lib/i18n/guest';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ t?: string | string[]; lang?: string | string[] }>;

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const load = cache(async (token: string | undefined) =>
  token ? stationPage(token, ipFromHeaders(await headers())) : null,
);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const q = await searchParams;
  const data = await load(one(q.t));
  const page = data && data !== 'rate' ? data : null;
  const lang =
    one(q.lang) === 'en' ? 'en' : one(q.lang) === 'he' ? 'he' : (page?.event.defaultLocale ?? 'he');
  const t = lang === 'en' ? eventDayGuestEn : eventDayGuestHe;
  const name = page ? page.event.titles[lang] || page.event.title : '';
  return {
    title: name ? fill(t.station.metaTitle, { name }) : t.station.eyebrow,
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/station?t=<the station link's token> — the entrance station for the event's staff, no
 * account (feature checkin): scan a guest's QR or search, check the family in, see its table. A new
 * link from the host retires this one.
 */
export default async function StationPage({ searchParams }: { params: Params; searchParams: Search }) {
  const q = await searchParams;
  const token = one(q.t);
  const lang = one(q.lang);
  const data = await load(token);
  if (!data || data === 'rate' || !token)
    return (
      <DayUnavailable locale={lang === 'en' ? 'en' : 'he'} kind={data === 'rate' ? 'rate' : 'station'} />
    );
  return <Station data={data} token={token} lang={lang === 'en' || lang === 'he' ? lang : null} />;
}
