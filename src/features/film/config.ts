/**
 * The highlights film (feature auto_reel), in one place: its lengths and sizes, how the shots are
 * chosen, how the music is read, how the edit follows it, the motion and the transitions, and the
 * encoder's settings. The film is made entirely in the host's browser — nothing is rendered on a
 * server. Isomorphic: the page, the server's checks and the tests read the same values.
 */
export const FILM = {
  /** the lengths the host picks from (seconds); the film ends on the musical phrase nearest to it */
  lengths: [30, 60, 90] as const,
  fps: 30,
  sizes: {
    /** 1080p, and 720p for weaker devices (or when the browser can't encode 1080p) */
    vertical: { full: { width: 1080, height: 1920 }, light: { width: 720, height: 1280 } },
    horizontal: { full: { width: 1920, height: 1080 }, light: { width: 1280, height: 720 } },
  },
  encode: {
    videoBitrate: { full: 6_000_000, light: 3_500_000 },
    audioBitrate: 160_000,
    /** a keyframe every this many seconds (seeking in the result) */
    keyframeSeconds: 2,
    /** frames waiting in the encoder before the page waits for it */
    queue: 6,
  },
  audio: {
    sampleRate: 48_000,
    channels: 2,
    /** the music is analysed at this rate (enough for the beat; four times less work) */
    analysisRate: 22_050,
    /** the kick drum's band (Hz): its onsets mark the downbeats */
    lowBandHz: 150,
    /** the music fades out over the end card, at most this long (s) */
    fadeOutSeconds: 3,
    /** a track that starts mid-song fades in over this (s) — no click */
    fadeInSeconds: 0.25,
    /** quieter than this (RMS) at the start is silence, skipped */
    silence: 0.01,
    /** the uploaded track's size at most (bytes) */
    uploadBytes: 40 * 1024 * 1024,
  },
  tempo: {
    min: 70,
    max: 180,
    /** the tempo most songs are near (an estimate's octave is settled toward it) */
    prior: 120,
    /** without music (or when the beat can't be read): an even pulse at this tempo */
    fallback: 108,
    /** Beat tracking's tightness: how strongly beats keep to the tempo (higher: stricter) */
    tightness: 120,
  },
  shots: {
    /** a photo's shot is about this long (s), in whole beats on the bar's grid */
    photoSeconds: 2.2,
    /** no shot shorter or longer (s) */
    minSeconds: 0.9,
    maxSeconds: 4.8,
    /** a clip's part in the film at most (s), and the clips too short to use (s) */
    clipMaxSeconds: 4.6,
    clipMinSeconds: 1.5,
    /** where in a clip its part starts (share of the time it has to spare — the first seconds shake) */
    clipIn: 0.3,
  },
  cards: {
    /** the title card and the end card at least (s), in whole bars */
    titleSeconds: 2,
    endSeconds: 2.6,
  },
  select: {
    /** perceptual-hash distance (bits of 64) at or under which two items are the same moment */
    duplicateBits: 10,
    /** taken this close together (s) and this alike (bits): a burst — one is enough */
    burstSeconds: 4,
    burstBits: 18,
    /** clips' share of the shots, when the gallery has good ones */
    clipShare: 0.3,
    /** items the film chooses from (the newest) */
    maxCandidates: 3000,
    /** a film needs at least this many photos and clips */
    minItems: 3,
  },
  motion: {
    /** the push toward the focal point: the frame closes in by this share over a shot */
    push: 0.12,
    /** room kept around the faces (share of their size, each side) */
    faceMargin: 0.2,
  },
  transitions: {
    /** at or over this tempo: cuts and whips; under `slowBpm`: dissolves */
    fastBpm: 128,
    slowBpm: 96,
    dissolveSeconds: { min: 0.3, max: 0.8 },
    whipSeconds: 0.28,
  },
} as const;

export type FilmLength = (typeof FILM.lengths)[number];
export type FilmShape = keyof typeof FILM.sizes;
export type FilmQuality = 'full' | 'light';

export const isFilmLength = (v: unknown): v is FilmLength => FILM.lengths.includes(v as FilmLength);

export function filmSize(shape: FilmShape, quality: FilmQuality): { width: number; height: number } {
  return FILM.sizes[shape][quality];
}
