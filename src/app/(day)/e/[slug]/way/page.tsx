import { CalendarPlus, MapPin, Navigation, PartyPopper } from 'lucide-react';
import type { Metadata } from 'next';
import { RTL_LOCALES, type Locale, type Venue } from '@/features/invitations/contracts/types';
import { formatDate, formatTime } from '@/features/invitations/lib/dates';
import { EVENT_PHRASE } from '@/features/invitations/lib/event-phrases';
import { isLocale } from '@/features/invitations/lib/locales';
import { googleMapsUrl, hasLocation, wazeUrl } from '@/features/invitations/lib/maps';
import { hostsLine } from '@/features/invitations/lib/text';
import { shownVenues } from '@/features/invitations/renderer/calendar-event';
import { getPublishedInvitation } from '@/features/invitations/server/published';
import { WAY_TEXT } from '@/lib/i18n/way';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ g?: string | string[]; lang?: string | string[] }>;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function load(slug: string, lang: string | undefined) {
  const invitation = await getPublishedInvitation(slug);
  if (!invitation) return null;
  const { doc } = invitation;
  const locale: Locale = isLocale(lang) && doc.locales.includes(lang) ? lang : doc.defaultLocale;
  return { doc, locale };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const r = await load(slug, one(q.lang));
  const t = WAY_TEXT[r?.locale ?? 'he'];
  return {
    title: r ? `${t.title} · ${hostsLine(r.doc.hosts, r.locale)}` : t.title,
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/way?g=<token>&lang= — the way to the event, where the reminder before it leads
 * (features/whatsapp: the event reminder's button): when and where, navigation with Waze or Google
 * Maps in one tap, the event in the calendar, and the guest's own invitation. Only what the published
 * invitation already shows its guests.
 */
export default async function WayPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const r = await load(slug, one(q.lang));
  if (!r) {
    const t = WAY_TEXT[isLocale(one(q.lang)) ? (one(q.lang) as Locale) : 'he'];
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center text-[15px] text-muted">
        {t.missing}
      </main>
    );
  }
  const { doc, locale } = r;
  const t = WAY_TEXT[locale];
  const token = one(q.g);
  const invitationHref = `/i/${slug}?${new URLSearchParams({
    ...(token && TOKEN_RE.test(token) ? { g: token } : {}),
    ...(locale !== doc.defaultLocale ? { lang: locale } : {}),
  })}`;
  const name = (v: Venue) => (v.name[locale] ?? v.name[doc.defaultLocale] ?? '').trim();
  const address = (v: Venue) => (v.address[locale] ?? v.address[doc.defaultLocale] ?? '').trim();
  const label = (v: Venue) => (v.label[locale] ?? v.label[doc.defaultLocale] ?? '').trim();
  const venues = shownVenues(doc);
  /** the venue as the map links read it: its pin, or its name and address */
  const place = (v: Venue) => ({ ...v, fallbackQuery: [name(v), address(v)].filter(Boolean).join(', ') });
  const when = (v: Venue | null) =>
    [
      formatDate(v?.date ?? doc.event.date, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
      formatTime(v?.startTime ?? doc.event.startTime, locale, doc.event.timeFormat),
    ].join(' · ');
  const button =
    'flex h-12 items-center justify-center gap-2 rounded-btn px-4 text-[15px] font-semibold transition-colors';

  return (
    <main
      dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'}
      lang={locale}
      className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-canvas px-4 pt-8 pb-12"
      data-testid="way-page"
    >
      <header className="text-center">
        <PartyPopper aria-hidden className="mx-auto size-8 text-brand" />
        <p className="mt-2 text-[13px] font-semibold text-muted">{t.title}</p>
        <h1 className="mt-1 text-[22px] leading-tight font-extrabold text-ink">
          {hostsLine(doc.hosts, locale)}
        </h1>
        <p className="mt-1 text-[14px] text-muted">{EVENT_PHRASE[locale][doc.eventType]}</p>
      </header>

      {(venues.length ? venues : [null]).map((v, i) => (
        <section key={v?.id ?? i} className="rounded-card border border-line bg-surface p-4 shadow-sm">
          {v && label(v) && venues.length > 1 ? (
            <p className="text-[12.5px] font-semibold text-muted">{label(v)}</p>
          ) : null}
          <p className="text-[16px] font-bold text-ink">{when(v)}</p>
          {v && (name(v) || address(v)) ? (
            <p className="mt-1 flex items-start gap-1.5 text-[14px] text-ink/80">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>
                {name(v)}
                {name(v) && address(v) ? <br /> : null}
                {address(v) ? <span className="text-muted">{address(v)}</span> : null}
              </span>
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {v && hasLocation(place(v)) ? (
              <>
                <a
                  href={wazeUrl(place(v))}
                  className={`${button} bg-[#33ccff] text-[#06222c] hover:bg-[#1fbff5]`}
                  data-testid="way-waze"
                >
                  <Navigation aria-hidden className="size-5" />
                  {t.waze}
                </a>
                <a
                  href={googleMapsUrl(place(v))}
                  className={`${button} border border-line bg-surface text-ink hover:bg-subtle`}
                  data-testid="way-maps"
                >
                  <MapPin aria-hidden className="size-5" />
                  {t.maps}
                </a>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">{t.noPlace}</p>
            )}
            <a
              href={`/i/${slug}/event.ics?${new URLSearchParams({ ...(v ? { venue: v.id } : {}), lang: locale })}`}
              className={`${button} border border-line bg-surface text-ink hover:bg-subtle`}
            >
              <CalendarPlus aria-hidden className="size-5" />
              {t.calendar}
            </a>
          </div>
        </section>
      ))}

      <a href={invitationHref} className={`${button} bg-primary text-primary-ink hover:bg-primary-hover`}>
        {t.invitation}
      </a>
    </main>
  );
}
