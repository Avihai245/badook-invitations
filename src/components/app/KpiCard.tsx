import type { ReactNode } from 'react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn, iconSlot } from './utils';

export type KpiCardProps = {
  label: ReactNode;
  /** Pre-formatted value (numbers via Intl), e.g. `184` or `9 ימים`. */
  value?: ReactNode;
  /** Secondary line, e.g. `152 מבוגרים · 32 ילדים`. */
  sub?: ReactNode;
  /** 15px icon before the label. */
  icon?: ReactNode;
  /** Keeps the card's exact size with skeletons in place of value and sub line. */
  loading?: boolean;
  className?: string;
};

/** app.html `.kpi`: padding 18; label 13px muted + icon (gap 6); value 30px/700 tabular (-.02em); sub 12px muted. */
export function KpiCard({ label, value, sub, icon, loading = false, className }: KpiCardProps) {
  return (
    <Card padding="md" className={className} aria-busy={loading || undefined}>
      <dl>
        <dt className="flex items-center gap-1.5 text-[13px] text-muted">
          {icon != null && (
            <span aria-hidden className={cn(iconSlot, '[&_svg]:size-[15px]')}>
              {icon}
            </span>
          )}
          <span className="truncate">{label}</span>
        </dt>
        {loading ? (
          <>
            <dd className="mt-1.5 flex h-[45px] items-center">
              <Skeleton shape="line" width={96} height={28} radius={6} />
            </dd>
            <dd className="mt-0.5 flex h-[18px] items-center">
              <Skeleton shape="line" width={128} height={10} />
            </dd>
          </>
        ) : (
          <>
            <dd className="mt-1.5 text-[30px] font-bold tracking-[-0.02em] tabular-nums">{value}</dd>
            {sub != null && <dd className="mt-0.5 text-[12px] text-muted">{sub}</dd>}
          </>
        )}
      </dl>
    </Card>
  );
}
