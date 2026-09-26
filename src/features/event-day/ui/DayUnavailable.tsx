import { LinkIcon } from 'lucide-react';
import { dirOf, type Locale } from '@/features/invitations/contracts/types';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe } from '@/lib/i18n/event-day-guest.he';
import { GUIDE_TEXT } from '@/lib/i18n/event-day-guide';

/**
 * The event day's pages when their link opens nothing (unknown, replaced, the feature off) or the
 * network sent too many requests — in the page's language, with nothing about the event: a guide's in
 * any invitation language, the station's in Hebrew or English.
 */
export function DayUnavailable({ locale, kind }: { locale: Locale; kind: 'guide' | 'station' | 'rate' }) {
  const staff = locale === 'en' ? eventDayGuestEn : eventDayGuestHe;
  const guide = GUIDE_TEXT[locale].guide;
  const text = kind === 'station' ? staff.station.gone : kind === 'rate' ? guide.rate : guide.unavailable;
  const lang: Locale = kind === 'station' ? (locale === 'en' ? 'en' : 'he') : locale;
  return (
    <main
      className="grid min-h-dvh place-items-center bg-canvas px-6 py-10"
      lang={lang}
      dir={dirOf(lang)}
      data-testid="day-unavailable"
    >
      <div className="max-w-[420px] text-center">
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-full bg-subtle text-muted"
        >
          <LinkIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-[20px] font-bold">{text.title}</h1>
        <p className="mt-2 text-[14px] text-muted">{text.body}</p>
      </div>
    </main>
  );
}
