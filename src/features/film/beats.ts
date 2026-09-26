import { FILM } from './config';

/**
 * Reading the music's beat, in-house and small (tested on a synthetic click track in
 * tests/unit/film.test.ts): the browser decodes the track and renders it through an
 * OfflineAudioContext (client/audio.ts) into two bands — the whole mix and the kick drum's low band —
 * and this does the rest as plain math: an onset envelope from the rise of each band's energy, the
 * tempo from the envelope's autocorrelation (settled toward common tempos), the beats by dynamic
 * programming (each beat where the music hits, all of them close to the tempo), and the downbeats —
 * the beat of the bar the low band hits hardest — from which bars and phrases follow.
 */

export interface BeatAnalysis {
  bpm: number;
  /** every beat, in seconds from the track's start */
  beats: number[];
  /** the index (in `beats`) of a downbeat: bars start every 4 beats from it */
  downbeat: number;
  /** 0..1: how clearly the tempo stood out */
  confidence: number;
  /** where the sound starts (s): leading silence is skipped */
  start: number;
  duration: number;
}

/** The hop between envelope frames (samples): ~11.6 ms at the analysis rate. */
export const HOP = 256;
const WINDOW = 1024;

/**
 * The time of an envelope frame's onset (s): a frame's rise comes from the samples that just entered
 * the leading edge of its window — the middle of that last hop.
 */
export const frameTime = (frame: number, sampleRate: number) =>
  (frame * HOP + WINDOW / 2 - HOP / 2) / sampleRate;

/** Each frame's energy (mean square over a window centred on it). */
export function frameEnergy(samples: Float32Array, hop = HOP, window = WINDOW): Float32Array {
  const frames = Math.max(0, Math.floor(samples.length / hop));
  const out = new Float32Array(frames);
  // a running sum of squares: O(n) whatever the window
  const sq = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) sq[i + 1] = sq[i]! + samples[i]! * samples[i]!;
  const half = window >> 1;
  for (let f = 0; f < frames; f++) {
    const c = f * hop;
    const a = Math.max(0, c - half);
    const b = Math.min(samples.length, c + half);
    out[f] = b > a ? (sq[b]! - sq[a]!) / (b - a) : 0;
  }
  return out;
}

/**
 * The onset envelope of one band: how much its (log-compressed) energy rises from frame to frame,
 * never falling below zero, with the local average taken out (a steady loud part isn't an onset).
 */
export function bandOnsets(energy: Float32Array): Float32Array {
  const n = energy.length;
  const out = new Float32Array(n);
  if (!n) return out;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += energy[i]!;
  mean = mean / n || 1e-12;
  let prev = Math.log1p(energy[0]! / (mean * 0.01));
  for (let i = 1; i < n; i++) {
    const v = Math.log1p(energy[i]! / (mean * 0.01));
    out[i] = Math.max(0, v - prev);
    prev = v;
  }
  // take out the local mean (±~70 ms)
  const r = 6;
  const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i]! + out[i]!;
  const res = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r);
    const b = Math.min(n, i + r + 1);
    res[i] = Math.max(0, out[i]! - (cs[b]! - cs[a]!) / (b - a));
  }
  return res;
}

/** The envelope the tempo and beats are read from: the whole mix's onsets plus the low band's. */
export function onsetEnvelope(full: Float32Array, low: Float32Array | null): Float32Array {
  const a = bandOnsets(frameEnergy(full));
  if (!low) return normalize(a);
  const b = bandOnsets(frameEnergy(low));
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  const na = normalize(a);
  const nb = normalize(b);
  for (let i = 0; i < n; i++) out[i] = na[i]! + nb[i]!;
  return normalize(out);
}

/** Scaled to unit standard deviation (a silent track stays zero). */
export function normalize(v: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i]!;
  mean /= v.length || 1;
  let variance = 0;
  for (let i = 0; i < v.length; i++) variance += (v[i]! - mean) ** 2;
  const sd = Math.sqrt(variance / (v.length || 1));
  const out = new Float32Array(v.length);
  if (sd < 1e-9) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / sd;
  return out;
}

/**
 * The tempo (beats per minute): the envelope's autocorrelation over the lags of FILM.tempo.min…max,
 * each weighted toward FILM.tempo.prior on a log scale (so half and double tempos lose to the likely
 * one) and helped by its own double lag (a real period repeats); the peak refined between frames.
 */
export function estimateTempo(env: Float32Array, frameRate: number): { bpm: number; confidence: number } {
  const { min, max, prior } = FILM.tempo;
  const lo = Math.max(1, Math.floor((frameRate * 60) / max));
  const hi = Math.ceil((frameRate * 60) / min);
  const n = env.length;
  if (n < hi * 3) return { bpm: FILM.tempo.fallback, confidence: 0 };
  const acf = new Float64Array(2 * hi + 2);
  for (let lag = lo; lag <= Math.min(2 * hi + 1, n - 1); lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += env[i]! * env[i + lag]!;
    acf[lag] = s / (n - lag);
  }
  const score = (lag: number) => {
    const bpm = (60 * frameRate) / lag;
    const w = Math.exp(-0.5 * (Math.log2(bpm / prior) / 0.9) ** 2);
    return w * (acf[lag]! + 0.5 * (acf[2 * lag] ?? 0));
  };
  let best = lo;
  let bestScore = -Infinity;
  let total = 0;
  for (let lag = lo; lag <= hi; lag++) {
    const s = score(lag);
    total += Math.max(0, s);
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  if (!(bestScore > 0)) return { bpm: FILM.tempo.fallback, confidence: 0 };
  // parabolic interpolation around the peak (on the raw autocorrelation)
  let lag = best;
  if (best > lo && best < hi) {
    const a = acf[best - 1]!;
    const b = acf[best]!;
    const c = acf[best + 1]!;
    const d = a - 2 * b + c;
    if (d < 0) lag = best + (0.5 * (a - c)) / d;
  }
  const confidence = Math.min(1, (bestScore / (total / (hi - lo + 1) || 1) - 1) / 4);
  return { bpm: (60 * frameRate) / lag, confidence: Math.max(0, confidence) };
}

/**
 * The beats (frame indices), by dynamic programming: each frame's best score is its onset plus the
 * best earlier beat's score, less a penalty for a gap unlike the tempo's period; the path back from
 * the best frame near the end is the beat track.
 */
export function trackBeats(
  env: Float32Array,
  frameRate: number,
  bpm: number,
  tightness = FILM.tempo.tightness,
) {
  const n = env.length;
  const period = (60 * frameRate) / bpm;
  if (n < 2 || !(period > 1)) return [];
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const from = Math.round(period / 2);
  const to = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0;
    let arg = -1;
    for (let p = t - to; p <= t - from; p++) {
      if (p < 0) continue;
      const gap = Math.log((t - p) / period);
      const s = score[p]! - tightness * gap * gap;
      if (arg < 0 || s > best) {
        best = s;
        arg = p;
      }
    }
    score[t] = env[t]! + (arg >= 0 ? Math.max(0, best) : 0);
    back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  // the end: the best frame within the last period
  let end = n - 1;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t]! > score[end]!) end = t;
  const beats: number[] = [];
  for (let t = end; t >= 0; t = back[t]!) {
    beats.push(t);
    if (back[t]! < 0) break;
  }
  return beats.reverse();
}

/** Which beat of the bar (0–3, counted from the first beat) the low band hits hardest. */
export function downbeatPhase(beatFrames: number[], lowEnv: Float32Array): number {
  const sums = [0, 0, 0, 0];
  const counts = [0, 0, 0, 0];
  beatFrames.forEach((f, i) => {
    let v = 0;
    for (let d = -2; d <= 2; d++) v = Math.max(v, lowEnv[f + d] ?? 0);
    sums[i % 4]! += v;
    counts[i % 4]! += 1;
  });
  let best = 0;
  for (let p = 1; p < 4; p++) if (sums[p]! / (counts[p] || 1) > sums[best]! / (counts[best] || 1)) best = p;
  return best;
}

/** Where the sound starts: the first ~10 ms louder than FILM.audio.silence (RMS). */
export function firstSound(samples: Float32Array, sampleRate: number): number {
  const w = Math.max(1, Math.round(sampleRate / 100));
  const threshold = FILM.audio.silence ** 2;
  for (let i = 0; i + w <= samples.length; i += w) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += samples[j]! * samples[j]!;
    if (s / w > threshold) return i / sampleRate;
  }
  return 0;
}

/** An even pulse (no music, or none that could be read). */
export function evenBeats(bpm: number, duration: number, start = 0): number[] {
  const period = 60 / bpm;
  const out: number[] = [];
  for (let t = start; t <= duration + 1e-9; t += period) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

/** The whole reading, from the two bands at `sampleRate`. */
export function analyzeBeats(full: Float32Array, low: Float32Array | null, sampleRate: number): BeatAnalysis {
  const duration = full.length / sampleRate;
  const start = firstSound(full, sampleRate);
  const frameRate = sampleRate / HOP;
  // the tempo from the whole mix (the kick alone leans toward half tempo: it often plays every other
  // beat); the beats from both bands; the downbeats from the kick
  const { bpm, confidence } = estimateTempo(onsetEnvelope(full, null), frameRate);
  const env = onsetEnvelope(full, low);
  if (confidence <= 0) {
    return { bpm, beats: evenBeats(bpm, duration, start), downbeat: 0, confidence: 0, start, duration };
  }
  const frames = trackBeats(env, frameRate, bpm);
  const lowEnv = low ? normalize(bandOnsets(frameEnergy(low))) : env;
  const downbeat = downbeatPhase(frames, lowEnv);
  return {
    bpm,
    beats: frames.map((f) => frameTime(f, sampleRate)),
    downbeat,
    confidence,
    start,
    duration,
  };
}
