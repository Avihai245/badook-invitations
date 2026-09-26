'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { Locale } from '../../contracts/types';
import { t } from '../../i18n/dictionary';
import { countdownParts, countdownPhase } from '../../lib/countdown';

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

/**
 * One digit that rolls when it changes (invitation.css `.cd-d`): the old one drops out while the new
 * one comes down into place. The first render — the server's, and hydration's — is the plain digit.
 */
function Digit({ ch }: { ch: string }) {
  const [roll, setRoll] = useState<{ cur: string; old: string | null; n: number }>({
    cur: ch,
    old: null,
    n: 0,
  });
  // a new digit: remember the one leaving (state derived during render — no extra paint)
  if (roll.cur !== ch) setRoll({ cur: ch, old: roll.cur, n: roll.n + 1 });
  return (
    <span className="cd-d">
      {roll.old !== null ? (
        <span className="cd-dv out" key={`o${roll.n}`} aria-hidden="true">
          {roll.old}
        </span>
      ) : null}
      <span className={roll.n ? 'cd-dv new' : 'cd-dv'} key={`n${roll.n}`} suppressHydrationWarning>
        {roll.cur}
      </span>
    </span>
  );
}

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
      {UNITS.map((u) => {
        const digits = String(parts[u]).padStart(2, '0');
        return (
          <div className="cd-cell" key={u}>
            {/* a 3-digit day count keeps its own digits: keyed by place from the right */}
            <div className="cd-num" suppressHydrationWarning>
              {[...digits].map((ch, i) => (
                <Digit key={digits.length - i} ch={ch} />
              ))}
            </div>
            <div className="cd-lbl" suppressHydrationWarning>
              {t(locale, `countdown.${u}`, { n: parts[u] })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
