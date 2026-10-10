'use client';

import { CalendarClock, Clock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Input, Segmented, Select, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import {
  allTimeZones,
  deviceTimeZone,
  isTimeZone,
  localExists,
  localMoment,
  localParts,
  zoneCity,
} from '../time';
import type { Audience, ScheduledSend, ScheduleView, SendKind } from '../types';

/**
 * "Schedule for later" in a send dialog (the gallery link, the album's thank-you): a date, a time and
 * the time zone they are on — the event's by default, the host's own one tap away, any other in the
 * list — and to whom. Before it is saved the host sees what the moment is on each clock that matters
 * ("15:00 New York time · the event's time (Jerusalem): 22:00 · your time: …"), so a time picked on one
 * clock is never read on another. The send waiting shows with its time zone, to change or take back;
 * the last one's outcome stays.
 */
export function ScheduleSend({ invitationId, kind }: { invitationId: string; kind: SendKind }) {
  const { t, fmt, plural, number, locale } = useUi();
  const S = t.schedule;
  const { toast } = useToast();
  const endpoint = `/api/invitations/${invitationId}/schedule`;
  const [view, setView] = useState<ScheduleView | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await hostApi<ScheduleView>(endpoint);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.ok && res.body) setView(res.body);
  }, [endpoint]);
  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => deviceTimeZone(), []);
  const eventZone = view?.timeZone ?? 'Asia/Jerusalem';
  const sends = useMemo(() => (view?.sends ?? []).filter((s) => s.kind === kind), [view, kind]);
  const waiting = sends.find((s) => s.status === 'scheduled' || s.status === 'running') ?? null;
  const last = sends.find((s) => s.status === 'done' || s.status === 'failed') ?? null;

  // the form: tomorrow at 10:00 on the event's clock, to start with
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [zone, setZone] = useState('');
  const [audience, setAudience] = useState<Audience>('unsent');
  const start = (from: ScheduledSend | null) => {
    const tomorrow = localParts(new Date(Date.now() + 86_400_000), eventZone).date;
    setDate(from?.date ?? tomorrow);
    setTime(from?.time ?? '10:00');
    setZone(from?.timeZone ?? eventZone);
    setAudience(from?.audience ?? 'unsent');
    setError(null);
    setEditing(true);
  };

  const when = (at: Date, tz: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(at);

  const zones = useMemo(() => {
    const first = [eventZone, ...(mine && mine !== eventZone ? [mine] : [])];
    return { first, rest: allTimeZones().filter((z) => !first.includes(z)) };
  }, [eventZone, mine]);

  const valid = !!date && !!time && isTimeZone(zone) && localExists(date, time, zone);
  const moment = valid ? localMoment(date, time, zone) : null;
  const past = !!moment && moment.getTime() < Date.now() + 60_000;

  const save = async () => {
    if (!valid || past) return;
    setBusy(true);
    setError(null);
    const res = await hostApi<{ code?: string }>(endpoint, {
      method: 'POST',
      body: { kind, date, time, timeZone: zone, audience },
    });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) {
      const code = res.body?.code as keyof typeof S.errors | undefined;
      setError(code && code in S.errors ? S.errors[code] : S.errors.failed);
      return;
    }
    toast({ variant: 'success', title: S.saved });
    setEditing(false);
    await load();
  };

  const cancel = async () => {
    setBusy(true);
    const res = await hostApi(endpoint, { method: 'DELETE', body: { kind } });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ variant: 'danger', title: S.errors.failed });
    toast({ variant: 'success', title: S.canceled });
    await load();
  };

  if (!view) return null;
  const tid = `schedule-${kind}`;

  /** "Thu, 17 Jun 2027, 15:00" on a send's own clock, and on the event's when that is another one. */
  const sendTime = (s: ScheduledSend) => when(new Date(s.runAt), s.timeZone);

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-3" data-testid={tid}>
      {waiting && !editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-input bg-info-bg px-3 py-2.5">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-info" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-semibold" data-testid={`${tid}-waiting`}>
              {waiting.status === 'running'
                ? S.running
                : fmt(S.scheduled, { when: sendTime(waiting), city: zoneCity(waiting.timeZone) })}
            </p>
            <p className="text-[12px] text-muted">
              {S.scheduledFor[waiting.audience]}
              {waiting.timeZone !== eventZone
                ? ` · ${fmt(S.alsoEvent, { city: zoneCity(eventZone), when: when(new Date(waiting.runAt), eventZone) })}`
                : ''}
            </p>
          </div>
          {waiting.status === 'scheduled' ? (
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => start(waiting)}>
                {S.change}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<X />}
                loading={busy}
                onClick={() => void cancel()}
                data-testid={`${tid}-cancel`}
              >
                {S.cancel}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {last && !editing ? (
        <p
          className={`text-[12.5px] ${last.status === 'failed' ? 'text-warning' : 'text-muted'}`}
          data-testid={`${tid}-last`}
        >
          {last.status === 'done'
            ? plural(S.done, Number(last.result?.queued ?? 0), {
                n: number(Number(last.result?.queued ?? 0)),
                when: sendTime(last),
              })
            : fmt(S.failed, {
                when: sendTime(last),
                reason: S.reasons[(last.error ?? 'other') as keyof typeof S.reasons] ?? S.reasons.other,
              })}
        </p>
      ) : null}

      {!waiting && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Clock />}
            onClick={() => start(null)}
            data-testid={`${tid}-open`}
          >
            {S.open}
          </Button>
          <span className="text-[12px] text-muted">{S.openHint}</span>
        </div>
      ) : null}

      {editing ? (
        <div
          className="flex flex-col gap-3 rounded-[14px] border border-line p-3"
          data-testid={`${tid}-form`}
        >
          <p className="text-[13.5px] font-semibold">{S.title}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold">{S.date}</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                dir="ltr"
                data-testid={`${tid}-date`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold">{S.time}</span>
              <Input
                type="time"
                value={time}
                step={60}
                onChange={(e) => setTime(e.target.value.slice(0, 5))}
                dir="ltr"
                data-testid={`${tid}-time`}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold">{S.zone}</span>
            <Select value={zone} onChange={(e) => setZone(e.target.value)} data-testid={`${tid}-zone`}>
              {zones.first.map((z) => (
                <option key={z} value={z}>
                  {fmt(z === eventZone ? S.zoneEvent : S.zoneMine, { city: zoneCity(z) })}
                </option>
              ))}
              <optgroup label={S.zoneOther}>
                {zones.rest.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </optgroup>
            </Select>
          </label>
          <div>
            <span className="mb-1 block text-[12.5px] font-semibold">{S.audience}</span>
            <Segmented<Audience>
              label={S.audience}
              value={audience}
              onValueChange={setAudience}
              options={[
                { value: 'unsent', label: S.audienceUnsent },
                { value: 'all', label: S.audienceAll },
              ]}
            />
          </div>

          {/* the moment on every clock that matters: the one picked, the event's, the host's own */}
          {moment ? (
            <div className="rounded-input bg-subtle px-3 py-2 text-[12.5px]" data-testid={`${tid}-preview`}>
              <p className="font-semibold">
                {fmt(S.willSend, { when: when(moment, zone), city: zoneCity(zone) })}
              </p>
              {zone !== eventZone ? (
                <p>{fmt(S.alsoEvent, { city: zoneCity(eventZone), when: when(moment, eventZone) })}</p>
              ) : null}
              {mine && mine !== zone && mine !== eventZone ? (
                <p>{fmt(S.alsoMine, { city: zoneCity(mine), when: when(moment, mine) })}</p>
              ) : null}
            </div>
          ) : date && time && isTimeZone(zone) ? (
            <p className="text-[12.5px] text-warning">{S.errors.no_such_time}</p>
          ) : null}
          {past ? <p className="text-[12.5px] text-warning">{S.errors.past}</p> : null}
          {error ? (
            <p role="alert" className="text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {S.back}
            </Button>
            <Button
              size="sm"
              icon={<CalendarClock />}
              disabled={!valid || past}
              loading={busy}
              onClick={() => void save()}
              data-testid={`${tid}-save`}
            >
              {S.save}
            </Button>
          </div>
          {waiting ? (
            <Badge variant="info" className="self-start">
              {fmt(S.scheduled, { when: sendTime(waiting), city: zoneCity(waiting.timeZone) })}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
