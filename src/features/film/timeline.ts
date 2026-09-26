import { evenBeats } from './beats';
import { FILM, type FilmLength } from './config';

/**
 * The edit, as plain math (tested in tests/unit/film.test.ts): every cut on a beat of the music, the
 * film starting on a downbeat and ending on the musical phrase nearest to the length the host chose,
 * a title card and an end card in whole bars, each photo held for whole beats (about two seconds) and
 * each clip for a little longer, the transitions chosen by the tempo — cuts and whips when it's fast,
 * dissolves when it's slow — and the music fading out over the end card.
 */

export type Transition = 'cut' | 'dissolve' | 'whip';
export type TempoClass = 'fast' | 'medium' | 'slow';

export interface PlanItem {
  id: string;
  kind: 'image' | 'video';
  durationMs: number | null;
  /** higher stays: what goes first when there is more than the film holds */
  priority: number;
}

export interface Shot {
  kind: 'title' | 'item' | 'end';
  id: string | null;
  media: 'image' | 'video' | null;
  /** the cuts (s, film time) — on beats */
  start: number;
  end: number;
  beats: number;
  /** the transition into this shot, centred on its start (a cut: 0) */
  transition: { type: Transition; duration: number };
  /** a clip's time at the shot's start (s); film time t shows clipIn + (t − start) */
  clipIn: number;
  /** the shot's place among the item shots (varies the motion) */
  index: number;
}

export interface FilmPlan {
  duration: number;
  /** the track's time at the film's start */
  musicOffset: number;
  /** a fade-in at the start (s): the track starts mid-song */
  fadeIn: number;
  fadeOut: { start: number; end: number };
  bpm: number;
  tempo: TempoClass;
  /** the beats the edit used (film time), through the last */
  beats: number[];
  shots: Shot[];
  /** the items there was no room for */
  dropped: string[];
}

export interface PlanInput {
  /** the track's beats (s, track time); empty: no music */
  beats: number[];
  /** index in `beats` of a downbeat */
  downbeat: number;
  bpm: number;
  /** the track's length (s); Infinity without music */
  trackDuration: number;
  /** the film may start from here in the track (s) */
  startAt: number;
  length: FilmLength;
  /** in the film's order */
  items: PlanItem[];
}

export function tempoClass(bpm: number): TempoClass {
  const { fastBpm, slowBpm } = FILM.transitions;
  return bpm >= fastBpm ? 'fast' : bpm < slowBpm ? 'slow' : 'medium';
}

/** A photo's beats at this tempo: 2, 4 or 8 — whichever comes nearest to FILM.shots.photoSeconds. */
export function photoBeats(bpm: number): number {
  const period = 60 / bpm;
  const { photoSeconds, minSeconds, maxSeconds } = FILM.shots;
  const fits = [2, 4, 8].filter((b) => b * period >= minSeconds && b * period <= maxSeconds);
  const options = fits.length ? fits : [2];
  return options.reduce((best, b) =>
    Math.abs(Math.log((b * period) / photoSeconds)) < Math.abs(Math.log((best * period) / photoSeconds))
      ? b
      : best,
  );
}

const even = (v: number) => 2 * Math.floor(v / 2);

interface Bounds {
  min: number;
  ideal: number;
  max: number;
}

function itemBounds(item: PlanItem, period: number, photo: number): Bounds {
  const { minSeconds, maxSeconds, clipMaxSeconds } = FILM.shots;
  const min = Math.max(2, 2 * Math.ceil(minSeconds / (2 * period)));
  const photoMax = Math.max(min, even(maxSeconds / period));
  if (item.kind === 'image') return { min, ideal: Math.min(photoMax, Math.max(min, photo)), max: photoMax };
  // a clip: its own length (less a little for the transitions), at most FILM.shots.clipMaxSeconds
  const own = ((item.durationMs ?? 0) / 1000 - 0.3) / period;
  const max = Math.max(min, even(Math.min(own, clipMaxSeconds / period)));
  return { min, ideal: Math.min(max, Math.max(min, 2 * photo)), max };
}

/** About how many items a film of this length wants at this tempo (the edit drops what's extra). */
export function shotCount(length: FilmLength, bpm: number): number {
  const period = 60 / bpm;
  const cards = cardBeats(period);
  const content = length - (cards.title + cards.end) * period;
  return Math.max(FILM.select.minItems, Math.ceil(content / (photoBeats(bpm) * period)) + 1);
}

function cardBeats(period: number) {
  const bar = 4 * period;
  return {
    title: 4 * Math.max(1, Math.ceil(FILM.cards.titleSeconds / bar)),
    end: 4 * Math.max(1, Math.ceil(FILM.cards.endSeconds / bar)),
  };
}

/** Seconds of distance from the chosen length an ending on a mere bar costs, against a phrase's end. */
const PHRASE_PREFERENCE = 5;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

export function planFilm(input: PlanInput): FilmPlan {
  const { length } = input;
  // the beat grid: the track's, or an even pulse without music (or with too few beats to go on)
  let beats = input.beats.filter((b) => Number.isFinite(b) && b >= 0).sort((a, b) => a - b);
  let downbeat = input.downbeat;
  let bpm = input.bpm;
  const music = Number.isFinite(input.trackDuration);
  if (beats.length < 16) {
    bpm = Number.isFinite(bpm) && bpm >= FILM.tempo.min && bpm <= FILM.tempo.max ? bpm : FILM.tempo.fallback;
    beats = evenBeats(
      bpm,
      music ? input.trackDuration : length * 2 + 30,
      music ? Math.max(0, input.startAt) : 0,
    );
    downbeat = 0;
  }
  const intervals = beats.slice(1).map((b, i) => b - beats[i]!);
  const period = median(intervals) || 60 / bpm;
  bpm = 60 / period;

  // the film starts on the first downbeat at or after the start the host (or the invitation) set
  const onBar = (i: number) => (((i - downbeat) % 4) + 4) % 4 === 0;
  let d0 = beats.findIndex((b, i) => b >= input.startAt - 0.05 && onBar(i));
  if (d0 < 0) d0 = 0;
  const musicOffset = beats[d0]!;
  const F = beats.slice(d0).map((b) => b - musicOffset);
  const last = F.length - 1;

  const photo = photoBeats(bpm);
  const cards = cardBeats(period);
  let items = input.items.map((item) => ({ item, b: itemBounds(item, period, photo) }));
  const dropped: string[] = [];
  const sum = (key: keyof Bounds) => items.reduce((s, x) => s + x.b[key], 0);

  // where it ends: on a bar near the length chosen — a phrase's end (16 beats) wins unless it is far —
  // with room for the items (those that don't fit go; too few end it sooner)
  const minEnd = cards.title + cards.end + 2;
  const candidates: number[] = [];
  for (let j = 4; j <= last; j += 4) if (j >= minEnd) candidates.push(j);
  if (!candidates.length) candidates.push(last);
  const cost = (j: number) => {
    const t = F[j]!;
    return Math.abs(t - length) * (t > length ? 1.25 : 1) + (j % 16 ? PHRASE_PREFERENCE : 0);
  };
  const capacity = (j: number) => j - cards.title - cards.end;
  // the items fill the film comfortably up to half again their ideal lengths (few photos: a shorter
  // film, rather than every photo held for long); more items than the film holds: the extra ones go
  const comfortable = items.reduce(
    (s, x) => s + Math.min(x.b.max, Math.max(x.b.ideal, even(x.b.ideal * 1.5))),
    0,
  );
  const byCost = [...candidates].sort((a, b) => cost(a) - cost(b));
  let end = byCost.find((j) => capacity(j) <= comfortable) ?? candidates[0]!;

  // too many items for it: the lowest priority ones go
  while (items.length > 1 && sum('min') > capacity(end)) {
    let worst = 0;
    items.forEach((x, i) => {
      if (x.item.priority < items[worst]!.item.priority) worst = i;
    });
    dropped.push(items[worst]!.item.id);
    items = items.filter((_, i) => i !== worst);
  }

  // share the beats: from each one's ideal, toward the room there is
  const b = items.map((x) => x.b.ideal);
  let diff = capacity(end) - b.reduce((s, v) => s + v, 0);
  const order = items.map((_, i) => i);
  for (let guard = 0; diff !== 0 && guard < 10_000; guard++) {
    let moved = false;
    if (diff > 0) {
      for (const i of [...order].sort((p, q) => items[q]!.item.priority - items[p]!.item.priority)) {
        const step = Math.min(diff >= 2 ? 2 : 1, items[i]!.b.max - b[i]!);
        if (step <= 0) continue;
        b[i]! += step;
        diff -= step;
        moved = true;
        if (!diff) break;
      }
    } else {
      for (const i of [...order].sort((p, q) => items[p]!.item.priority - items[q]!.item.priority)) {
        const step = Math.min(-diff >= 2 ? 2 : 1, b[i]! - items[i]!.b.min);
        if (step <= 0) continue;
        b[i]! -= step;
        diff += step;
        moved = true;
        if (!diff) break;
      }
    }
    if (!moved) break;
  }
  // nothing more to give (every shot at its longest): the film ends sooner, on a bar
  if (diff > 0) {
    let shorter = end - diff;
    while (shorter > minEnd && shorter % 4) shorter--;
    const extra = shorter - (end - diff); // ≤ 0: beats the end card gives back (it never grows)
    end = Math.max(minEnd, shorter);
    diff = 0;
    if (extra < 0) b[b.length - 1] = Math.max(items.at(-1)?.b.min ?? 0, (b.at(-1) ?? 0) + extra);
  }

  // the shots
  const tempo = tempoClass(bpm);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const shots: Shot[] = [];
  const at = (j: number) => F[Math.min(j, last)]!;
  const push = (kind: Shot['kind'], from: number, count: number, item: PlanItem | null, index: number) => {
    shots.push({
      kind,
      id: item?.id ?? null,
      media: item?.kind ?? null,
      start: at(from),
      end: at(from + count),
      beats: count,
      transition: { type: 'cut', duration: 0 },
      clipIn: 0,
      index,
    });
  };
  let j = 0;
  push('title', 0, cards.title, null, -1);
  j = cards.title;
  items.forEach((x, i) => {
    push('item', j, b[i]!, x.item, i);
    j += b[i]!;
  });
  const endStart = j;
  push('end', endStart, Math.max(2, end - endStart), null, -1);
  const duration = shots.at(-1)!.end;

  // transitions, by tempo; the first shot and the end card dissolve in
  const { dissolveSeconds, whipSeconds } = FILM.transitions;
  let beatIndex = 0;
  shots.forEach((shot, k) => {
    const startBeat = beatIndex;
    beatIndex += shot.beats;
    if (k === 0) return;
    const prev = shots[k - 1]!;
    const room = Math.min(prev.end - prev.start, shot.end - shot.start);
    let type: Transition;
    if (k === 1 || shot.kind === 'end') type = 'dissolve';
    else if (startBeat % 16 === 0) type = tempo === 'slow' ? 'cut' : 'whip';
    else if (tempo === 'slow') type = 'dissolve';
    else if (tempo === 'medium' && k % 3 === 0) type = 'dissolve';
    else type = 'cut';
    const wanted =
      type === 'dissolve'
        ? clamp(
            shot.kind === 'end' ? 2 * period : period,
            dissolveSeconds.min,
            dissolveSeconds.max * (shot.kind === 'end' ? 1.5 : 1),
          )
        : type === 'whip'
          ? whipSeconds
          : 0;
    const duration = type === 'cut' ? 0 : Math.min(wanted, room * (type === 'whip' ? 0.4 : 0.45));
    shot.transition = { type: duration > 0 ? type : 'cut', duration };
  });

  // clips: their part starts a little in (the first moments shake), and covers the transitions
  shots.forEach((shot, k) => {
    if (shot.media !== 'video') return;
    const item = items.find((x) => x.item.id === shot.id)!.item;
    const clip = (item.durationMs ?? 0) / 1000;
    const pre = shot.transition.duration / 2;
    const post = (shots[k + 1]?.transition.duration ?? 0) / 2;
    const visible = shot.end - shot.start + pre + post;
    const spare = clip - visible;
    shot.clipIn = pre + (spare > 0 ? spare * FILM.shots.clipIn : 0);
  });

  const endCard = shots.at(-1)!;
  const fade = Math.min(FILM.audio.fadeOutSeconds, endCard.end - endCard.start);
  return {
    duration,
    musicOffset,
    fadeIn: musicOffset > 0.05 ? FILM.audio.fadeInSeconds : 0,
    fadeOut: { start: Math.max(0, duration - fade), end: duration },
    bpm,
    tempo,
    beats: F.slice(0, Math.min(last, end) + 1),
    shots,
    dropped,
  };
}

/** The shots showing at film time t: the one on screen, and the next one while a transition runs. */
export function shotsAt(
  plan: Pick<FilmPlan, 'shots'>,
  t: number,
): { shot: Shot; next: Shot | null; progress: number } | null {
  const { shots } = plan;
  for (let k = 0; k < shots.length; k++) {
    const shot = shots[k]!;
    const next = shots[k + 1];
    if (!next) return { shot, next: null, progress: 0 };
    const half = next.transition.duration / 2;
    if (t < next.start - half) return { shot, next: null, progress: 0 };
    if (half > 0 && t < next.start + half)
      return { shot, next, progress: (t - (next.start - half)) / (2 * half) };
  }
  return null;
}

/** When a shot is on screen at all: from its transition in to the end of its transition out. */
export function visibleSpan(plan: Pick<FilmPlan, 'shots'>, shot: Shot): { from: number; to: number } {
  const k = plan.shots.indexOf(shot);
  const next = plan.shots[k + 1];
  return {
    from: shot.start - shot.transition.duration / 2,
    to: shot.end + (next ? next.transition.duration / 2 : 0),
  };
}
