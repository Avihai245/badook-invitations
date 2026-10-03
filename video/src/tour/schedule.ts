/**
 * The tour's timeline, computed from the narration and its measured lengths (durations.json). Pure: the
 * composition, the WebVTT writer (scripts/vtt.mjs) and the narrate script all use this same code, so the
 * burned-in subtitles, the captions file and the audio line up.
 *
 * One scene per narration segment. A scene is LEAD frames of lead-in, the narration, then a TAIL; the
 * next scene starts right after (its entrance overlaps the previous scene's exit by OVERLAP frames).
 * Each segment's text is split into sentences; a sentence is on screen for a share of the narration
 * proportional to its length in characters.
 */
import durationsJson from './durations.json';
import { NARRATION, type NarrationSegment } from './narration';

export { NARRATION };

export const FPS = 30;
/** frames between a scene's start and its voice */
export const LEAD = 6;
/** seconds after the voice before the next scene */
export const TAIL_SECONDS = 0.8;
/** frames a scene's exit overlaps the next scene's entrance */
export const OVERLAP = 10;

/** Without a measured length: about 13 Hebrew characters a second, at least 4 seconds. */
export const CHARS_PER_SECOND = 13;
export const MIN_SECONDS = 4;

/** One entry of durations.json: the narration's length and whether public/narration/<id>.mp3 exists. */
export interface DurationEntry {
  seconds: number;
  /** true only when scripts/narrate.mjs wrote the audio file */
  audio: boolean;
  /** the voice and a hash of voice + rate + text (narrate.mjs skips segments that did not change) */
  voice?: string;
  hash?: string;
}

export type Durations = Record<string, DurationEntry>;

export interface Cue {
  /** absolute frames [from, to) */
  from: number;
  to: number;
  text: string;
}

export interface SegmentTiming {
  id: string;
  text: string;
  /** absolute first frame of the scene, and its length in frames (without the exit overlap) */
  start: number;
  dur: number;
  /** narration window, in frames local to the scene */
  narrFrom: number;
  narrFrames: number;
  seconds: number;
  estimated: boolean;
  audio: boolean;
  /** this segment's sentences, absolute frames */
  sentences: Cue[];
}

export interface TourSchedule {
  fps: number;
  total: number;
  segments: SegmentTiming[];
  /** the subtitles: every sentence, back to back (a segment's last one stays until the next begins) */
  cues: Cue[];
}

const chars = (s: string) => Array.from(s).length;

export const estimateSeconds = (text: string) =>
  Math.max(MIN_SECONDS, Math.round((chars(text) / CHARS_PER_SECOND) * 100) / 100);

/** Split after . ? ! — colons, commas and dashes stay inside a sentence. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildSchedule(
  durations: Durations = durationsJson as Durations,
  narration: NarrationSegment[] = NARRATION,
  fps: number = FPS,
): TourSchedule {
  let start = 0;
  const tail = Math.round(TAIL_SECONDS * fps);
  const segments: SegmentTiming[] = narration.map(({ id, text }) => {
    const entry = durations[id];
    const measured = entry && typeof entry.seconds === 'number' && entry.seconds > 0;
    const seconds = measured ? entry.seconds : estimateSeconds(text);
    const narrFrames = Math.ceil(seconds * fps);
    const dur = LEAD + narrFrames + tail;
    const parts = splitSentences(text);
    const totalChars = parts.reduce((s, p) => s + chars(p), 0);
    let acc = 0;
    const sentences = parts.map((p) => {
      const from = start + LEAD + Math.round((acc / totalChars) * narrFrames);
      acc += chars(p);
      const to = start + LEAD + Math.round((acc / totalChars) * narrFrames);
      return { from, to, text: p };
    });
    const seg: SegmentTiming = {
      id,
      text,
      start,
      dur,
      narrFrom: LEAD,
      narrFrames,
      seconds,
      estimated: !measured,
      audio: Boolean(measured && entry.audio),
      sentences,
    };
    start += dur;
    return seg;
  });
  const total = start;
  const all = segments.flatMap((s) => s.sentences);
  const cues = all.map((c, i) => ({ ...c, to: i + 1 < all.length ? all[i + 1].from : total }));
  return { fps, total, segments, cues };
}

/**
 * The local frame (within the scene) at which `needle` is spoken, estimated from its position in the
 * text. Used to time a scene's beats to the voice; `offset` shifts it (frames).
 */
export function spokenAt(seg: SegmentTiming, needle: string, offset = 0): number {
  const i = seg.text.indexOf(needle);
  if (i < 0) throw new Error(`"${needle}" is not in the narration of "${seg.id}"`);
  const before = chars(seg.text.slice(0, i));
  return Math.round(seg.narrFrom + (before / chars(seg.text)) * seg.narrFrames + offset);
}

/** WebVTT for the cues (times in seconds, hh:mm:ss.mmm). */
export function toVtt(schedule: TourSchedule): string {
  const ts = (frame: number) => {
    const ms = Math.round((frame / schedule.fps) * 1000);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
  };
  const body = schedule.cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}`).join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
