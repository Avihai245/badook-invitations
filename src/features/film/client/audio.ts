import { analyzeBeats, type BeatAnalysis } from '../beats';
import { FILM } from '../config';
import type { FilmPlan } from '../timeline';

/**
 * The film's music on the device: the track decoded by the browser (any format it plays), rendered
 * through OfflineAudioContexts into the two bands the beat is read from (the whole mix, and the kick
 * drum's low band through a low-pass filter), and at the end the film's own soundtrack — the part of
 * the song the edit uses, faded in when it starts mid-song and faded out over the end card.
 */

/** The track, decoded at the film's rate (stereo). Throws on a file the browser can't decode. */
export async function decodeTrack(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(FILM.audio.channels, 1, FILM.audio.sampleRate);
  return ctx.decodeAudioData(bytes);
}

/** One band of the track, mono, at the analysis rate. */
async function band(buffer: AudioBuffer, lowpassHz: number | null): Promise<Float32Array> {
  const rate = FILM.audio.analysisRate;
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * rate)), rate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (lowpassHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    filter.Q.value = Math.SQRT1_2;
    source.connect(filter).connect(ctx.destination);
  } else {
    // the one-channel destination mixes the channels down
    source.connect(ctx.destination);
  }
  source.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/** The beat of a decoded track (tempo, beats, downbeats), read on this device. */
export async function analyzeTrack(buffer: AudioBuffer): Promise<BeatAnalysis> {
  const [full, low] = await Promise.all([band(buffer, null), band(buffer, FILM.audio.lowBandHz)]);
  return analyzeBeats(full, low, FILM.audio.analysisRate);
}

/** A soft curve from `from` to `to` (equal-power: no dip or bump in loudness). */
function curve(from: number, to: number, steps = 64): Float32Array {
  const out = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const p = i / (steps - 1);
    const e = from < to ? Math.sin((p * Math.PI) / 2) : Math.cos((p * Math.PI) / 2);
    out[i] = from < to ? from + (to - from) * e : to + (from - to) * e;
  }
  return out;
}

/**
 * The film's soundtrack: `plan.duration` seconds of the track from `plan.musicOffset`, with its fades
 * (silence without a track).
 */
export async function renderSoundtrack(track: AudioBuffer | null, plan: FilmPlan): Promise<AudioBuffer> {
  const rate = FILM.audio.sampleRate;
  const ctx = new OfflineAudioContext(
    FILM.audio.channels,
    Math.max(1, Math.round(plan.duration * rate)),
    rate,
  );
  if (track) {
    const source = ctx.createBufferSource();
    source.buffer = track;
    const gain = ctx.createGain();
    const fade = plan.fadeOut.end - plan.fadeOut.start;
    // (the two curves never overlap: a film is longer than both)
    if (plan.fadeIn > 0 && plan.fadeIn < plan.fadeOut.start)
      gain.gain.setValueCurveAtTime(curve(0, 1), 0, plan.fadeIn);
    if (fade > 0.05) gain.gain.setValueCurveAtTime(curve(1, 0), plan.fadeOut.start, fade);
    source.connect(gain).connect(ctx.destination);
    source.start(0, plan.musicOffset);
  }
  return ctx.startRendering();
}
