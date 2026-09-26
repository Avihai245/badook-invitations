/**
 * "The photos I'm in" (feature face_albums), in one place: the model the browsers run, how they look
 * for faces, when two faces are the same person, how long anything is kept, and the rate limits.
 * Isomorphic: the phones, the host's browser and the server read the same values.
 */
export const FACES = {
  model: {
    /**
     * The @vladmandic/face-api version whose browser build and models scripts/copy-face-models.mjs
     * copies to public/face-models/<version>/ (tests/unit/faces.test.ts checks it is the installed one).
     */
    version: '1.7.15',
    /** what is loaded, from this app's own origin, only when someone uses face search */
    library: 'face-api.esm.js',
    nets: ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'] as const,
    /** the download, for the guest's "this happens on your phone" note (MB) */
    sizeMb: 14,
  },
  detect: {
    /** a photo is looked at this big (its long edge, px): small faces in group photos still show */
    longEdge: 1280,
    /** the detector's confidence below which a "face" is ignored */
    minConfidence: 0.5,
    /** faces kept per photo at most */
    maxFaces: 100,
    /** a face smaller than this (share of the photo's short side) is too small to match reliably */
    minFaceShare: 0.025,
  },
  match: {
    /**
     * A guest's selfie and a face in a photo are the same person under this distance (the 128-number
     * descriptors' Euclidean distance: the model's own "same person" line is 0.6; stricter here, so a
     * guest's album rarely shows a stranger).
     */
    search: 0.52,
    /** leaving out and forgetting reach a little further (better to take out one face too many) */
    exclude: 0.6,
    /** photos an album shows at most */
    albumLimit: 600,
  },
  /** all face data is erased this many days after the event's date (the daily run) */
  retentionDays: 30,
  /** the host's "prepare face search": photos per request */
  hostBatch: 8,
  rate: {
    /** searches (and leave-out / forget) per address — a guest tries a few selfies, not hundreds */
    searchPerAddress: { count: 30, windowSeconds: 600 },
    /** and per gallery link */
    searchPerLink: { count: 1_200, windowSeconds: 600 },
    /** a phone's uploads indexed (one call per photo) */
    indexPerDevice: { count: 300, windowSeconds: 600 },
  },
} as const;

/** The model's files' address (served by this app). */
export const modelBase = (): string => `/face-models/${FACES.model.version}/`;
