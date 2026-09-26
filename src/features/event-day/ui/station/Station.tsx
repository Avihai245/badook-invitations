'use client';

import { Camera, CircleCheck, Globe, Minus, PencilLine, Plus, Search, Undo2, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Dialog } from '@/components/app';
import { useLiveRefresh } from '@/lib/live/client';
import type { RealtimeInfo } from '@/lib/live/types';
import { codeFromScan } from '../../codes';
import { EVENT_DAY } from '../../config';
import type { Party, RecentCheckin, Totals } from '../../model';
import type { StationPageData } from '../../server/pages';
import { DayTextProvider, fill, useDayText, type GuestLocale } from '../guest-text';
import { stationApi, type ArriveAnswer, type PartyAnswer, type StationState } from './api';
import { startScanner, type Scanner, type ScanError } from './scanner';

/**
 * The entrance station (/e/<slug>/station?t=<the station link>): a phone or tablet at the door, no
 * account. Scan the QR on a guest's table guide (or printed card), or search by name or phone; the
 * family's card shows its table and who already arrived; check in all of them or part; undo. The
 * hall's numbers and the latest arrivals — from every station — update live.
 */
export function Station({
  data,
  token,
  lang,
}: {
  data: StationPageData;
  token: string;
  lang: GuestLocale | null;
}) {
  const initial: GuestLocale = lang && data.event.locales.includes(lang) ? lang : data.event.defaultLocale;
  const [locale, setLocale] = useState<GuestLocale>(initial);
  return (
    <DayTextProvider locale={locale}>
      <StationBody
        data={data}
        token={token}
        other={data.event.locales.find((l) => l !== locale) ?? null}
        onLocale={setLocale}
      />
    </DayTextProvider>
  );
}

type Done = { checkinId: string; party: Party };

function StationBody({
  data,
  token,
  other,
  onLocale,
}: {
  data: StationPageData;
  token: string;
  other: GuestLocale | null;
  onLocale(l: GuestLocale): void;
}) {
  const { t, locale, plural, number, date } = useDayText();
  const s = t.station;
  const title = data.event.titles[locale] || data.event.title;
  const [totals, setTotals] = useState<Totals>(data.totals);
  const [recent, setRecent] = useState<RecentCheckin[]>(data.recent);
  const [realtime, setRealtime] = useState<RealtimeInfo | null>(data.realtime);
  const [gone, setGone] = useState(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<{ text: string; tone: 'danger' | 'muted' } | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Party[] | null>(null);
  const [station, setStation] = useState(s.nameDefault);
  const [renaming, setRenaming] = useState(false);
  const nameKey = `badook-station:${data.slug}`;

  // this device's station name
  useEffect(() => {
    try {
      const saved = localStorage.getItem(nameKey);
      if (saved) setStation(saved);
    } catch {
      // private mode: the default name
    }
  }, [nameKey]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  const fail = useCallback(
    (status: number) => {
      if (status === 404) setGone(true);
      else setNotice({ text: status === 429 ? s.rate : status === 0 ? s.offline : s.failed, tone: 'danger' });
    },
    [s],
  );

  // ── the hall's numbers and the latest arrivals (live) ──
  const refresh = useCallback(async () => {
    const res = await stationApi<StationState>('station', { t: token });
    if (res.status === 404) return setGone(true);
    if (!res.body?.ok) return;
    setTotals(res.body.totals);
    setRecent(res.body.recent);
    setRealtime(res.body.realtime);
  }, [token]);
  const live = useLiveRefresh(gone ? null : realtime, () => void refresh(), EVENT_DAY.pollStationMs);

  // ── a family's card ──
  const openParty = (p: Party) => {
    setParty(p);
    setDone(null);
    setCount(Math.max(1, p.seats - p.arrived));
    setNotice(null);
  };
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const onScan = useCallback(
    async (text: string) => {
      const code = codeFromScan(text);
      const now = Date.now();
      if (!code) {
        setNotice({ text: s.notACode, tone: 'danger' });
        return;
      }
      // the same guest still in front of the camera
      if (lastCode.current?.code === code && now - lastCode.current.at < EVENT_DAY.rescanMs) return;
      lastCode.current = { code, at: now };
      navigator.vibrate?.(40);
      const res = await stationApi<PartyAnswer>('find', { t: token, code });
      if (res.body?.ok) {
        setScanning(false);
        openParty(res.body.party);
      } else if (res.body?.code === 'unknown_code') setNotice({ text: s.unknownCode, tone: 'danger' });
      else fail(res.status);
    },
    [token, s, fail],
  );

  // ── search ──
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await stationApi<{ parties: Party[] }>('search', { t: token, q }, ctl.signal);
        if (res.body?.ok) setResults(res.body.parties);
        else fail(res.status);
      } catch {
        // a newer query took its place
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [query, token, fail]);

  const checkIn = async () => {
    if (!party || busy) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const res = await stationApi<ArriveAnswer>('arrive', {
      t: token,
      id,
      unitId: party.unitId,
      count,
      station,
    });
    setBusy(false);
    if (!res.body?.ok) return fail(res.status);
    navigator.vibrate?.([30, 40, 30]);
    setDone({ checkinId: res.body.checkinId, party: res.body.party });
    setParty(res.body.party);
    setTotals(res.body.totals);
    setResults(
      (list) => list?.map((p) => (p.unitId === res.body!.party.unitId ? res.body!.party : p)) ?? null,
    );
    void refresh();
  };
  const undo = async (checkinId: string) => {
    const res = await stationApi<{ party: Party; totals: Totals }>('undo', { t: token, id: checkinId });
    if (!res.body?.ok) return fail(res.status);
    setTotals(res.body.totals);
    if (party?.unitId === res.body.party.unitId) setParty(res.body.party);
    setDone(null);
    setNotice({ text: s.undone, tone: 'muted' });
    void refresh();
  };
  const closeCard = () => {
    setParty(null);
    setDone(null);
  };

  const saveName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get('station') ?? '')
      .trim()
      .slice(0, EVENT_DAY.stationNameLength);
    const name = value || s.nameDefault;
    setStation(name);
    setRenaming(false);
    try {
      localStorage.setItem(nameKey, name);
    } catch {
      // private mode: for this visit only
    }
  };

  if (gone)
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-6" data-testid="station-gone">
        <div className="max-w-[420px] text-center">
          <h1 className="text-[20px] font-bold">{s.gone.title}</h1>
          <p className="mt-2 text-[14px] text-muted">{s.gone.body}</p>
        </div>
      </main>
    );

  const pct = totals.expected ? Math.min(100, Math.round((totals.arrived / totals.expected) * 100)) : 0;
  const timeOf = (at: string) => date(at, { hour: '2-digit', minute: '2-digit' });
  const stationLabel = (name: string) => (name === 'host' ? s.host : name);

  return (
    <main className="min-h-dvh bg-canvas pb-[max(24px,env(safe-area-inset-bottom))]" data-testid="station">
      <div className="mx-auto w-full max-w-[640px] px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">{s.eyebrow}</p>
            <h1 className="truncate text-[18px] font-bold" lang={locale}>
              <bdi>{title}</bdi>
            </h1>
            <p
              className={`mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium ${live === 'live' ? 'text-success' : 'text-muted'}`}
              data-testid="station-live"
              data-state={live}
            >
              <span
                aria-hidden
                className={`size-2 rounded-full ${live === 'live' ? 'bg-success' : 'bg-faint'}`}
              />
              {live === 'live' ? s.live : s.polling}
            </p>
          </div>
          {other ? (
            <button
              type="button"
              onClick={() => onLocale(other)}
              lang={other}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
            >
              <Globe aria-hidden className="size-4" />
              {t.otherLanguage}
            </button>
          ) : null}
        </header>

        {!online ? (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning"
          >
            <WifiOff aria-hidden className="size-4 shrink-0" />
            {s.offline}
          </p>
        ) : null}

        <section className="mt-4 rounded-[18px] border border-line bg-surface p-4" aria-live="polite">
          <p className="text-[22px] font-bold" data-testid="station-arrived">
            {fill(s.arrived, { arrived: number(totals.arrived), expected: number(totals.expected) })}
          </p>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#dcfce7]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totals.expected}
            aria-valuenow={totals.arrived}
            aria-label={fill(s.arrived, {
              arrived: number(totals.arrived),
              expected: number(totals.expected),
            })}
          >
            <div
              className="h-full rounded-full bg-[#15803d] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {plural(s.parties, totals.arrivedParties, { total: number(totals.parties) })}
          </p>
        </section>

        {scanning ? (
          <ScanPanel onText={(text) => void onScan(text)} onClose={() => setScanning(false)} />
        ) : (
          <div className="mt-4">
            <Button
              size="lg"
              className="h-14 w-full text-[16px]"
              icon={<Camera />}
              onClick={() => {
                setNotice(null);
                setScanning(true);
              }}
              data-testid="station-scan"
            >
              {s.scan}
            </Button>
            <p className="mt-1.5 text-center text-[12.5px] text-muted">{s.scanHint}</p>
          </div>
        )}
        {notice ? (
          <p
            role={notice.tone === 'danger' ? 'alert' : 'status'}
            className={`mt-3 rounded-[12px] px-3 py-2 text-[13.5px] ${notice.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-subtle text-ink'}`}
            data-testid="station-notice"
          >
            {notice.text}
          </p>
        ) : null}

        <section className="mt-5" aria-labelledby="station-search">
          <label id="station-search" htmlFor="station-q" className="text-[14px] font-bold">
            {s.search}
          </label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="station-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.searchPlaceholder}
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 w-full rounded-[12px] border border-line bg-surface ps-9 pe-3 text-[16px] focus:border-ink focus:shadow-ring focus:outline-hidden"
              data-testid="station-search"
            />
          </div>
          {results ? (
            results.length ? (
              <ul
                className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface"
                data-testid="station-results"
              >
                {results.map((p) => (
                  <li key={p.unitId}>
                    <button
                      type="button"
                      onClick={() => openParty(p)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-start hover:bg-subtle"
                      data-party={p.name}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          <bdi>{p.name}</bdi>
                          {p.phoneTail ? (
                            <span className="ms-1.5 text-[12px] font-normal text-muted" dir="ltr">
                              ··{p.phoneTail}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-[12.5px] text-muted">
                          {p.table ? fill(s.table, { number: p.table.number }) : s.noTable} ·{' '}
                          {plural(s.expected, p.seats)}
                          {p.arrived ? ` · ${plural(s.arrivedSoFar, p.arrived)}` : ''}
                        </span>
                      </span>
                      {p.arrived >= p.seats && p.seats > 0 ? (
                        <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted">{s.noResults}</p>
            )
          ) : null}
        </section>

        <section className="mt-6" aria-labelledby="station-recent">
          <h2 id="station-recent" className="text-[14px] font-bold">
            {s.recent}
          </h2>
          {recent.length ? (
            <ul
              className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface"
              data-testid="station-recent"
            >
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      <bdi>{r.name}</bdi> <span className="font-normal text-muted">· {number(r.count)}</span>
                    </span>
                    <span className="block text-[12px] text-muted">
                      {fill(s.at, { time: timeOf(r.at), station: stationLabel(r.station) })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void undo(r.id)}
                    aria-label={fill(s.undoOne, { name: r.name })}
                    className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-subtle hover:text-ink"
                  >
                    <Undo2 aria-hidden className="icon-dir size-4" />
                    {s.undo}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-muted">{s.recentEmpty}</p>
          )}
        </section>

        <section className="mt-6 rounded-[14px] border border-line bg-surface p-3.5">
          {renaming ? (
            <form onSubmit={saveName} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-[13px] font-semibold">
                {s.name}
                <input
                  name="station"
                  defaultValue={station}
                  maxLength={EVENT_DAY.stationNameLength}
                  className="mt-1 h-11 w-full rounded-[10px] border border-line px-3 text-[15px] font-normal"
                  autoFocus
                />
              </label>
              <Button type="submit">{s.save}</Button>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[13px]">
                <span className="text-muted">{s.name}: </span>
                <bdi className="font-semibold" data-testid="station-name">
                  {station}
                </bdi>
              </p>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-subtle hover:text-ink"
              >
                <PencilLine aria-hidden className="size-4" />
                {s.rename}
              </button>
            </div>
          )}
          <p className="mt-1 text-[12px] text-muted">{s.nameHelp}</p>
        </section>
      </div>

      {party ? (
        <Dialog
          open
          onOpenChange={(open) => !open && closeCard()}
          title={<bdi>{party.name}</bdi>}
          description={party.people.length ? party.people.join(' · ') : undefined}
          closeLabel={s.close}
          className="max-w-[440px]"
        >
          <div data-testid="party-card">
            {done ? (
              <div className="day-pop text-center" data-testid="party-done">
                <CircleCheck aria-hidden className="mx-auto size-12 text-success" />
                <p className="mt-2 text-[20px] font-bold">{s.welcome}</p>
                <p className="mt-1 text-[34px] font-extrabold" data-testid="party-done-table">
                  {done.party.table ? fill(s.welcomeTable, { number: done.party.table.number }) : ''}
                </p>
                {!done.party.table ? <p className="text-[14px] text-warning">{s.welcomeNoTable}</p> : null}
                <div className="mt-5 flex gap-2">
                  <Button
                    variant="secondary"
                    icon={<Undo2 className="icon-dir" />}
                    onClick={() => void undo(done.checkinId)}
                    className="flex-1"
                  >
                    {s.undo}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      closeCard();
                      setQuery('');
                      setScanning(true);
                    }}
                    data-testid="party-next"
                  >
                    {s.next}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-[14px] bg-subtle px-4 py-3">
                  <p className="text-[26px] font-extrabold" data-testid="party-table">
                    {party.table ? fill(s.table, { number: party.table.number }) : s.noTable}
                  </p>
                  {party.table?.label ? (
                    <p className="truncate text-[13px] text-muted">{party.table.label}</p>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] text-muted">
                  {plural(s.expected, party.seats)}
                  {party.phoneTail ? <span dir="ltr"> · ··{party.phoneTail}</span> : null}
                </p>
                {party.status !== 'confirmed' ? (
                  <p className="mt-1 text-[13px] font-semibold text-warning">
                    {party.status === 'declined' ? s.declined : s.notReplied}
                  </p>
                ) : null}
                {party.checkins.length ? (
                  <ul className="mt-2 text-[13px]" data-testid="party-arrivals">
                    {party.checkins.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span>
                          <span className="font-semibold text-success">
                            {plural(s.arrivedSoFar, c.count)}
                          </span>{' '}
                          <span className="text-muted">
                            ({fill(s.at, { time: timeOf(c.at), station: stationLabel(c.station) })})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void undo(c.id)}
                          className="text-[12.5px] font-semibold text-muted underline"
                        >
                          {s.undo}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold">{s.arrivingNow}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={s.less}
                      onClick={() => setCount((n) => Math.max(1, n - 1))}
                      disabled={count <= 1}
                      className="grid size-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40"
                    >
                      <Minus aria-hidden className="size-5" />
                    </button>
                    <output
                      className="w-10 text-center text-[22px] font-bold tabular-nums"
                      data-testid="party-count"
                      aria-live="polite"
                    >
                      {count}
                    </output>
                    <button
                      type="button"
                      aria-label={s.more}
                      onClick={() => setCount((n) => Math.min(EVENT_DAY.maxCount, n + 1))}
                      className="grid size-11 place-items-center rounded-full border border-line bg-surface"
                    >
                      <Plus aria-hidden className="size-5" />
                    </button>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="mt-4 h-13 w-full text-[16px]"
                  onClick={() => void checkIn()}
                  disabled={busy}
                  data-testid="party-checkin"
                >
                  {plural(s.checkIn, count)}
                </Button>
              </>
            )}
          </div>
        </Dialog>
      ) : null}
    </main>
  );
}

/** The camera, reading codes until closed. */
function ScanPanel({ onText, onClose }: { onText(text: string): void; onClose(): void }) {
  const { t } = useDayText();
  const s = t.station;
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  useEffect(() => {
    let scanner: Scanner | null = null;
    let live = true;
    void startScanner(
      video.current!,
      (text) => onTextRef.current(text),
      (e) => live && setError(e),
    ).then((sc) => {
      if (live) scanner = sc;
      else sc.stop();
    });
    return () => {
      live = false;
      scanner?.stop();
    };
  }, []);
  return (
    <section className="mt-4 overflow-hidden rounded-[18px] bg-ink text-white" data-testid="station-camera">
      <div className="relative aspect-[4/3] w-full">
        <video
          ref={video}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
          aria-hidden
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-[58%] rounded-[18px] border-[3px] border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[13px]" role="status">
          {error === 'denied'
            ? s.cameraDenied
            : error === 'unavailable'
              ? s.cameraUnavailable
              : error === 'failed'
                ? s.scanLoadFailed
                : s.scanning}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[13.5px] font-semibold"
          data-testid="station-camera-close"
        >
          <X aria-hidden className="size-4" />
          {s.stopScan}
        </button>
      </div>
    </section>
  );
}
