'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, cn } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';

/**
 * The change of a count against the period before it: up, down, the same — or from nothing. null when
 * both are zero (nothing to say).
 */
export function change(
  now: number,
  before: number,
): { dir: 'up' | 'down' | 'same'; pct: number | null } | null {
  if (now === 0 && before === 0) return null;
  if (before === 0) return { dir: 'up', pct: null };
  if (now === before) return { dir: 'same', pct: 0 };
  return { dir: now > before ? 'up' : 'down', pct: Math.abs(now - before) / before };
}

/**
 * A number of the overview with what it means (app.html `.kpi`): its label and icon, the value, a
 * line under it — and how it changed against the period before (an arrow and words, never color
 * alone: up is good here unless `upIsBad`).
 */
export function Stat({
  label,
  icon,
  value,
  sub,
  delta,
  vs,
  vsZero,
  format,
  upIsBad = false,
  children,
  testId,
}: {
  label: ReactNode;
  icon: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** now and before, for the change */
  delta?: { now: number; before: number } | null;
  /** what the change is against ("vs. the 7 days before") */
  vs?: string;
  /** instead of `vs` when the period before had none ("the 7 days before: none") */
  vsZero?: string;
  /** how the rise from nothing is written (default: a number; money: ₪) */
  format?: (n: number) => string;
  upIsBad?: boolean;
  children?: ReactNode;
  testId?: string;
}) {
  const { t, number, fmt } = useAdminUi();
  const c = delta ? change(delta.now, delta.before) : null;
  const fromZero = c?.pct === null;
  const good = c && c.dir !== 'same' ? (c.dir === 'up') !== upIsBad : null;
  const Arrow = c?.dir === 'up' ? ArrowUpRight : c?.dir === 'down' ? ArrowDownRight : Minus;
  const words = !c
    ? null
    : c.pct === null
      ? fmt(t.overview.change.fromZero, { n: (format ?? number)(delta!.now) })
      : c.dir === 'same'
        ? t.overview.change.same
        : fmt(c.dir === 'up' ? t.overview.change.up : t.overview.change.down, {
            pct: number(c.pct, { style: 'percent', maximumFractionDigits: c.pct < 0.1 ? 1 : 0 }),
          });
  return (
    <Card padding="md" className="flex min-w-0 flex-col" data-testid={testId}>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-deep [&_svg]:size-[15px]"
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="mt-2 text-[30px] leading-[1.35] font-bold tracking-[-0.02em] tabular-nums" data-value="">
        {value}
      </p>
      {words ? (
        <p
          className={cn(
            'mt-0.5 flex flex-wrap items-center gap-x-1 text-[12.5px]',
            good === null ? 'text-muted' : good ? 'text-success' : 'text-danger',
          )}
        >
          <Arrow aria-hidden className="size-3.5 shrink-0 rtl:-scale-x-100" strokeWidth={2.25} />
          <span className="font-semibold">{words}</span>
          {fromZero && vsZero ? (
            <span className="text-muted">· {vsZero}</span>
          ) : vs ? (
            <span className="text-muted">{vs}</span>
          ) : null}
        </p>
      ) : null}
      {sub ? <p className="mt-1.5 text-[12.5px] leading-[1.5] text-muted">{sub}</p> : null}
      {children}
    </Card>
  );
}
