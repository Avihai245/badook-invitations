'use client';

/**
 * Reading QR codes with the phone's camera at the entrance: the browser's own BarcodeDetector where it
 * has one (Android, Chrome on Mac); elsewhere — iPhones, Windows — jsQR, a small well-known decoder
 * loaded only then. A frame is looked at every ~150 ms (a phone at the door all evening). Errors:
 * 'denied' (no permission), 'unavailable' (no camera), 'failed' (the decoder didn't load).
 */

export type ScanError = 'denied' | 'unavailable' | 'failed';

export interface Scanner {
  stop(): void;
}

type Detector = (source: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue?: string }[]>;
}
type BarcodeDetectorCtor = {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
    if (!formats.includes('qr_code')) return null;
    const detector = new Ctor({ formats: ['qr_code'] });
    return async (video) => {
      const found = await detector.detect(video);
      return found.find((c) => typeof c.rawValue === 'string' && c.rawValue)?.rawValue ?? null;
    };
  } catch {
    return null;
  }
}

async function fallbackDetector(): Promise<Detector> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // a smaller frame decodes faster and is plenty for a code held up to the camera
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export async function startScanner(
  video: HTMLVideoElement,
  onText: (text: string) => void,
  onError: (error: ScanError) => void,
): Promise<Scanner> {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stream: MediaStream | null = null;
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
  if (!navigator.mediaDevices?.getUserMedia) {
    onError('unavailable');
    return { stop };
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    onError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    return { stop };
  }
  if (stopped) {
    stop();
    return { stop };
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => undefined);
  let detect: Detector;
  try {
    detect = (await nativeDetector()) ?? (await fallbackDetector());
  } catch {
    onError('failed');
    stop();
    return { stop };
  }
  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const text = await detect(video);
        if (text && !stopped) onText(text);
      }
    } catch {
      // a frame the decoder couldn't read: the next one
    }
    if (!stopped) timer = setTimeout(() => void tick(), 150);
  };
  void tick();
  return { stop };
}
