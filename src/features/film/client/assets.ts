import { FILM } from '../config';
import { planMotion, type Motion } from '../motion';
import type { Box } from '../select';
import { shotsAt, visibleSpan, type FilmPlan, type Shot } from '../timeline';
import type { Picture, Sources } from './paint';

/**
 * The film's pictures in the host's browser: every shot's thumbnail first (small — a stand-in while
 * the real picture loads, and the soft backdrop beyond a photo's edges), then each photo's display
 * version and each clip's video just ahead of its shot, let go of once it has passed (a long film
 * never holds every photo at full size). The frame-by-frame encoder waits for each frame's pictures
 * and seeks each clip to its frame; the real-time preview and recording play the clips instead.
 * A clip this browser can't play shows its still.
 */

export interface AssetItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string | null;
  display: string | null;
  video: string | null;
  faces: Box[] | null;
}

interface Entry {
  item: AssetItem;
  thumb: Picture | null;
  backdrop: Picture | null;
  full: Picture | null;
  fullLoad: Promise<void> | null;
  video: HTMLVideoElement | null;
  videoLoad: Promise<void> | null;
  videoFailed: boolean;
}

const close = (p: Picture | null) => {
  const src = p?.source as { close?: () => void } | undefined;
  src?.close?.();
};

async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return res.blob();
}

/** A picture from a blob, its long edge at most `maxEdge` (never enlarged). */
export async function pictureFrom(blob: Blob, maxEdge: number): Promise<Picture> {
  const bitmap = await createImageBitmap(blob);
  const long = Math.max(bitmap.width, bitmap.height);
  if (long <= maxEdge) return { source: bitmap, width: bitmap.width, height: bitmap.height };
  const scale = maxEdge / long;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
    bitmap.close();
    return { source: resized, width, height };
  } catch {
    // no resize options here (older Safari): through a canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { source: canvas, width, height };
  }
}

/** A tiny copy (a blur when drawn large). */
function tiny(p: Picture): Picture {
  const long = 40;
  const scale = long / Math.max(p.width, p.height);
  const width = Math.max(2, Math.round(p.width * scale));
  const height = Math.max(2, Math.round(p.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(p.source, 0, 0, width, height);
  return { source: canvas, width, height };
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('playsinline', '');
    const timer = setTimeout(() => fail(new Error('video timeout')), 25_000);
    const done = () => {
      clearTimeout(timer);
      v.onloadeddata = null;
      v.onerror = null;
    };
    const fail = (e: unknown) => {
      done();
      v.removeAttribute('src');
      v.load();
      reject(e instanceof Error ? e : new Error('video'));
    };
    v.onloadeddata = () => {
      done();
      resolve(v);
    };
    v.onerror = () => fail(new Error('video decode'));
    v.src = url;
  });
}

/** Seeks a clip to `time` (s) and waits for the frame there. */
export function seekVideo(v: HTMLVideoElement, time: number): Promise<void> {
  const end = Number.isFinite(v.duration) ? Math.max(0, v.duration - 0.04) : time;
  const target = Math.min(Math.max(0, time), end);
  if (Math.abs(v.currentTime - target) < 0.5 / FILM.fps && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      v.removeEventListener('seeked', finish);
      resolve();
    };
    const timer = setTimeout(finish, 4000);
    v.addEventListener('seeked', finish);
    v.currentTime = target;
  });
}

export class FilmAssets implements Sources {
  private entries = new Map<string, Entry>();
  private motions = new Map<Shot, { motion: Motion; width: number; height: number }>();
  private queue: (() => Promise<void>)[] = [];
  private running = 0;
  private disposed = false;
  /** the long edge photos are loaded at: a little more than the film's (the push closes in) */
  private readonly maxEdge: number;

  constructor(
    items: AssetItem[],
    private readonly film: { width: number; height: number },
  ) {
    for (const item of items)
      this.entries.set(item.id, {
        item,
        thumb: null,
        backdrop: null,
        full: null,
        fullLoad: null,
        video: null,
        videoLoad: null,
        videoFailed: false,
      });
    this.maxEdge = Math.round(Math.max(film.width, film.height) * 1.25);
  }

  /** Every shot's thumbnail (in parallel, a few at a time). Missing ones leave the shot to its full picture. */
  async prepare(plan: FilmPlan, onProgress?: (done: number, total: number) => void): Promise<void> {
    const ids = [...new Set(plan.shots.flatMap((s) => (s.id ? [s.id] : [])))];
    let done = 0;
    await Promise.all(
      ids.map((id) =>
        this.limit(async () => {
          const e = this.entries.get(id);
          if (e && !e.thumb && (e.item.thumb || e.item.display)) {
            try {
              e.thumb = await pictureFrom(await fetchBlob((e.item.thumb ?? e.item.display)!), 480);
              e.backdrop = tiny(e.thumb);
            } catch {
              // the full picture will stand in
            }
          }
          onProgress?.(++done, ids.length);
        }),
      ),
    );
  }

  private limit(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        try {
          await task();
        } finally {
          resolve();
        }
      });
      this.pump();
    });
  }

  private pump() {
    while (this.running < 3 && this.queue.length) {
      const task = this.queue.shift()!;
      this.running++;
      void task().finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private loadFull(e: Entry): Promise<void> {
    if (e.full || !e.item.display) return Promise.resolve();
    e.fullLoad ??= this.limit(async () => {
      try {
        const p = await pictureFrom(await fetchBlob(e.item.display!), this.maxEdge);
        if (this.disposed) return close(p);
        e.full = p;
        if (!e.backdrop) e.backdrop = tiny(p);
      } catch {
        // the thumbnail stands in
      }
    }).finally(() => {
      e.fullLoad = null;
    });
    return e.fullLoad;
  }

  private loadVideo(e: Entry): Promise<void> {
    if (e.video || e.videoFailed || !e.item.video) return Promise.resolve();
    e.videoLoad ??= loadVideo(e.item.video)
      .then((v) => {
        if (this.disposed) {
          v.removeAttribute('src');
          v.load();
        } else e.video = v;
      })
      .catch(() => {
        // this browser can't play it (an iPhone's HEVC on another system…): its still instead
        e.videoFailed = true;
      })
      .finally(() => {
        e.videoLoad = null;
      });
    return e.videoLoad;
  }

  private load(shot: Shot): Promise<void> {
    const e = shot.id ? this.entries.get(shot.id) : undefined;
    if (!e) return Promise.resolve();
    // a clip's still loads too (shown if the clip can't play)
    return Promise.all([this.loadFull(e), shot.media === 'video' ? this.loadVideo(e) : null]).then(
      () => undefined,
    );
  }

  /** Starts loading the shots on screen from `t` to `t + ahead`; lets go of the ones already past. */
  want(plan: FilmPlan, t: number, ahead = 5): void {
    for (const shot of plan.shots) {
      if (!shot.id) continue;
      const span = visibleSpan(plan, shot);
      if (span.to >= t - 0.5 && span.from <= t + ahead) void this.load(shot);
      else if (span.to < t - 1.5) this.release(shot.id);
    }
  }

  private release(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.full) {
      close(e.full);
      e.full = null;
    }
    if (e.video) {
      e.video.pause();
      e.video.removeAttribute('src');
      e.video.load();
      e.video = null;
    }
  }

  /** The frame at `t` can be painted: its pictures loaded, its clips at their frames. */
  async ready(plan: FilmPlan, t: number): Promise<void> {
    this.want(plan, t);
    const now = shotsAt(plan, t);
    if (!now) return;
    const shots = [now.shot, now.next].filter((s): s is Shot => !!s?.id);
    await Promise.all(shots.map((s) => this.load(s)));
    await Promise.all(
      shots.map((s) => {
        const v = s.media === 'video' ? this.entries.get(s.id!)?.video : null;
        return v ? seekVideo(v, s.clipIn + (t - s.start)) : null;
      }),
    );
  }

  /** Real time: the clips on screen play from their frame; the others wait at their in-point. */
  sync(plan: FilmPlan, t: number, playing: boolean): void {
    for (const shot of plan.shots) {
      if (shot.media !== 'video' || !shot.id) continue;
      const v = this.entries.get(shot.id)?.video;
      if (!v) continue;
      const span = visibleSpan(plan, shot);
      const want = shot.clipIn + (t - shot.start);
      if (playing && t >= span.from - 0.05 && t <= span.to) {
        if (v.paused) {
          v.currentTime = Math.max(0, want);
          void v.play().catch(() => undefined);
        } else if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = Math.max(0, want);
      } else {
        if (!v.paused) v.pause();
        const parked = shot.clipIn - (shot.start - span.from);
        if (t < span.from && Math.abs(v.currentTime - parked) > 0.1 && !v.seeking)
          v.currentTime = Math.max(0, parked);
      }
    }
  }

  picture(shot: Shot): Picture | null {
    const e = shot.id ? this.entries.get(shot.id) : undefined;
    if (!e) return null;
    if (shot.media === 'video' && e.video && e.video.readyState >= 2 && e.video.videoWidth)
      return { source: e.video, width: e.video.videoWidth, height: e.video.videoHeight };
    return e.full ?? e.thumb;
  }

  backdrop(shot: Shot): Picture | null {
    const e = shot.id ? this.entries.get(shot.id) : undefined;
    return e?.backdrop ?? null;
  }

  motion(shot: Shot) {
    const cached = this.motions.get(shot);
    if (cached) return cached;
    const e = shot.id ? this.entries.get(shot.id) : undefined;
    const shape = e?.thumb ?? e?.full;
    if (!e || !shape) return null;
    // in a fixed frame of the picture's shape: the same movement whichever copy is drawn
    const height = 1000;
    const width = (1000 * shape.width) / shape.height;
    const m = {
      motion: planMotion({
        width,
        height,
        aspect: this.film.width / this.film.height,
        faces: e.item.faces,
        index: shot.index,
      }),
      width,
      height,
    };
    this.motions.set(shot, m);
    return m;
  }

  /** Lets go of everything (the page moves on). */
  dispose(): void {
    this.disposed = true;
    for (const [id, e] of this.entries) {
      this.release(id);
      close(e.thumb);
      e.thumb = null;
    }
    this.queue = [];
  }
}
