import { mp4Tracks } from './mp4-tracks';

/**
 * A video the host uploads, made light for guests' phones in the browser before it is sent — what
 * `prepareImage` does for photos. Where the browser can encode H.264 (WebCodecs): at most 720p (the long
 * edge 1280, the short 720), at most 30 fps, at a bitrate that fits that size (~1.5 Mb/s at 720p) — a
 * 15 MB clip from a phone becomes 2–3 MB — with its sound kept (AAC, or Opus where AAC isn't offered),
 * put into an MP4 by mp4-muxer, faststart so it plays while it downloads. It is decoded by playing it
 * (muted, frame by frame through requestVideoFrameCallback), so it takes about as long as the video.
 *
 * Nothing here may make the upload worse: a video that is light already, one this browser can't decode
 * or encode, one with a layout we don't know (several audio tracks…), a result that isn't clearly smaller,
 * or one that doesn't play back as it should (checked here, in a video element, before it is sent) is
 * uploaded as it was. The size comes back with it either way, saved in the document (Media.width / height).
 */

export interface VideoInfo {
  width: number;
  height: number;
  seconds: number;
}

export interface PreparedVideo {
  file: Blob;
  width: number;
  height: number;
  seconds: number;
  /** false: the file as the host chose it (its size read) */
  transcoded: boolean;
}

export interface TranscodePlan {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

/** The long edge and the short edge a stored video keeps: 720p, either way up. */
export const LONG_EDGE = 1280;
export const SHORT_EDGE = 720;
const FPS = 30;
/** Clips longer than this are left alone: encoding takes as long as playing them. */
export const MAX_SECONDS = 180;
const AUDIO_BITRATE = 96_000;
const AUDIO_RATE = 48_000;
/** A result must be at least this much smaller than the original, or the original is sent. */
export const MIN_SAVING = 0.12;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** The size a video is stored at: inside 1280×720 (either way up), never enlarged, even (H.264 needs it). */
export function fitSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, LONG_EDGE / Math.max(width, height), SHORT_EDGE / Math.min(width, height));
  return { width: even(width * scale), height: even(height * scale) };
}

/** What a picture of this size at this frame rate may take: ~0.055 bits a pixel, between 0.6 and 2.5 Mb/s. */
export function bitrateFor(width: number, height: number, fps: number): number {
  return Math.min(2_500_000, Math.max(600_000, Math.round(width * height * fps * 0.055)));
}

/**
 * What to do with a video: null when there is nothing to gain (it is as light as the result would be, or
 * too long, or its size is unknown), else the size, frame rate and bitrate to encode it at.
 */
export function planTranscode(info: VideoInfo, bytes: number): TranscodePlan | null {
  if (!(info.width > 0) || !(info.height > 0) || !(info.seconds > 0) || info.seconds > MAX_SECONDS)
    return null;
  const size = fitSize(info.width, info.height);
  const bitrate = bitrateFor(size.width, size.height, FPS);
  const resized = size.width < info.width || size.height < info.height;
  // bits a second of the file, its sound included: already about what the result would take
  const rate = (bytes * 8) / info.seconds;
  if (!resized && rate <= (bitrate + AUDIO_BITRATE) * 1.25) return null;
  return { ...size, fps: FPS, bitrate };
}

const abortError = () => new DOMException('aborted', 'AbortError');

/** A video element's metadata (size, length), or null when this browser can't read the file. */
async function readInfo(url: string): Promise<VideoInfo | null> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'metadata';
  try {
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 10_000);
      video.addEventListener('loadedmetadata', () => (window.clearTimeout(timer), resolve()), { once: true });
      video.addEventListener('error', () => (window.clearTimeout(timer), reject(new Error('decode'))), {
        once: true,
      });
    });
    const { videoWidth: width, videoHeight: height, duration: seconds } = video;
    return width && height && Number.isFinite(seconds) ? { width, height, seconds } : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

/** H.264 profiles to try, by level (720p: 3.1; up to 1280×720 at 30 fps). */
const avcCodecs = ['avc1.640028', 'avc1.64001f', 'avc1.4d001f', 'avc1.42e01f'];

interface Engine {
  video: string;
  audio: { codec: 'aac' | 'opus'; config: string } | null;
}

/** The codecs this browser can encode with (null: it can't make the video at all). */
async function pickEngine(plan: TranscodePlan, withSound: boolean): Promise<Engine | null> {
  if (
    typeof VideoEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined' ||
    typeof HTMLVideoElement === 'undefined' ||
    !('requestVideoFrameCallback' in HTMLVideoElement.prototype)
  )
    return null;
  let video: string | null = null;
  for (const codec of avcCodecs) {
    try {
      const s = await VideoEncoder.isConfigSupported({
        codec,
        width: plan.width,
        height: plan.height,
        bitrate: plan.bitrate,
        framerate: plan.fps,
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
  if (!video) return null;
  if (!withSound) return { video, audio: null };
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  for (const [codec, config] of [
    ['aac', 'mp4a.40.2'],
    ['opus', 'opus'],
  ] as const) {
    try {
      const s = await AudioEncoder.isConfigSupported({
        codec: config,
        sampleRate: AUDIO_RATE,
        numberOfChannels: 2,
        bitrate: AUDIO_BITRATE,
      });
      if (s.supported) return { video, audio: { codec, config } };
    } catch {
      // not this one
    }
  }
  // the video has sound this browser can't encode: the original keeps it
  return null;
}

/** The file's sound, decoded and resampled to 48 kHz (null: it can't be decoded). */
async function decodeSound(file: Blob): Promise<AudioBuffer | null> {
  try {
    const context = new OfflineAudioContext(2, 1, AUDIO_RATE);
    return await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function encode(
  url: string,
  file: Blob,
  info: VideoInfo,
  plan: TranscodePlan,
  engine: Engine,
  onProgress: ((fraction: number) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<Blob | null> {
  const sound = engine.audio ? await decodeSound(file) : null;
  if (engine.audio && !sound) return null; // it has sound we can't read: the original keeps it
  const channels = sound ? Math.min(2, sound.numberOfChannels) : 0;

  const { ArrayBufferTarget, Muxer } = await import('mp4-muxer');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: plan.width, height: plan.height, frameRate: plan.fps },
    ...(engine.audio && sound
      ? { audio: { codec: engine.audio.codec, numberOfChannels: channels, sampleRate: AUDIO_RATE } }
      : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failure: unknown = null;
  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  const audio =
    engine.audio && sound
      ? new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => (failure = e),
        })
      : null;
  const player = document.createElement('video');
  try {
    video.configure({
      codec: engine.video,
      width: plan.width,
      height: plan.height,
      bitrate: plan.bitrate,
      framerate: plan.fps,
      avc: { format: 'avc' },
    });

    // the sound first (quick), in tenths of a second
    if (audio && engine.audio && sound) {
      audio.configure({
        codec: engine.audio.config,
        sampleRate: AUDIO_RATE,
        numberOfChannels: channels,
        bitrate: AUDIO_BITRATE,
      });
      const step = AUDIO_RATE / 10;
      for (let i = 0; i < sound.length; i += step) {
        const n = Math.min(step, sound.length - i);
        const data = new Float32Array(n * channels);
        for (let c = 0; c < channels; c++) data.set(sound.getChannelData(c).subarray(i, i + n), c * n);
        const chunk = new AudioData({
          format: 'f32-planar',
          sampleRate: AUDIO_RATE,
          numberOfFrames: n,
          numberOfChannels: channels,
          timestamp: Math.round((i * 1e6) / AUDIO_RATE),
          data,
        });
        audio.encode(chunk);
        chunk.close();
      }
      await audio.flush();
    }

    // then the picture: the video plays, muted, and each frame it shows is drawn at the new size
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    context.imageSmoothingQuality = 'high';
    player.muted = true;
    player.playsInline = true;
    player.preload = 'auto';
    player.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 15_000);
      player.addEventListener('loadeddata', () => (window.clearTimeout(timer), resolve()), { once: true });
      player.addEventListener('error', () => (window.clearTimeout(timer), reject(new Error('decode'))), {
        once: true,
      });
    });

    await new Promise<void>((resolve, reject) => {
      let last = -1;
      let count = 0;
      let watchdog = 0;
      // frames the screen has shown, as the last callback counted them
      let shown = -1;
      // far slower than the clip itself (a weak phone): not worth waiting for
      const deadline = Date.now() + info.seconds * 6000 + 20_000;
      const feed = () => {
        window.clearTimeout(watchdog);
        // frames stop coming (a hidden tab, a decoder that gave up): not worth waiting for
        watchdog = window.setTimeout(() => reject(new Error('stalled')), 12_000);
      };
      const tick: VideoFrameRequestCallback = (_now, metadata) => {
        if (signal?.aborted) return reject(abortError());
        if (failure) return reject(failure);
        if (Date.now() > deadline) return reject(new Error('too slow'));
        feed();
        // frames shown that this loop never saw: the picture runs faster than it can be copied — play it
        // slower (down to a quarter) so that every frame gets drawn; the timestamps are the clip's own
        if (shown >= 0 && metadata.presentedFrames - shown > 1 && player.playbackRate > 0.25)
          player.playbackRate /= 2;
        shown = metadata.presentedFrames;
        const t = metadata.mediaTime;
        // at most `fps` frames a second (a 60 fps clip gives every other one)
        if (last < 0 || t - last >= 0.9 / plan.fps) {
          context.drawImage(player, 0, 0, plan.width, plan.height);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(t * 1e6),
            duration: Math.round(1e6 / plan.fps),
          });
          video.encode(frame, { keyFrame: count++ % (plan.fps * 2) === 0 });
          frame.close();
          last = t;
          onProgress?.(Math.min(1, t / info.seconds));
        }
        // the encoder is behind: hold the video until it has caught up
        if (video.encodeQueueSize > 6) {
          player.pause();
          video.addEventListener('dequeue', () => void player.play().catch(reject), { once: true });
        }
        player.requestVideoFrameCallback(tick);
      };
      player.addEventListener(
        'ended',
        () => {
          window.clearTimeout(watchdog);
          resolve();
        },
        { once: true },
      );
      player.addEventListener('error', () => reject(new Error('decode')), { once: true });
      signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      feed();
      player.requestVideoFrameCallback(tick);
      void player.play().catch(reject);
    });
    await video.flush();
    if (failure) throw failure;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    player.pause();
    player.removeAttribute('src');
    player.load();
    if (video.state !== 'closed') video.close();
    if (audio && audio.state !== 'closed') audio.close();
  }
}

/** The result plays back as it should: its size, its length, a frame that seeks and decodes, its sound. */
async function playsBack(
  blob: Blob,
  plan: TranscodePlan,
  info: VideoInfo,
  withSound: boolean,
): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const once = (event: string, ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
      video.addEventListener(event, () => (window.clearTimeout(timer), resolve()), { once: true });
      video.addEventListener('error', () => (window.clearTimeout(timer), reject(new Error('decode'))), {
        once: true,
      });
    });
  try {
    video.src = url;
    await once('loadedmetadata', 10_000);
    if (video.videoWidth !== plan.width || video.videoHeight !== plan.height) return false;
    if (Math.abs(video.duration - info.seconds) > Math.max(1, info.seconds * 0.05)) return false;
    await once('loadeddata', 10_000);
    const seeked = once('seeked', 8000);
    video.currentTime = Math.min(0.5, video.duration / 2);
    await seeked;
    if (video.readyState < 2) return false;
    if (withSound) {
      const tracks = await mp4Tracks(
        (a, b) =>
          blob
            .slice(a, b)
            .arrayBuffer()
            .then((buf) => new Uint8Array(buf)),
        blob.size,
      );
      if (!tracks || tracks.audio !== 1) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * The video, made ready: lighter where this browser can (see the top of this file), else as it is — with
 * its size either way. null when the browser can't read the file at all (it is sent as it is, no size).
 * `onProgress` (0..1) is called as the video is re-encoded; an aborted `signal` rejects with an AbortError.
 */
export async function prepareVideo(
  file: Blob,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<PreparedVideo | null> {
  if (!file.type.startsWith('video/') || typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const info = await readInfo(url);
    if (!info) return null;
    const original: PreparedVideo = { file, ...info, transcoded: false };
    const plan = planTranscode(info, file.size);
    if (!plan) return original;
    // what the file holds: one picture track, and sound or none — anything else is left alone
    const tracks = await mp4Tracks(
      (a, b) =>
        file
          .slice(a, b)
          .arrayBuffer()
          .then((buf) => new Uint8Array(buf)),
      file.size,
    ).catch(() => null);
    if (!tracks || tracks.video !== 1 || tracks.audio > 1) return original;
    const engine = await pickEngine(plan, tracks.audio === 1);
    if (!engine) return original;
    try {
      const blob = await encode(url, file, info, plan, engine, onProgress, signal);
      if (!blob || blob.size > file.size * (1 - MIN_SAVING)) return original;
      if (!(await playsBack(blob, plan, info, tracks.audio === 1))) return original;
      const name = (file instanceof File ? file.name : '').replace(/\.[^.]+$/, '') || 'video';
      return {
        file: new File([blob], `${name}.mp4`, { type: 'video/mp4' }),
        width: plan.width,
        height: plan.height,
        seconds: info.seconds,
        transcoded: true,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return original;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
