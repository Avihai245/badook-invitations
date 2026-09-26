/**
 * When decorative motion may run (renderer/fx) — browser only; false on the server. Never with
 * `prefers-reduced-motion: reduce` or on a page that turned motion off (<html data-motion="none">).
 */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    // no matchMedia (tests): treat as allowed
  }
  return document.documentElement.dataset.motion !== 'none';
}

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** The guest asked to save data: no decorative layers that keep running. */
export function saveData(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Nav).connection?.saveData;
}

/** Hard cap on particles on a phone-sized screen (ambient layer and each burst). */
export const PHONE_MAX_PARTICLES = 24;
/** Hard cap anywhere. */
export const MAX_PARTICLES = 40;

/**
 * How many particles this device gets: `phone` on a small or touch screen (never more than 24),
 * `desktop` elsewhere (never more than 40), about 40% fewer on a low-end device (2 cores or 2 GB —
 * not by a 4-core count, which Safari reports for fast iPhones too).
 */
export function particleBudget(phone: number, desktop: number): number {
  if (typeof window === 'undefined') return 0;
  let small = Math.min(window.innerWidth, window.innerHeight) < 600;
  try {
    small ||= window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    // keep the size test
  }
  let n = small ? Math.min(phone, PHONE_MAX_PARTICLES) : Math.min(desktop, MAX_PARTICLES);
  const nav = navigator as Nav;
  if (
    (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) ||
    (nav.deviceMemory && nav.deviceMemory <= 2)
  )
    n = Math.round(n * 0.6);
  return Math.max(1, n);
}

/** A small deterministic PRNG (mulberry32) seeded from a string — the same particles every time. */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
