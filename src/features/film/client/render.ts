import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { FILM, type FilmQuality } from '../config';
import type { FilmPlan } from '../timeline';
import { withWebmDuration } from '../webm';
import type { FilmAssets } from './assets';
import { paintFrame, type CardStyle } from './paint';

/**
 * Making the film in the browser. Where the browser can encode H.264 (WebCodecs), frame by frame —
 * faster than real time, every frame exact — with the soundtrack as AAC (or Opus where AAC isn't
 * offered), both put into an MP4 by mp4-muxer. Elsewhere, the fallback: the same frames painted in
 * real time on a canvas and recorded with MediaRecorder together with the soundtrack (MP4 where the
 * browser records it, else WebM — with its duration written in). The preview plays the same way,
 * to the screen and the speakers.
 */

export type Engine =
  { kind: 'webcodecs'; video: string; audio: 'aac' | 'opus' } | { kind: 'recorder'; mime: string };

export interface FilmOutput {
  blob: Blob;
  type: string;
  ext: 'mp4' | 'webm';
  engine: Engine['kind'];
}

type Size = { width: number; height: number };

/** H.264 profiles to try, by level (1080p: 4.0; 720p: 3.1). */
const avcCodecs = (size: Size) => {
  const level = size.width * size.height > 1280 * 720 ? '28' : '1f';
  return [`avc1.6400${level}`, `avc1.4d00${level}`, `avc1.42e0${level}`];
};

const RECORDER_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** Test hook: an end-to-end test may force the fallback (`window.__badookFilmEngine = 'recorder'`). */
declare global {
  interface Window {
    __badookFilmEngine?: 'recorder';
  }
}

/** The best way this browser can make a film of this size (null: it can't at all). */
export async function pickEngine(size: Size, quality: FilmQuality): Promise<Engine | null> {
  const bitrate = FILM.encode.videoBitrate[quality];
  if (
    typeof window !== 'undefined' &&
    window.__badookFilmEngine !== 'recorder' &&
    typeof VideoEncoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  ) {
    let video: string | null = null;
    for (const codec of avcCodecs(size)) {
      try {
        const s = await VideoEncoder.isConfigSupported({
          codec,
          width: size.width,
          height: size.height,
          bitrate,
          framerate: FILM.fps,
          avc: { format: 'avc' },
        });
        if (s.supported) {
          video = codec;
          break;
        }
      } catch {
        // not this one
      }
    }
    if (video) {
      for (const [audio, codec] of [
        ['aac', 'mp4a.40.2'],
        ['opus', 'opus'],
      ] as const) {
        try {
          const s = await AudioEncoder.isConfigSupported({
            codec,
            sampleRate: FILM.audio.sampleRate,
            numberOfChannels: FILM.audio.channels,
            bitrate: FILM.encode.audioBitrate,
          });
          if (s.supported) return { kind: 'webcodecs', video, audio };
        } catch {
          // not this one
        }
      }
    }
  }
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
  if (!('captureStream' in HTMLCanvasElement.prototype)) return null;
  const mime = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  return mime ? { kind: 'recorder', mime } : null;
}

/** 1080p unless the device looks weak (little memory, few cores): 720p there. */
export function suggestedQuality(): FilmQuality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) return 'light';
  return 'full';
}

export interface RenderInput {
  plan: FilmPlan;
  size: Size;
  quality: FilmQuality;
  assets: FilmAssets;
  card: CardStyle;
  soundtrack: AudioBuffer;
}

const aborted = () => new DOMException('aborted', 'AbortError');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function canvasOf(size: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

/** The film, with `onProgress` (0..1) along the way; rejects with an AbortError when stopped. */
export async function renderFilm(
  input: RenderInput,
  engine: Engine,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<FilmOutput> {
  return engine.kind === 'webcodecs'
    ? renderWithCodecs(input, engine, onProgress, signal)
    : renderWithRecorder(input, engine, onProgress, signal);
}

async function renderWithCodecs(
  { plan, size, quality, assets, card, soundtrack }: RenderInput,
  engine: Extract<Engine, { kind: 'webcodecs' }>,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<FilmOutput> {
  const fps = FILM.fps;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: size.width, height: size.height, frameRate: fps },
    audio: { codec: engine.audio, numberOfChannels: FILM.audio.channels, sampleRate: FILM.audio.sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure: unknown = null;
  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  const audio = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  try {
    video.configure({
      codec: engine.video,
      width: size.width,
      height: size.height,
      bitrate: FILM.encode.videoBitrate[quality],
      framerate: fps,
      avc: { format: 'avc' },
    });
    audio.configure({
      codec: engine.audio === 'aac' ? 'mp4a.40.2' : 'opus',
      sampleRate: FILM.audio.sampleRate,
      numberOfChannels: FILM.audio.channels,
      bitrate: FILM.encode.audioBitrate,
    });

    // the soundtrack first (quick), in tenths of a second
    const rate = FILM.audio.sampleRate;
    const channels = FILM.audio.channels;
    const step = rate / 10;
    for (let i = 0; i < soundtrack.length; i += step) {
      const n = Math.min(step, soundtrack.length - i);
      const data = new Float32Array(n * channels);
      for (let c = 0; c < channels; c++)
        data.set(
          soundtrack.getChannelData(Math.min(c, soundtrack.numberOfChannels - 1)).subarray(i, i + n),
          c * n,
        );
      const chunk = new AudioData({
        format: 'f32-planar',
        sampleRate: rate,
        numberOfFrames: n,
        numberOfChannels: channels,
        timestamp: Math.round((i * 1e6) / rate),
        data,
      });
      audio.encode(chunk);
      chunk.close();
    }
    await audio.flush();

    // then every frame
    const canvas = canvasOf(size);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const frames = Math.max(1, Math.round(plan.duration * fps));
    const keyEvery = fps * FILM.encode.keyframeSeconds;
    for (let f = 0; f < frames; f++) {
      if (signal.aborted) throw aborted();
      if (failure) throw failure;
      const t = f / fps;
      await assets.ready(plan, t);
      paintFrame(ctx, t, plan, size.width, size.height, assets, card);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((f * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      });
      video.encode(frame, { keyFrame: f % keyEvery === 0 });
      frame.close();
      while (video.encodeQueueSize > FILM.encode.queue) await sleep(2);
      onProgress((f + 1) / frames);
    }
    await video.flush();
    if (failure) throw failure;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    return { blob, type: 'video/mp4', ext: 'mp4', engine: 'webcodecs' };
  } finally {
    if (video.state !== 'closed') video.close();
    if (audio.state !== 'closed') audio.close();
  }
}

/**
 * Plays the film in real time on `canvas` — to the speakers (the preview) or into a MediaStream (the
 * recording) — calling `onTime` along the way; resolves when it ends or is stopped.
 */
export async function playFilm({
  plan,
  size,
  assets,
  card,
  soundtrack,
  canvas,
  signal,
  onTime,
  record,
}: {
  plan: FilmPlan;
  size: Size;
  assets: FilmAssets;
  card: CardStyle;
  soundtrack: AudioBuffer;
  canvas: HTMLCanvasElement;
  signal: AbortSignal;
  onTime?: (t: number) => void;
  /** set up the recording from the canvas's and the soundtrack's streams (the fallback) */
  record?: (video: MediaStreamTrack, audio: MediaStreamTrack | null) => { start(): void };
}): Promise<void> {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const audioCtx = new AudioContext({ sampleRate: FILM.audio.sampleRate, latencyHint: 'playback' });
  const stream = record ? canvas.captureStream(0) : null;
  const track = stream?.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const destination = record ? audioCtx.createMediaStreamDestination() : null;
  const source = audioCtx.createBufferSource();
  source.buffer = soundtrack;
  source.connect(destination ?? audioCtx.destination);
  try {
    // the first seconds are loaded before it starts
    await assets.ready(plan, 0);
    assets.want(plan, 0, 8);
    await Promise.race([sleep(600), new Promise((r) => signal.addEventListener('abort', r, { once: true }))]);
    if (signal.aborted) return;
    await audioCtx.resume();
    const recorder = record && track ? record(track, destination!.stream.getAudioTracks()[0] ?? null) : null;
    const t0 = audioCtx.currentTime + 0.15;
    source.start(t0);
    // the recording starts with the music: an audio clock that takes a moment to get going (a device
    // waking up) would otherwise hold the first frame longer in the film than on the soundtrack
    let recording = !recorder;
    const frameMs = 1000 / FILM.fps;
    await new Promise<void>((resolve) => {
      let last = -1;
      const tick = () => {
        if (signal.aborted) return resolve();
        const now = audioCtx.currentTime;
        if (!recording) {
          if (now < t0) return void setTimeout(tick, frameMs / 2);
          recorder!.start();
          recording = true;
        }
        const t = Math.max(0, now - t0);
        if (t >= plan.duration) {
          paintFrame(ctx, plan.duration - 1e-3, plan, size.width, size.height, assets, card);
          track?.requestFrame?.();
          onTime?.(plan.duration);
          return resolve();
        }
        if (t !== last) {
          last = t;
          assets.want(plan, t);
          assets.sync(plan, t, true);
          paintFrame(ctx, t, plan, size.width, size.height, assets, card);
          track?.requestFrame?.();
          onTime?.(t);
        }
        setTimeout(tick, frameMs / 2);
      };
      tick();
    });
  } finally {
    assets.sync(plan, -1, false);
    try {
      source.stop();
    } catch {
      // never started
    }
    await audioCtx.close().catch(() => undefined);
    stream?.getTracks().forEach((t) => t.stop());
  }
}

async function renderWithRecorder(
  { plan, size, quality, assets, card, soundtrack }: RenderInput,
  engine: Extract<Engine, { kind: 'recorder' }>,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<FilmOutput> {
  const canvas = canvasOf(size);
  const chunks: Blob[] = [];
  let recorder: MediaRecorder | null = null;
  const stopped = new Promise<void>((resolve) => {
    void playFilm({
      plan,
      size,
      assets,
      card,
      soundtrack,
      canvas,
      signal,
      onTime: (t) => onProgress(Math.min(1, t / plan.duration)),
      record: (video, audio) => {
        recorder = new MediaRecorder(new MediaStream(audio ? [video, audio] : [video]), {
          mimeType: engine.mime,
          videoBitsPerSecond: FILM.encode.videoBitrate[quality],
          audioBitsPerSecond: FILM.encode.audioBitrate,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => resolve();
        return { start: () => recorder!.start(500) };
      },
    }).then(
      () => {
        const r = recorder as MediaRecorder | null;
        if (r && r.state !== 'inactive') r.stop();
        else resolve();
      },
      () => {
        const r = recorder as MediaRecorder | null;
        if (r && r.state !== 'inactive') r.stop();
        else resolve();
      },
    );
  });
  await stopped;
  if (signal.aborted) throw aborted();
  if (!chunks.length) throw new Error('nothing recorded');
  const type = engine.mime.split(';')[0]!;
  const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  let blob = new Blob(chunks, { type });
  if (ext === 'webm') {
    const fixed = withWebmDuration(
      new Uint8Array(await blob.arrayBuffer()),
      Math.round(plan.duration * 1000),
    );
    blob = new Blob([fixed], { type });
  }
  return { blob, type, ext, engine: 'recorder' };
}

/**
 * The film's still and thumbnail for the gallery (JPEG): a frame a moment into the first photo, at
 * the gallery's sizes.
 */
export async function filmStills(
  plan: FilmPlan,
  size: Size,
  assets: FilmAssets,
  card: CardStyle,
  sizes: { posterMaxEdge: number; posterQuality: number; thumbMaxEdge: number; thumbQuality: number },
): Promise<{ display: Blob; thumb: Blob }> {
  const first = plan.shots.find((s) => s.kind === 'item');
  const t = first ? first.start + (first.end - first.start) * 0.4 : 0;
  await assets.ready(plan, t);
  const canvas = canvasOf(size);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  paintFrame(ctx, t, plan, size.width, size.height, assets, card);
  const scaled = async (maxEdge: number, quality: number) => {
    const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
    const out = canvasOf({ width: Math.round(size.width * scale), height: Math.round(size.height * scale) });
    const octx = out.getContext('2d')!;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(canvas, 0, 0, out.width, out.height);
    return new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('still'))), 'image/jpeg', quality),
    );
  };
  return {
    display: await scaled(sizes.posterMaxEdge, sizes.posterQuality),
    thumb: await scaled(sizes.thumbMaxEdge, sizes.thumbQuality),
  };
}
