/**
 * The budget gauge's arithmetic (ui/BudgetGauge): a half circle from 0 to 130% of the budget in three
 * zones — safe up to 85%, close from 85% to 100%, over past 100%. The main needle is what is spent or
 * committed, a ghost needle the plan, a thin mark what is paid. Pure: the screens and the tests share it.
 */

/** The scale's end: past it the needle stops at the edge (and the screen says by how much). */
export const GAUGE_MAX = 1.3;
export const GAUGE_ZONES = { safe: 0.85, close: 1 } as const;

export type GaugeZone = 'safe' | 'close' | 'over';

export interface GaugeInput {
  /** the budget; null or 0: no budget to measure against */
  total: number | null;
  /** booked and paid items (what the host is committed to) */
  committed: number;
  /** payments made */
  paid: number;
  /** the categories' plan */
  planned: number;
}

export interface GaugeReading {
  /** spent or committed as a share of the budget (unclamped: 1.42 = 142%) */
  ratio: number;
  /** the same, held to the scale (0..GAUGE_MAX) — where the needle points */
  needle: number;
  /** the plan and the paid as shares of the budget, held to the scale */
  ghost: number;
  paidMark: number;
  zone: GaugeZone;
  /** the needle is pinned at the scale's end */
  pinned: boolean;
  /** what is left of the budget (negative: the overrun) */
  left: number;
  /** whole percent of the budget used */
  percent: number;
}

const clamp = (n: number) => Math.max(0, Math.min(GAUGE_MAX, n));

export function zoneOf(ratio: number): GaugeZone {
  return ratio > GAUGE_ZONES.close ? 'over' : ratio >= GAUGE_ZONES.safe ? 'close' : 'safe';
}

export function readGauge(g: GaugeInput): GaugeReading | null {
  if (!g.total || g.total <= 0) return null;
  // a payment is always for something the host agreed to: what is used is the larger of the two
  const used = Math.max(g.committed, g.paid);
  const ratio = used / g.total;
  return {
    ratio,
    needle: clamp(ratio),
    ghost: clamp(g.planned / g.total),
    paidMark: clamp(g.paid / g.total),
    zone: zoneOf(ratio),
    pinned: ratio > GAUGE_MAX,
    left: Math.round(g.total - used),
    percent: Math.round(ratio * 100),
  };
}

/**
 * A point on the half circle for a value on the scale: 0 at the start side, GAUGE_MAX at the end, over
 * the top. `rtl` mirrors it (the scale starts on the right, like the screen's progress bars).
 */
export function gaugePoint(
  value: number,
  geo: { cx: number; cy: number; r: number },
  rtl: boolean,
): { x: number; y: number } {
  const angle = Math.PI * (1 - clamp(value) / GAUGE_MAX);
  const dx = geo.r * Math.cos(angle);
  return { x: geo.cx + (rtl ? -dx : dx), y: geo.cy - geo.r * Math.sin(angle) };
}

/** The SVG path of the arc between two values on the scale. */
export function gaugeArc(
  from: number,
  to: number,
  geo: { cx: number; cy: number; r: number },
  rtl: boolean,
): string {
  const a = gaugePoint(from, geo, rtl);
  const b = gaugePoint(to, geo, rtl);
  const f = (n: number) => n.toFixed(2);
  return `M ${f(a.x)} ${f(a.y)} A ${geo.r} ${geo.r} 0 0 ${rtl ? 0 : 1} ${f(b.x)} ${f(b.y)}`;
}
