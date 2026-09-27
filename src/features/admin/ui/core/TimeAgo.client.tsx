'use client';

import { useEffect, useState } from 'react';
import { useAdminUi } from '../AdminUi.client';

/** The clock the console's relative times read ("5 minutes ago"): it moves on every 30 seconds. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** "לפני 5 דקות", with the exact time (Israel's) for a mouse and for screen readers. */
export function TimeAgo({ at, className }: { at: string; className?: string }) {
  const { relative, dateTime } = useAdminUi();
  const now = useNow();
  return (
    <time dateTime={at} title={dateTime(at)} className={className} suppressHydrationWarning>
      {relative(at, now)}
    </time>
  );
}
