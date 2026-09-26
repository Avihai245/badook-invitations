import { LinkIcon } from 'lucide-react';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe } from '@/lib/i18n/event-day-guest.he';

/**
 * The event day's pages when their link opens nothing (unknown, replaced, the feature off) or the
 * network sent too many requests — in the page's language, with nothing about the event.
 */
export function DayUnavailable({
  locale,
  kind,
}: {
  locale: 'he' | 'en';
  kind: 'guide' | 'station' | 'rate';
}) {
  const t = locale === 'en' ? eventDayGuestEn : eventDayGuestHe;
  const text = kind === 'station' ? t.station.gone : kind === 'rate' ? t.guide.rate : t.guide.unavailable;
  return (
    <main
      className="grid min-h-dvh place-items-center bg-canvas px-6 py-10"
      lang={locale}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
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
