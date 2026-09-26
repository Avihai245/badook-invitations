/**
 * The draft review link's numbers in one place (isomorphic). Feature `draft_review` (Basic): the host
 * sends family members a link to the current draft; they pin comments on it without an account. The
 * database's own limits (writes per address and per link, comments per invitation, replies per
 * comment) are in supabase/migrations/*_studio.sql.
 */
export const REVIEW = {
  /** a family member's name, as they type it once */
  nameMax: 40,
  /** a comment or a reply */
  bodyMax: 1000,
  /** the link's life, days (null: until the host revokes it) — what the host may choose */
  expiryDays: [null, 7, 30] as const,
  /** the review page and the host's editor ask again this often while the live channel is down */
  pollMs: 15_000,
  /** a host who hears about each comment gets at most one email in this many minutes */
  notifyEveryMinutes: 10,
  /** comments are erased this many days after the event (the privacy policy; the daily run) */
  keepDaysAfterEvent: 90,
} as const;

/** The review link's token: 24 URL-safe characters. */
export const REVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
/** The reviewer's browser key (random, kept in their browser; the database keeps its hash). */
export const AUTHOR_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
