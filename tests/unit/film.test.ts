import { describe, expect, it } from 'vitest';
import {
  analyzeBeats,
  estimateTempo,
  evenBeats,
  firstSound,
  HOP,
  onsetEnvelope,
  trackBeats,
} from '@/features/film/beats';
import { FILM } from '@/features/film/config';
import { contains, coverRect, faceBounds, planMotion, rectAt } from '@/features/film/motion';
import {
  arrange,
  hamming,
  qualityScore,
  sameMoment,
  selectShots,
  shapeFit,
  spread,
  type Box,
  type FilmCandidate,
} from '@/features/film/select';
import {
  photoBeats,
  planFilm,
  shotCount,
  shotsAt,
  tempoClass,
  visibleSpan,
  type PlanItem,
} from '@/features/film/timeline';
import { webmDuration, withWebmDuration } from '@/features/film/webm';

// ─── helpers ────────────────────────────────────────────────────────────────────────────────────

const T0 = Date.parse('2027-06-17T17:00:00Z');
let seq = 0;
function photo(over: Partial<FilmCandidate> & { minute?: number } = {}): FilmCandidate {
  const { minute = 0, ...rest } = over;
  seq++;
  return {
    id: `p${seq}`,
    kind: 'image',
    width: 3000,
    height: 4000,
    durationMs: null,
    at: new Date(T0 + minute * 60_000).toISOString(),
    sharpness: 200,
    brightness: 0.5,
    aiQuality: null,
    // every photo its own look unless told otherwise
    phash: ((BigInt(seq) * 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn).toString(16).padStart(16, '0'),
    faces: null,
    ...rest,
  };
}
const clip = (over: Partial<FilmCandidate> & { minute?: number } = {}) =>
  photo({ kind: 'video', durationMs: 8000, width: 1080, height: 1920, ...over });

/** A seeded random stream (the same noise every run). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * A click track at `bpm` for `seconds` (at `rate` Hz): a short 1 kHz click on every beat from
 * `offset`, and on every fourth beat (the downbeats, from `downbeatAt`) a low 60 Hz thump as well —
 * with a little noise. The low band is the thump through a one-pole low-pass (what the browser's
 * OfflineAudioContext renders with a BiquadFilter).
 */
function clickTrack({
  bpm,
  seconds,
  rate = FILM.audio.analysisRate,
  offset = 0.5,
  downbeatAt = 1,
  silence = 0,
}: {
  bpm: number;
  seconds: number;
  rate?: number;
  offset?: number;
  downbeatAt?: number;
  silence?: number;
}) {
  const n = Math.round(seconds * rate);
  const full = new Float32Array(n);
  const random = rng(7);
  const period = 60 / bpm;
  const clicks: number[] = [];
  const downbeats: number[] = [];
  for (let t = silence + offset, i = 0; t < seconds - 0.1; t += period, i++) {
    clicks.push(t);
    const strong = (i - downbeatAt) % 4 === 0;
    if (strong) downbeats.push(t);
    const at = Math.round(t * rate);
    for (let k = 0; k < rate * 0.08 && at + k < n; k++) {
      const s = k / rate;
      let v = 0.5 * Math.sin(2 * Math.PI * 1000 * s) * Math.exp(-s / 0.012);
      if (strong) v += 0.8 * Math.sin(2 * Math.PI * 60 * s) * Math.exp(-s / 0.05);
      full[at + k]! += v;
    }
  }
  for (let i = Math.round(silence * rate); i < n; i++) full[i]! += (random() - 0.5) * 0.02;
  const low = new Float32Array(n);
  const a = Math.exp((-2 * Math.PI * FILM.audio.lowBandHz) / rate);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y = (1 - a) * full[i]! + a * y;
    low[i] = y;
  }
  return { full, low, rate, clicks, downbeats };
}

const nearest = (list: number[], t: number) =>
  list.reduce((best, v) => (Math.abs(v - t) < Math.abs(best - t) ? v : best), Infinity);

// ─── choosing the shots ─────────────────────────────────────────────────────────────────────────

describe('the film’s shots', () => {
  it('weighs sharpness, exposure, faces and the film’s shape', () => {
    const base = photo();
    expect(qualityScore({ ...base, sharpness: 400 }, 'vertical')).toBeGreaterThan(
      qualityScore({ ...base, sharpness: 20 }, 'vertical'),
    );
    expect(qualityScore({ ...base, brightness: 0.5 }, 'vertical')).toBeGreaterThan(
      qualityScore({ ...base, brightness: 0.08 }, 'vertical'),
    );
    const face: Box = [0.4, 0.3, 0.2, 0.15];
    expect(qualityScore({ ...base, faces: [face] }, 'vertical')).toBeGreaterThan(
      qualityScore({ ...base, faces: [] }, 'vertical'),
    );
    // unknown faces (face search didn't look) sit between none and some
    expect(qualityScore({ ...base, faces: null }, 'vertical')).toBeGreaterThan(
      qualityScore({ ...base, faces: [] }, 'vertical'),
    );
    expect(shapeFit({ width: 3000, height: 4000 }, 'vertical')).toBe(1);
    expect(shapeFit({ width: 4000, height: 3000 }, 'vertical')).toBeLessThan(0.5);
    expect(shapeFit({ width: 4000, height: 3000 }, 'horizontal')).toBe(1);
  });

  it('keeps one photo of each moment: the same picture, or a burst', () => {
    expect(hamming('ffffffffffffffff', 'fffffffffffffff0')).toBe(4);
    expect(hamming(null, 'ffffffffffffffff')).toBe(64);
    // the same picture twice (1 bit apart), forty minutes apart: the sharper one stays
    const a = photo({ phash: 'f0f0f0f0f0f0f0f0', sharpness: 90, minute: 10 });
    const b = photo({ phash: 'f0f0f0f0f0f0f0f1', sharpness: 400, minute: 50 });
    // a burst: 16 bits apart, a second apart — the better exposed one stays
    const c = photo({ phash: '0f0f0f0f0f0f0f0f', brightness: 0.1, minute: 20 });
    const d = photo({ phash: '0f0f0f0f0f0ff0f0', brightness: 0.5, minute: 20.02 });
    // as alike as the burst, but twenty minutes later: another moment
    const e = photo({ phash: 'f0f00f0f0f0ff0f0', minute: 40 });
    expect(sameMoment(a, b)).toBe(true);
    expect(sameMoment(c, d)).toBe(true);
    expect(sameMoment(d, e)).toBe(false);
    const others = Array.from({ length: 8 }, (_, i) => photo({ minute: 60 + i * 5 }));
    const { items } = selectShots([a, b, c, d, e, ...others], { count: 13, shape: 'vertical' });
    const ids = items.map((i) => i.id);
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(a.id);
    expect(ids).toContain(d.id);
    expect(ids).not.toContain(c.id);
    expect(ids).toContain(e.id);
  });

  it('spreads over the event’s timeline, busy parts and quiet ones', () => {
    // three hours: a busy dance floor at the end, a few photos early on
    const early = Array.from({ length: 4 }, (_, i) => photo({ minute: i * 10, sharpness: 60 }));
    const busy = Array.from({ length: 40 }, (_, i) => photo({ minute: 120 + i, sharpness: 500 }));
    const { items } = selectShots([...early, ...busy], { count: 8, shape: 'vertical' });
    expect(items).toHaveLength(8);
    const minutes = items.map((i) => (Date.parse(i.at) - T0) / 60_000);
    expect(Math.min(...minutes)).toBeLessThan(40); // the early part is there, though its photos are weaker
    expect(Math.max(...minutes)).toBeGreaterThan(140);
    // in time order
    expect([...minutes].sort((x, y) => x - y)).toEqual(minutes);
  });

  it('spread gives an empty stretch’s turn to the best left', () => {
    const pool = [0, 1, 2, 100].map((t, i) => ({ t, score: i === 1 ? 0.9 : 0.5 }));
    expect(spread(pool, 3)).toHaveLength(3);
    expect(spread(pool, 0)).toEqual([]);
    expect(spread(pool, 9)).toHaveLength(4);
  });

  it('mixes photos with short clips, and never a clip too short', () => {
    const photos = Array.from({ length: 20 }, (_, i) => photo({ minute: i * 6 }));
    const clips = Array.from({ length: 6 }, (_, i) => clip({ minute: i * 20 + 3 }));
    const tiny = clip({ durationMs: 900, minute: 50, sharpness: 900 });
    const { items } = selectShots([...photos, ...clips, tiny], { count: 10, shape: 'vertical' });
    expect(items).toHaveLength(10);
    expect(items.filter((i) => i.kind === 'video')).toHaveLength(Math.round(10 * FILM.select.clipShare));
    expect(items.map((i) => i.id)).not.toContain(tiny.id);
  });

  it('keeps the host’s pins and order and leaves out what they excluded', () => {
    const all = Array.from({ length: 12 }, (_, i) => photo({ minute: i * 10 }));
    const weak = photo({ minute: 500, sharpness: 5, brightness: 0.05 });
    const pinned = [weak.id, all[3]!.id];
    const { items, priority } = selectShots([...all, weak], {
      count: 5,
      shape: 'vertical',
      choice: { pinned, excluded: [all[0]!.id, all[11]!.id], order: [weak.id, all[3]!.id] },
    });
    const ids = items.map((i) => i.id);
    expect(ids).toHaveLength(5);
    expect(ids).toContain(weak.id);
    expect(ids).not.toContain(all[0]!.id);
    expect(ids).not.toContain(all[11]!.id);
    // the host's order among the shots they placed (the weak late photo before an early one)
    expect(ids.indexOf(weak.id)).toBeLessThan(ids.indexOf(all[3]!.id));
    const unpinned = ids.find((id) => !pinned.includes(id))!;
    expect(priority.get(weak.id)!).toBeGreaterThan(priority.get(unpinned)!);
    // pins go in even beyond the count
    const many = selectShots(all, {
      count: 2,
      shape: 'vertical',
      choice: { pinned: all.slice(0, 4).map((p) => p.id), excluded: [], order: [] },
    });
    expect(many.items).toHaveLength(4);
  });

  it('arrange puts new shots by their time among the host’s order', () => {
    const a = photo({ minute: 10 });
    const b = photo({ minute: 20 });
    const c = photo({ minute: 30 });
    const d = photo({ minute: 25 });
    expect(arrange([a, b, c, d], [c.id, a.id]).map((i) => i.id)).toEqual([c.id, a.id, b.id, d.id]);
    expect(arrange([a, b, c], []).map((i) => i.id)).toEqual([a.id, b.id, c.id]);
  });
});

// ─── the beat ───────────────────────────────────────────────────────────────────────────────────

describe('reading the beat', () => {
  it('finds a click track’s tempo, beats and downbeats', () => {
    const track = clickTrack({ bpm: 120, seconds: 24 });
    const a = analyzeBeats(track.full, track.low, track.rate);
    expect(a.bpm).toBeGreaterThan(119);
    expect(a.bpm).toBeLessThan(121);
    expect(a.confidence).toBeGreaterThan(0.2);
    // every click (past the first two seconds) has a beat within 25 ms
    for (const c of track.clicks.filter((t) => t > 2 && t < 22)) {
      expect(Math.abs(nearest(a.beats, c) - c)).toBeLessThan(0.025);
    }
    // bars start on the thumps
    const downbeatTimes = a.beats.filter((_, i) => i >= a.downbeat && (i - a.downbeat) % 4 === 0);
    for (const t of downbeatTimes.filter((x) => x > 2 && x < 22))
      expect(Math.abs(nearest(track.downbeats, t) - t)).toBeLessThan(0.025);
  });

  it('settles slow and fast tempos in the right octave', () => {
    // (a tempo as far above 120 as another is below — 170 and 85 — reads either way, like any beat tracker)
    for (const bpm of [84, 96, 140, 160]) {
      const track = clickTrack({ bpm, seconds: 30, offset: 0.3 });
      const env = onsetEnvelope(track.full, track.low);
      const { bpm: found } = estimateTempo(env, track.rate / HOP);
      expect(Math.abs(found - bpm)).toBeLessThan(1.5);
    }
  });

  it('beats keep to the tempo', () => {
    const track = clickTrack({ bpm: 100, seconds: 20 });
    const frames = trackBeats(onsetEnvelope(track.full, track.low), track.rate / HOP, 100);
    const gaps = frames.slice(1).map((f, i) => ((f - frames[i]!) * HOP) / track.rate);
    for (const g of gaps.slice(2)) expect(Math.abs(g - 0.6)).toBeLessThan(0.03);
  });

  it('skips leading silence, and falls back to an even pulse without a beat', () => {
    // 1.5 s of silence, then faint noise, then the first click half a second later
    const track = clickTrack({ bpm: 120, seconds: 12, silence: 1.5 });
    expect(firstSound(track.full, track.rate)).toBeCloseTo(2, 1);
    const quiet = analyzeBeats(new Float32Array(FILM.audio.analysisRate * 10), null, FILM.audio.analysisRate);
    expect(quiet.confidence).toBe(0);
    expect(quiet.bpm).toBe(FILM.tempo.fallback);
    expect(quiet.beats.length).toBeGreaterThan(10);
    expect(evenBeats(120, 2)).toEqual([0, 0.5, 1, 1.5, 2]);
  });
});

// ─── the edit ───────────────────────────────────────────────────────────────────────────────────

const items = (n: number, over: (i: number) => Partial<PlanItem> = () => ({})): PlanItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    kind: 'image',
    durationMs: null,
    priority: 1 - i / 1000,
    ...over(i),
  }));

function grid(bpm: number, seconds: number) {
  return { beats: evenBeats(bpm, seconds), downbeat: 0, bpm, trackDuration: seconds, startAt: 0 };
}

describe('the edit', () => {
  it('ends on the phrase nearest to the length chosen, every cut on a beat', () => {
    for (const length of FILM.lengths) {
      const plan = planFilm({ ...grid(120, 200), length, items: items(60) });
      const phrase = 16 * 0.5;
      expect(Math.abs(plan.duration - length)).toBeLessThanOrEqual(phrase / 2 + 1e-6);
      expect(plan.beats.length - 1).toBe(Math.round(plan.duration / 0.5));
      expect((plan.beats.length - 1) % 16).toBe(0);
      const beatSet = new Set(plan.beats.map((b) => b.toFixed(4)));
      for (const shot of plan.shots) {
        expect(beatSet.has(shot.start.toFixed(4))).toBe(true);
        expect(beatSet.has(shot.end.toFixed(4))).toBe(true);
      }
      // one after the other, the title first and the end card last
      plan.shots.slice(1).forEach((s, i) => expect(s.start).toBeCloseTo(plan.shots[i]!.end, 6));
      expect(plan.shots[0]!.kind).toBe('title');
      expect(plan.shots.at(-1)!.kind).toBe('end');
      expect(plan.fadeOut.end).toBeCloseTo(plan.duration, 6);
      expect(plan.fadeOut.start).toBeGreaterThanOrEqual(plan.shots.at(-1)!.start - 1e-6);
      for (const s of plan.shots.filter((x) => x.kind === 'item')) {
        expect(s.end - s.start).toBeGreaterThanOrEqual(FILM.shots.minSeconds - 1e-6);
        expect(s.end - s.start).toBeLessThanOrEqual(FILM.shots.maxSeconds + 1e-6);
      }
    }
  });

  it('holds a photo for whole beats near two seconds, a clip for longer', () => {
    expect(photoBeats(120)).toBe(4);
    expect(photoBeats(90)).toBe(4);
    expect(photoBeats(170)).toBe(8);
    expect(photoBeats(72)).toBe(2);
    const plan = planFilm({
      ...grid(120, 120),
      length: 30,
      items: items(14, (i) => (i % 4 === 1 ? { kind: 'video', durationMs: 7000 } : {})),
    });
    const clipShots = plan.shots.filter((s) => s.media === 'video');
    const photoShots = plan.shots.filter((s) => s.media === 'image');
    expect(clipShots.length).toBeGreaterThan(0);
    const avg = (list: typeof clipShots) => list.reduce((s, x) => s + x.end - x.start, 0) / list.length;
    expect(avg(clipShots)).toBeGreaterThan(avg(photoShots));
    for (const shot of clipShots) {
      const { from, to } = visibleSpan(plan, shot);
      // the clip covers its time on screen, transitions included
      expect(shot.clipIn - (shot.start - from)).toBeGreaterThanOrEqual(-1e-9);
      expect(shot.clipIn + (to - shot.start)).toBeLessThanOrEqual(7 + 1e-9);
    }
  });

  it('chooses transitions by tempo', () => {
    expect(tempoClass(140)).toBe('fast');
    expect(tempoClass(110)).toBe('medium');
    expect(tempoClass(80)).toBe('slow');
    const kinds = (bpm: number) =>
      planFilm({ ...grid(bpm, 240), length: 60, items: items(40) })
        .shots.slice(2, -1)
        .map((s) => s.transition.type);
    const fast = kinds(140);
    expect(fast).not.toContain('dissolve');
    expect(fast).toContain('whip');
    const slow = kinds(80);
    expect(slow.filter((k) => k === 'dissolve').length).toBeGreaterThan(slow.length / 2);
    // into the first photo and into the end card: a dissolve
    const plan = planFilm({ ...grid(140, 240), length: 60, items: items(40) });
    expect(plan.shots[1]!.transition.type).toBe('dissolve');
    expect(plan.shots.at(-1)!.transition.type).toBe('dissolve');
  });

  it('ends sooner with few photos, and drops the least wanted when there are too many', () => {
    const few = planFilm({ ...grid(120, 200), length: 90, items: items(3) });
    expect(few.duration).toBeLessThan(40);
    expect(few.shots.filter((s) => s.kind === 'item')).toHaveLength(3);
    expect((few.beats.length - 1) % 4).toBe(0);
    const pinnedLast = items(60, (i) => (i === 59 ? { priority: 99 } : {}));
    const many = planFilm({ ...grid(120, 200), length: 30, items: pinnedLast });
    expect(many.dropped.length).toBeGreaterThan(0);
    expect(many.dropped).not.toContain('i59');
    expect(many.shots.map((s) => s.id)).toContain('i59');
    expect(shotCount(30, 120)).toBeGreaterThanOrEqual(FILM.select.minItems);
  });

  it('keeps within a short song, starts on a downbeat after the start, and plays without music', () => {
    const short = planFilm({ ...grid(120, 12), length: 30, items: items(10) });
    expect(short.duration).toBeLessThanOrEqual(12);
    const late = planFilm({
      beats: evenBeats(120, 120, 0.25),
      downbeat: 2,
      bpm: 120,
      trackDuration: 120,
      startAt: 10,
      length: 30,
      items: items(20),
    });
    expect(late.musicOffset).toBeGreaterThanOrEqual(10);
    // beat index 2 is a downbeat: bars fall at 0.25 + 0.5 × (2 + 4k)
    expect(((late.musicOffset - 0.25) / 0.5 - 2) % 4).toBeCloseTo(0, 6);
    expect(late.fadeIn).toBeGreaterThan(0);
    const silent = planFilm({
      beats: [],
      downbeat: 0,
      bpm: NaN,
      trackDuration: Infinity,
      startAt: 0,
      length: 60,
      items: items(40),
    });
    expect(silent.bpm).toBeCloseTo(FILM.tempo.fallback, 2);
    expect(Math.abs(silent.duration - 60)).toBeLessThan(6);
  });

  it('shows two shots during a transition, one otherwise', () => {
    const plan = planFilm({ ...grid(80, 200), length: 30, items: items(12) });
    const second = plan.shots[2]!;
    expect(second.transition.type).not.toBe('cut');
    const mid = shotsAt(plan, second.start);
    expect(mid?.next).toBe(second);
    expect(mid?.progress).toBeCloseTo(0.5, 6);
    const after = shotsAt(plan, second.start + second.transition.duration);
    expect(after?.shot).toBe(second);
    expect(after?.next).toBeNull();
    expect(shotsAt(plan, -1)?.shot.kind).toBe('title');
    expect(shotsAt(plan, plan.duration + 5)?.shot.kind).toBe('end');
  });
});

// ─── the motion ─────────────────────────────────────────────────────────────────────────────────

describe('the motion over a photo', () => {
  const vertical = 1080 / 1920;
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);

  it('pushes toward the faces and never leaves one out', () => {
    const faces: Box[] = [
      [0.72, 0.3, 0.1, 0.13],
      [0.84, 0.35, 0.09, 0.12],
    ];
    for (let index = 0; index < 6; index++) {
      const m = planMotion({ width: 4000, height: 3000, aspect: vertical, faces, index });
      const keep = faceBounds(faces, 4000, 3000)!;
      for (const p of steps) {
        const r = rectAt(m, p);
        expect(r.w / r.h).toBeCloseTo(vertical, 6);
        expect(contains(r, keep)).toBe(true);
        expect(contains({ x: 0, y: 0, w: 4000, h: 3000 }, r)).toBe(true);
      }
      // it closes in (or opens out) by FILM.motion.push
      const zoom = Math.max(m.from.w, m.to.w) / Math.min(m.from.w, m.to.w);
      expect(zoom).toBeGreaterThan(1.05);
    }
  });

  it('holds a group wider than the frame by going past the photo’s edges', () => {
    const faces: Box[] = [
      [0.05, 0.4, 0.08, 0.1],
      [0.85, 0.42, 0.08, 0.1],
    ];
    const m = planMotion({ width: 4000, height: 3000, aspect: vertical, faces, index: 0 });
    const keep = faceBounds(faces, 4000, 3000)!;
    expect(keep.w).toBeGreaterThan(coverRect(4000, 3000, vertical).w);
    for (const p of steps) expect(contains(rectAt(m, p), keep)).toBe(true);
    expect(m.from.w).toBeGreaterThan(coverRect(4000, 3000, vertical).w);
  });

  it('pans or zooms inside the photo without faces', () => {
    for (let index = 0; index < 4; index++) {
      const m = planMotion({ width: 3000, height: 4000, aspect: 1920 / 1080, faces: null, index });
      for (const p of steps) {
        const r = rectAt(m, p);
        expect(r.w / r.h).toBeCloseTo(1920 / 1080, 6);
        expect(contains({ x: 0, y: 0, w: 3000, h: 4000 }, r)).toBe(true);
      }
      expect(m.from).not.toEqual(m.to);
    }
  });
});

// ─── the recorded WebM's duration ───────────────────────────────────────────────────────────────

describe('the WebM duration', () => {
  /** What a browser's recorder writes: the EBML header, a live segment, Info without a duration, a cluster. */
  function recorded(): Uint8Array<ArrayBuffer> {
    const bytes = [
      ...[0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01],
      ...[0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ...[0x15, 0x49, 0xa9, 0x66, 0x8e],
      ...[0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40],
      ...[0x4d, 0x80, 0x84, 0x74, 0x65, 0x73, 0x74],
      ...[0x16, 0x54, 0xae, 0x6b, 0x80],
      ...[
        0x1f, 0x43, 0xb6, 0x75, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe7, 0x81, 0x00, 0xa3, 0x82,
        0x81, 0x00,
      ],
    ];
    return new Uint8Array(bytes);
  }

  it('writes the duration into Info and leaves the rest as it was', () => {
    const input = recorded();
    expect(webmDuration(input)).toBeNull();
    const out = withWebmDuration(input, 12_345);
    expect(out.length).toBe(input.length + 11);
    expect(webmDuration(out)).toBeCloseTo(12_345, 6);
    // the tracks and the cluster, byte for byte
    expect([...out.slice(-24)]).toEqual([...input.slice(-24)]);
    // written again: replaced in place
    const again = withWebmDuration(out, 999);
    expect(again.length).toBe(out.length);
    expect(webmDuration(again)).toBeCloseTo(999, 6);
  });

  it('leaves a file it can’t read as it is', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5]);
    expect(withWebmDuration(junk, 1000)).toBe(junk);
  });
});
