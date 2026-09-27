'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Button, Card, cn, Hint, KpiCard } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';

/**
 * "5 minutes ago", counted in the browser: the page from the server has the exact time (the server's
 * clock and its ICU differ from the browser's — Node writes "לפני שעה (1)"), the browser then says how
 * long ago, and keeps it current every minute.
 */
export function Ago({ at, className }: { at: string; className?: string }) {
  const { relative, dateTime } = useAdminUi();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
  return (
    <time dateTime={at} title={dateTime(at)} className={className}>
      {now === null ? dateTime(at) : relative(at, now)}
    </time>
  );
}

/** A '{name}' template with elements in its places (the words around them stay text). */
export function fmtNode(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, i) => {
    const key = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <Fragment key={i}>{key && key in parts ? parts[key] : piece}</Fragment>;
  });
}

export interface Tile {
  id: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}

/**
 * A screen's numbers as tiles: two a row on a phone (like the host app's insights), four from 1024px.
 * A label too long for a phone's tile wraps instead of being cut (KpiCard truncates its label line).
 */
export function KpiGrid({ tiles, label }: { tiles: readonly Tile[]; label: string }) {
  return (
    <section aria-label={label}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.id} data-testid={`kpi-${tile.id}`} className="min-w-0">
            <KpiCard
              className="h-full"
              icon={tile.icon}
              label={<span className="whitespace-normal">{tile.label}</span>}
              value={<span className="break-words">{tile.value}</span>}
              sub={tile.sub}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The pieces the console's report screens share (cash flow, messages, Badook Events): a titled section
 * card, the "how the numbers are counted" lines, number formats, a pager and a customer's cell.
 */

export function Section({
  id,
  title,
  intro,
  actions,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card asChild className={cn('min-w-0', className)}>
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-[16px] font-bold text-ink">
              {title}
            </h2>
            {intro ? <p className="mt-0.5 text-[13px] text-muted">{intro}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </section>
    </Card>
  );
}

/** How the numbers on the screen are counted, one line each. */
export function Definitions({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <Card asChild className="min-w-0">
      <section aria-labelledby="definitions-title" className="p-4 sm:p-5" data-testid="definitions">
        <h2 id="definitions-title" className="text-[14px] font-bold text-ink">
          {title}
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-[12.5px] leading-[1.55] text-muted">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

/** Money, percentages, days and months as the console writes them. */
export function useReportFormat() {
  const { number, money, date } = useAdminUi();
  // (the fraction digits spelled out: ICU builds differ in the currency's default, server and browser)
  const compactMoney = (n: number) =>
    number(n, {
      style: 'currency',
      currency: 'ILS',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  return {
    /** to the agora: ₪39.20 */
    exact: (n: number) =>
      number(n, { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    /** a tile's value: whole shekels, short above ₪100K */
    money: (n: number) => (Math.abs(n) >= 100_000 ? compactMoney(n) : money(n)),
    compactMoney,
    usd: (n: number) =>
      number(n, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: (x: number | null, digits = 1) =>
      x === null ? '—' : number(x, { style: 'percent', maximumFractionDigits: digits }),
    signedPct: (x: number) =>
      number(x, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
    count: (n: number) => number(n),
    compactCount: (n: number) =>
      number(n, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }),
    /** 27.9 */
    dayShort: (day: string) => date(day, { day: 'numeric', month: 'numeric' }),
    /** 27 Sep (no weekday: the server's and the browser's ICU punctuate it differently) */
    dayLong: (day: string) => date(day, { day: 'numeric', month: 'short' }),
    /** Sep 2026 */
    month: (month: string) => date(`${month}-01`, { month: 'short', year: 'numeric' }),
  };
}

/** Previous / next page links with where they lead. */
export function Pager({
  page,
  pages,
  href,
  label,
  previousHelp,
  nextHelp,
}: {
  page: number;
  pages: number;
  href(page: number): string;
  label: string;
  previousHelp: string;
  nextHelp: string;
}) {
  const { t, dir } = useAdminUi();
  if (pages <= 1) return null;
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-between gap-3">
      <Hint text={previousHelp}>
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm" icon={<Prev />}>
            <Link href={href(page - 1)} scroll={false}>
              {t.common.previous}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" icon={<Prev />} disabled>
            {t.common.previous}
          </Button>
        )}
      </Hint>
      <span className="text-[13px] text-muted tabular-nums">{label}</span>
      <Hint text={nextHelp}>
        {page < pages ? (
          <Button asChild variant="secondary" size="sm" icon={<Next />}>
            <Link href={href(page + 1)} scroll={false}>
              {t.common.next}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" icon={<Next />} disabled>
            {t.common.next}
          </Button>
        )}
      </Hint>
    </nav>
  );
}

/** A customer: their name, linked to their page in the console, and their email (masked by role). */
export function PersonCell({
  userId,
  name,
  email,
  fallback,
  missing,
  openLabel,
}: {
  userId: string | null;
  name: string | null;
  email: string | null;
  /** when they have no name */
  fallback: string;
  /** when the account is gone */
  missing?: string;
  openLabel: string;
}) {
  if (!userId) return <span className="text-muted">{missing ?? fallback}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={`/app/admin/users/${userId}`}
        title={openLabel}
        className="truncate rounded-[4px] font-medium text-ink underline-offset-2 hover:underline"
      >
        {name || fallback}
      </Link>
      {email ? (
        <span className="block truncate text-[12px] text-muted">
          <bdi dir="ltr">{email}</bdi>
        </span>
      ) : null}
    </span>
  );
}
