/**
 * The AI photos' numbers, in one place (feature ai_photos): the people of honor and their photos, the
 * guests' photos and requests, the limits the hosts choose within, the worker's timing, rate limits and
 * how long anything is kept. Isomorphic: the browser and the server read the same values.
 */
export const AI_PHOTOS = {
  people: {
    /** people of honor an event may have */
    max: 4,
    /** their photo's long edge, made on the host's device (JPEG) */
    maxEdge: 1024,
    quality: 0.9,
    /** the photo as the server takes it */
    maxBytes: 3 * 1024 * 1024,
    /** a few words that help the model */
    descriptionLength: 200,
    nameLength: 60,
  },

  source: {
    /** the guest's photo's long edge, made on their phone (JPEG) */
    maxEdge: 1536,
    quality: 0.86,
    maxBytes: 4 * 1024 * 1024,
  },

  prompt: {
    max: 400,
  },

  /** what the hosts choose between (the database keeps them within these too) */
  limits: {
    perGuest: { default: 3, min: 1, max: 10 },
    perEvent: { default: 100, min: 10, max: 500 },
  },

  result: {
    /** the stored photo (JPEG) and its thumbnail */
    maxEdge: 2048,
    quality: 90,
    thumbEdge: 480,
    thumbQuality: 80,
  },

  worker: {
    /** the Images API request (it waits for the photo) */
    requestTimeoutMs: 170_000,
    /** a photo running without word for this long is taken again (or fails) */
    staleSeconds: 240,
    /** tries per photo */
    maxAttempts: 2,
    /** a background photo is checked at most this often */
    checkEverySeconds: 4,
    /** and given up after this long */
    giveUpSeconds: 15 * 60,
  },

  /** the guest's page asks how their photo is doing this often */
  pollMs: 3_500,

  rate: {
    createPerAddress: { count: 40, windowSeconds: 600 },
    createPerDevice: { count: 12, windowSeconds: 600 },
    statusPerDevice: { count: 240, windowSeconds: 600 },
  },

  urls: { signedTtlSeconds: 3 * 3600 },

  /** everything is erased this many days after the event */
  keepDays: 30,
} as const;
