'use client';

import { CircleCheck, Globe, WifiOff } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { Locale } from '@/features/invitations/contracts/types';
import { nativeName } from '@/features/invitations/lib/locales';
import type { GuidePageData } from '../../server/pages';
import { withName } from '../named';
import { fill, GuideTextProvider, useGuideText } from '../guest-text';
import { GuideMap } from './GuideMap';
import { useOfflineSave } from './useOfflineSave';

/**
 * A guest's table guide (/e/<slug>/table?g=<their personal link's token>): their table's number, big;
 * the hall's map with the way from the entrance; their entrance QR when the event checks guests in;
 * kept on the phone for the evening. No other guest's name is ever on it. In the language asked for
 * (?lang — a switch keeps it in the address), else the guest's own (set on the guest list, as their
 * personal link), else the invitation's; any of the invitation's languages from its menu.
 */
export function TableGuide({
  data,
  lang,
  brand,
}: {
  data: GuidePageData;
  lang: Locale | null;
  brand: string;
}) {
  const has = (l: Locale | null | undefined): l is Locale => !!l && data.event.locales.includes(l);
  const initial: Locale = has(lang)
    ? lang
    : has(data.guestLanguage)
      ? data.guestLanguage
      : data.event.defaultLocale;
  const [locale, setLocale] = useState<Locale>(initial);
  return (
    <GuideTextProvider locale={locale}>
      <GuideBody
        data={data}
        brand={brand}
        others={data.event.locales.filter((l) => l !== locale)}
        onLocale={(l) => {
          setLocale(l);
          const url = new URL(window.location.href);
          url.searchParams.set('lang', l);
          window.history.replaceState(window.history.state, '', url);
        }}
      />
    </GuideTextProvider>
  );
}

function GuideBody({
  data,
  brand,
  others,
  onLocale,
}: {
  data: GuidePageData;
  brand: string;
  /** the invitation's other languages */
  others: Locale[];
  onLocale(l: Locale): void;
}) {
  const { t, locale, plural } = useGuideText();
  const g = t.guide;
  const title = data.event.titles[locale] || data.event.title;
  // back to the invitation (their personal link) in the language the guide shows
  const inviteUrl = `${data.inviteUrl}&lang=${locale}`;
  const accent = data.event.accent;
  const accentInk = data.event.accentInk;
  const offline = useOfflineSave(data.slug, data.hall.planUrl ? [data.hall.planUrl] : []);
  const vars = { '--day-accent': accent, '--day-accent-ink': accentInk } as CSSProperties;

  return (
    <main className="min-h-dvh bg-canvas pb-[max(24px,env(safe-area-inset-bottom))]" style={vars}>
      <div className="mx-auto w-full max-w-[560px] px-4 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[13px] font-semibold text-muted" lang={locale}>
            <bdi>{title}</bdi>
          </p>
          {others.length === 1 ? (
            <button
              type="button"
              onClick={() => onLocale(others[0]!)}
              lang={others[0]}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
            >
              <Globe aria-hidden className="size-4" />
              {nativeName(others[0]!)}
            </button>
          ) : others.length > 1 ? (
            // more languages: a menu of them, each by its own name
            <label className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface ps-3 pe-2 text-[13px] font-semibold">
              <Globe aria-hidden className="size-4" />
              <select
                aria-label={t.language}
                value={locale}
                onChange={(e) => onLocale(e.target.value as Locale)}
                className="cursor-pointer appearance-none bg-transparent font-semibold outline-none"
                data-testid="guide-language"
              >
                {[locale, ...others].map((l) => (
                  <option key={l} value={l} lang={l}>
                    {nativeName(l)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </header>

        <p className="mt-4 text-[17px] font-semibold">
          {withName((name) => fill(g.hello, { name }), data.guestName)}
        </p>

        {data.state === 'seated' && data.table ? (
          <section
            aria-labelledby="guide-table"
            className="mt-3 flex items-center gap-4 rounded-[24px] px-5 py-5 shadow-[0_18px_40px_-24px_rgba(28,25,23,0.55)]"
            style={{ background: accent, color: accentInk }}
            data-testid="guide-table"
          >
            <div className="min-w-0 flex-1">
              <h1 id="guide-table" className="text-[15px] font-semibold opacity-85">
                {g.yourTable}
              </h1>
              {data.table.label ? (
                <p className="mt-0.5 truncate text-[15px] font-semibold">
                  <bdi>{data.table.label}</bdi>
                </p>
              ) : null}
              <p className="mt-1 text-[13px] opacity-80">
                {plural(g.seats, data.seats)}
                {data.startTime ? ` · ${fill(g.doors, { time: data.startTime })}` : ''}
              </p>
            </div>
            <p
              className="shrink-0 text-[76px] leading-none font-extrabold tracking-tight"
              aria-label={fill(g.tableNumber, { number: data.table.number })}
              data-testid="guide-table-number"
            >
              {data.table.number}
            </p>
          </section>
        ) : data.state === 'declined' ? (
          <section
            className="mt-3 rounded-[20px] border border-line bg-surface p-5"
            data-testid="guide-declined"
          >
            <h1 className="text-[20px] font-bold">{g.declined.title}</h1>
            <p className="mt-1.5 text-[14px] text-muted">{g.declined.body}</p>
            <a
              href={inviteUrl}
              className="mt-4 inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold"
              style={{ background: accent, color: accentInk }}
            >
              {g.declined.change}
            </a>
          </section>
        ) : (
          <section
            className="mt-3 rounded-[20px] border border-dashed border-line-strong bg-surface p-6 text-center"
            data-testid="guide-waiting"
          >
            <span
              aria-hidden
              className="mx-auto grid size-16 place-items-center rounded-full text-[26px] font-extrabold"
              style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}
            >
              ?
            </span>
            <h1 className="mt-3 text-[19px] font-bold">{g.waiting.title}</h1>
            <p className="mx-auto mt-1.5 max-w-[38ch] text-[14px] text-muted">{g.waiting.body}</p>
          </section>
        )}

        {data.state === 'seated' && data.table ? (
          <div className="mt-4">
            <GuideMap data={data} accent={accent} accentInk={accentInk} />
          </div>
        ) : null}

        {data.checkin && data.state !== 'declined' ? (
          <section
            aria-labelledby="guide-checkin"
            className="mt-4 rounded-[20px] border border-line bg-surface p-5 text-center"
            data-testid="guide-checkin"
          >
            <h2 id="guide-checkin" className="text-[16px] font-bold">
              {g.checkin.title}
            </h2>
            <p className="mx-auto mt-1 max-w-[36ch] text-[13.5px] text-muted">{g.checkin.body}</p>
            <div
              role="img"
              aria-label={g.checkin.qrLabel}
              className="mx-auto mt-4 w-[min(260px,72vw)] rounded-[14px] bg-white p-3 ring-1 ring-line [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              data-testid="guide-qr"
              data-code={data.checkin.code}
              dangerouslySetInnerHTML={{ __html: data.checkin.qr }}
            />
            {data.arrived > 0 ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-success">
                <CircleCheck aria-hidden className="size-4" />
                {plural(g.checkin.arrived, data.arrived, { total: Math.max(data.seats, data.arrived) })}
              </p>
            ) : null}
          </section>
        ) : null}

        <p
          role="status"
          className="mt-4 flex min-h-5 items-center justify-center gap-1.5 text-center text-[12.5px] text-muted"
          data-testid="guide-offline"
          data-state={offline}
        >
          {offline === 'offline' ? <WifiOff aria-hidden className="size-4" /> : null}
          {offline === 'saving'
            ? g.offline.saving
            : offline === 'saved'
              ? g.offline.saved
              : offline === 'offline'
                ? g.offline.offline
                : ''}
        </p>

        <footer className="mt-8 text-center text-[12px] leading-relaxed text-muted">
          {data.state !== 'declined' ? (
            <p>
              <a href={inviteUrl} className="font-semibold text-ink underline">
                {g.changeRsvp}
              </a>
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href="/privacy" target="_blank" rel="noopener" className="underline">
              {t.footer.privacy}
            </a>
            <a href="/accessibility" target="_blank" rel="noopener" className="underline">
              {t.footer.accessibility}
            </a>
          </p>
          <p className="mt-2 text-faint">{fill(t.footer.made, { brand })}</p>
        </footer>
      </div>
    </main>
  );
}
