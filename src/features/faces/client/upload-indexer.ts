import { galleryApi } from '@/features/live-gallery/client/api';
import { deviceCanIndex, loadFaceEngine, pictureForFaces } from './engine';

/**
 * Face search on the phone that uploaded a photo (feature face_albums): once a photo is in the gallery,
 * this phone looks for faces in its own display version — still on the phone — and sends only what it
 * found (boxes and descriptors) for that photo. One photo at a time, after the uploads (they come
 * first), and never on a data saver, a slow connection or a device with little memory: the host's
 * browser then does it ("prepare face search"). The picture is dropped from the phone's queue as soon
 * as it was looked at (or can't be).
 */
export interface UploadIndexerOptions {
  token: string;
  uploader: string;
  code(): string | null;
  /** the display version the queue kept for this (null: gone) */
  preview(localId: string): Promise<Blob | null>;
  /** drops it from the queue's storage */
  drop(localId: string): Promise<void>;
}

/** Answers that won't change by trying again: the picture can go. */
const FINAL = new Set([200, 400, 403, 404, 410]);

export class UploadFaceIndexer {
  private queue: { localId: string; remoteId: string }[] = [];
  private seen = new Set<string>();
  private running = false;
  private stopped = false;

  constructor(private readonly o: UploadIndexerOptions) {}

  /** A photo of this phone reached the gallery. */
  add(localId: string, remoteId: string): void {
    if (this.stopped || this.seen.has(localId)) return;
    this.seen.add(localId);
    this.queue.push({ localId, remoteId });
    void this.run();
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
  }

  private async giveUp() {
    const left = this.queue.splice(0);
    for (const item of left) await this.o.drop(item.localId).catch(() => undefined);
  }

  private async run() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      if (!deviceCanIndex()) return void (await this.giveUp());
      let engine;
      try {
        engine = await loadFaceEngine();
      } catch {
        // this device can't run the model: the host's browser will
        return void (await this.giveUp());
      }
      while (this.queue.length && !this.stopped) {
        const item = this.queue[0]!;
        const blob = await this.o.preview(item.localId).catch(() => null);
        let faces;
        if (blob) {
          try {
            faces = await engine.detect(await pictureForFaces(blob));
          } catch {
            faces = null;
          }
        }
        if (!faces) {
          this.queue.shift();
          await this.o.drop(item.localId).catch(() => undefined);
          continue;
        }
        const code = this.o.code();
        const res = await galleryApi('/api/gallery/faces/index', {
          t: this.o.token,
          ...(code ? { code } : {}),
          uploader: this.o.uploader,
          id: item.remoteId,
          faces,
        });
        if (!FINAL.has(res.status)) {
          // offline or busy: the next photo (or the next visit) tries again
          this.seen.delete(item.localId);
          this.queue.shift();
          break;
        }
        this.queue.shift();
        await this.o.drop(item.localId).catch(() => undefined);
        // a breath between photos: the page stays responsive
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      this.running = false;
    }
  }
}
