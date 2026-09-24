'use client';

import { CalendarCheck2, CalendarHeart, PartyPopper } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/** Whole days from the visitor's own today to an event date (YYYY-MM-DD): 0 = today, negative = past. */
export function daysUntilEvent(date: string, now: Date): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

export type CountdownState = { kind: 'today' } | { kind: 'days'; n: number } | { kind: 'past' };

/** 0 → today ("Today!"), 1… → days to go (1 = tomorrow), below 0 → the event has passed. */
export function countdownState(days: number): CountdownState {
  if (days === 0) return { kind: 'today' };
  return days > 0 ? { kind: 'days', n: days } : { kind: 'past' };
}

/**
 * The visitor's today, known only after mounting (the server doesn't know their time zone); null
 * during the server render and hydration, so both render the same.
 */
export function useToday(): Date | null {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  return today;
}

/** The countdown's words: "היום!" / "מחר" / "בעוד 12 ימים" / "האירוע עבר". */
export function useCountdownLabel(date: string): { state: CountdownState; label: string } | null {
  const { t, plural, number } = useUi();
  const today = useToday();
  if (!today) return null;
  const state = countdownState(daysUntilEvent(date, today));
  const label =
    state.kind === 'today'
      ? t.list.countdown.today
      : state.kind === 'days'
        ? plural(t.list.countdown.days, state.n, { n: number(state.n) })
        : t.list.past;
  return { state, label };
}

/**
 * Days to the event as a chip: on a poster (over the picture) or in a line of text. The day itself is
 * celebrated; a past event says so quietly.
 */
export function CountdownChip({
  date,
  variant = 'inline',
  className,
}: {
  date: string;
  variant?: 'poster' | 'inline';
  className?: string;
}) {
  const countdown = useCountdownLabel(date);
  if (!countdown) return null;
  const { state, label } = countdown;
  const Icon = state.kind === 'today' ? PartyPopper : state.kind === 'past' ? CalendarCheck2 : CalendarHeart;
  const poster = variant === 'poster';
  // one background and one text color per state (class order doesn't decide which of two wins)
  const tone =
    state.kind === 'today'
      ? 'bg-brand text-white'
      : state.kind === 'past'
        ? poster
          ? 'bg-surface/90 text-muted'
          : 'bg-subtle text-muted'
        : poster
          ? 'bg-surface/90 text-ink'
          : 'bg-brand-soft text-brand-deep';
  return (
    <span
      data-countdown={state.kind}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        poster ? 'px-2 py-0.5 text-[11.5px] shadow-sm backdrop-blur' : 'px-2.5 py-0.5 text-[12px]',
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-3.5 shrink-0', state.kind === 'days' && 'text-brand')} />
      {label}
    </span>
  );
}
