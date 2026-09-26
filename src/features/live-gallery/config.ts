/**
 * The live gallery's numbers, in one place: what guests may upload and how big, how the browser
 * prepares photos, the thresholds that hold back or reject an upload (the browser's checks and the
 * automatic content check), rate limits, link lifetimes, live updates and housekeeping. Isomorphic:
 * the browser and the server read the same values. Changing a threshold is a change here only.
 */

export type MediaKind = 'image' | 'video';

/** Original files a guest may upload (what phones make), and the extension the stored file gets. */
export const ORIGINAL_TYPES: Readonly<Record<string, { kind: MediaKind; ext: string }>> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/heic': { kind: 'image', ext: 'heic' },
  'image/heif': { kind: 'image', ext: 'heif' },
  'image/avif': { kind: 'image', ext: 'avif' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'video/3gpp': { kind: 'video', ext: '3gp' },
};

/** The display versions and thumbnails the browser makes. */
export const PREVIEW_TYPES: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const GALLERY = {
  limits: {
    /** a photo's original file */
    imageBytes: 40 * 1024 * 1024,
    /** a video (no transcoding: the file as the phone made it) */
    videoBytes: 200 * 1024 * 1024,
    /** a video's length */
    videoMs: 5 * 60_000,
    displayBytes: 10 * 1024 * 1024,
    thumbBytes: 1024 * 1024,
    /** photos and videos in one event's gallery (uploads under way count) */
    itemsPerEvent: 3000,
    /** items one request may reserve */
    itemsPerRequest: 10,
    /** files at least this large go through a resumable upload */
    resumableFrom: 6 * 1024 * 1024,
    /** the resumable upload's chunk (Supabase Storage requires exactly 6 MB) */
    resumableChunk: 6 * 1024 * 1024,
    /** a guest's name on their uploads */
    nameLength: 60,
    /** the host's access code */
    codeLength: { min: 3, max: 32 },
  },

  /** How the browser prepares a photo before sending it (the original is kept as it is). */
  image: {
    /** the display version's long edge (never enlarged) and JPEG quality */
    displayMaxEdge: 2560,
    displayQuality: 0.85,
    /** the thumbnail's long edge and quality; the checks run on it */
    thumbMaxEdge: 480,
    thumbQuality: 0.8,
  },
  video: {
    /** the still shown before a video plays (display version) */
    posterMaxEdge: 1280,
    posterQuality: 0.82,
    /** where the still is taken (the first frame is often black) */
    posterAtSeconds: 0.8,
  },

  /** A gentle lift of the display version (levels and contrast), never the original. */
  enhance: {
    /** the darkest and brightest 0.5% of pixels are clipped to black and white */
    lowPercentile: 0.005,
    highPercentile: 0.995,
    /** no change when the photo already spans at least this range (of 255) */
    fullRange: 235,
    /** the stretch never multiplies contrast by more than this */
    maxGain: 1.35,
    /** blend with the photo as it was (1 = the full stretch) */
    strength: 0.6,
    /** a dark photo's midtones are lifted a little (mean luminance under this, 0..1) */
    darkMean: 0.32,
    /** the smallest gamma used for that lift (1 = none) */
    minGamma: 0.85,
  },

  /** What holds an upload back for the host's approval, or keeps it out altogether. */
  moderation: {
    /** sharpness (variance of the Laplacian, second-best of a 4×4 grid on the thumbnail) under this: blurry */
    blurHold: 18,
    /** mean luminance (0..1) under this: a black frame, a pocket shot */
    darkHold: 0.07,
    /** perceptual-hash distance (bits of 64) at or under this: the same photo again */
    duplicateDistance: 4,
    /** the automatic check's nsfw score (0..1) at or over this: rejected outright */
    nsfwReject: 0.9,
    /** at or over this: waits for the host */
    nsfwHold: 0.45,
    /** its quality score (0..1) under this: waits for the host */
    qualityHold: 0.15,
    /** when the automatic check is on but couldn't run: wait for the host ('hold') or go ahead ('publish') */
    aiUnavailable: 'hold' as 'hold' | 'publish',
  },

  /** The automatic content check (gallery_ai). */
  ai: {
    timeoutMs: 15_000,
    maxTokens: 1024,
    /** one more try after a busy or failed answer, when there is time */
    retries: 1,
    /** checks a day for the whole site (a cost ceiling); past it, uploads count as unchecked */
    perDay: 20_000,
  },

  /** Requests per window (a window in seconds). */
  rate: {
    reservePerLink: { count: 600, windowSeconds: 600 },
    /** generous: a venue's guests often share one address */
    reservePerAddress: { count: 240, windowSeconds: 600 },
    reservePerDevice: { count: 60, windowSeconds: 600 },
    /** wrong access codes */
    codePerAddress: { count: 10, windowSeconds: 900 },
    feedPerDevice: { count: 120, windowSeconds: 60 },
  },

  urls: {
    /** signed URLs of photos and videos (pages ask for fresh ones before they run out) */
    signedTtlSeconds: 3 * 3600,
    /** a page refreshes its URLs this long before they expire */
    refreshBeforeSeconds: 30 * 60,
    /** signed upload tokens last two hours: a queue asks for fresh ones after this */
    uploadTokenMaxAgeMs: 100 * 60_000,
  },

  /** Live updates: a Realtime hint, polling only while that connection is down. */
  live: {
    pollGuestMs: 12_000,
    pollProjectorMs: 6_000,
    pollHostMs: 15_000,
    /** hints closer together than this make one refresh */
    hintThrottleMs: 1_500,
    heartbeatMs: 25_000,
    joinTimeoutMs: 10_000,
    /** a hidden page lets go of its connection after this */
    hiddenDisconnectMs: 60_000,
    reconnectMs: [1_000, 2_000, 5_000, 10_000, 20_000, 30_000],
  },

  queue: {
    /** waits between a failed upload's attempts */
    backoffMs: [1_000, 3_000, 8_000, 15_000, 30_000, 60_000],
    jitter: 0.25,
    /** a paused or closed gallery is asked again after this */
    blockedRetryMs: 60_000,
  },

  feed: {
    pageSize: 30,
    hostPageSize: 60,
  },

  projector: {
    slideMs: 7_000,
    /** a video plays at most this long, muted */
    videoMaxMs: 30_000,
    /** a new photo waits until the current one has been up at least this long */
    freshAfterMs: 1_500,
    /** the newest this many items rotate */
    maxItems: 300,
  },

  housekeeping: {
    /** reserved uploads that never finished are deleted after this */
    abandonedHours: 48,
    /** a deleted item's row (its files go at once) */
    tombstoneDays: 30,
    /** a server sweeps at most this often on its own traffic */
    sweepEveryMs: 10 * 60_000,
    sweepBudgetMs: 4_000,
  },
} as const;

// (not Object.hasOwn: the guest page runs on old phones too)
export const isOriginalType = (type: string): boolean =>
  Object.prototype.hasOwnProperty.call(ORIGINAL_TYPES, type);
export const kindOfType = (type: string): MediaKind | null =>
  isOriginalType(type) ? ORIGINAL_TYPES[type]!.kind : null;
