/**
 * How the invitation's insights are measured (feature `analytics`), in one place: what a page load
 * reports and how often, what the server accepts, how long anything is kept. Isomorphic: the beacon,
 * the API and the host's screen read the same values.
 */
export const INSIGHTS = {
  beacon: {
    /** the beacon's module loads this long after the page became interactive (idle time first) */
    startAfterMs: 1_500,
    /** while the page is on screen, its state goes out this often (when something changed) */
    heartbeatMs: 15_000,
    /** the visible time a page load may report at most */
    maxVisibleMs: 30 * 60_000,
    /** the payload's size cap (bytes) */
    maxBytes: 2_048,
  },
  /** scroll milestones (% of the page) */
  milestones: [25, 50, 75, 100] as const,
  /** the visible-time buckets (lower bounds, seconds) the daily numbers count page loads in */
  buckets: [0, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800] as const,
  /** the page loads themselves (needed to count each once) are deleted after this */
  rawDays: 7,
  /** the server's memory of an invitation's slug and feature (fewer queries per beacon) */
  cacheMs: 60_000,
  /** the host's screen: the ranges it offers (days; 0 = since the invitation was published) */
  ranges: [7, 30, 0] as const,
} as const;

export type Milestone = (typeof INSIGHTS.milestones)[number];
