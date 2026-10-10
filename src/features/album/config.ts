/**
 * The album's numbers, in one place (feature album): when it opens, how much it shows and how it is
 * laid out, its links' lifetime and the morning-after email. Isomorphic: the page and the server read
 * the same values.
 */
export const ALBUM = {
  /** it opens the morning after the event, at this hour in the event's time zone */
  opensAt: '08:00',
  /** photos and videos one album shows at most (the gallery's own cap) */
  maxItems: 3000,

  highlights: {
    /** the best moments at the top of the album */
    count: 9,
    /** an album with fewer photos than this shows no "best moments" band (it would repeat them all) */
    from: 14,
  },

  chapters: {
    /** without a timeline in the invitation: a pause this long between photos starts a new chapter */
    gapMinutes: 40,
    /** a chapter with fewer items joins its neighbour */
    minItems: 4,
    /** at most this many chapters (the closest neighbours merge) */
    max: 6,
    /** a photo taken this long before a timeline moment already belongs to it */
    leadMinutes: 5,
  },

  layout: {
    /** each chapter shows this many first; the rest on "show all" */
    pageSize: 36,
    /** the rows' height on a phone and on a wide screen (px) and the gap between photos */
    rowHeight: { narrow: 150, wide: 230 },
    gap: 6,
    /** a photo is never laid out wider or narrower than this (width / height) */
    aspect: { min: 0.5, max: 2.4 },
  },

  text: {
    title: 120,
    message: 700,
  },

  urls: {
    /** signed URLs of the photos (the page asks for fresh ones before they run out) */
    signedTtlSeconds: 3 * 3600,
    refreshBeforeSeconds: 30 * 60,
  },

  rate: {
    /** fresh URLs asked by one address (a page left open asks about every 2.5 hours) */
    refreshPerAddress: { count: 60, windowSeconds: 600 },
  },

  ready: {
    /** the daily run looks at events this many days back for albums that just became ready */
    daysBack: 3,
    /** emails one run sends at most */
    perRun: 200,
  },
} as const;
