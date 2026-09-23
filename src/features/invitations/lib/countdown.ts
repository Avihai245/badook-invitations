export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** milliseconds left (0 once the target is reached) */
  remainingMs: number;
}

const DAY = 86_400_000;

export function countdownParts(target: Date | number, now: Date | number): CountdownParts {
  const remainingMs = Math.max(0, +target - +now);
  return {
    days: Math.floor(remainingMs / DAY),
    hours: Math.floor(remainingMs / 3_600_000) % 24,
    minutes: Math.floor(remainingMs / 60_000) % 60,
    seconds: Math.floor(remainingMs / 1000) % 60,
    remainingMs,
  };
}

/** Before the target → counting; until +24h → the `afterEvent` text; later → the section hides. */
export function countdownPhase(target: Date | number, now: Date | number): 'counting' | 'after' | 'hidden' {
  const t = +target;
  const n = +now;
  if (n < t) return 'counting';
  return n < t + DAY ? 'after' : 'hidden';
}
