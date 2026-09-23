'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { Locale } from '../../contracts/types';
import { t } from '../../i18n/dictionary';
import { countdownParts, countdownPhase } from '../../lib/countdown';

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

/** Ticks every second; after the target shows the `afterEvent` text (the server hides it after +24h). */
export function Countdown({
  targetMs,
  initialNow,
  locale,
  afterText,
}: {
  targetMs: number;
  initialNow: number;
  locale: Locale;
  afterText: string;
}) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (countdownPhase(targetMs, now) !== 'counting') {
    return (
      <p className="sec-body reveal" style={{ '--i': 2 } as CSSProperties}>
        {afterText}
      </p>
    );
  }
  const parts = countdownParts(targetMs, now);
  return (
    <div className="cd reveal" style={{ '--i': 2 } as CSSProperties} role="timer" aria-live="off">
      {UNITS.map((u) => (
        <div className="cd-cell" key={u}>
          <div className="cd-num" suppressHydrationWarning>
            {String(parts[u]).padStart(2, '0')}
          </div>
          <div className="cd-lbl" suppressHydrationWarning>
            {t(locale, `countdown.${u}`, { n: parts[u] })}
          </div>
        </div>
      ))}
    </div>
  );
}
