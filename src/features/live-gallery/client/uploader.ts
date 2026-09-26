import { GALLERY } from '../config';
import { hamming } from '../image-metrics';
import type { Reason } from '../moderation';
import {
  failed,
  nextAction,
  retryNow,
  settled,
  succeeded,
  type Action,
  type PartName,
  type PartState,
  type QueueItem,
} from '../queue';
import type { PartTicket, ReservedItem } from '../types';
import { galleryApi } from './api';
import type { QueueStore, StoredItem } from './idb';
import { prepare, type PrepareError } from './process';
import { putFile, tusUpload, UploadFailure, type ResumableState } from './transport';

/**
 * The guest's uploader: files are prepared (process.ts) and saved in the queue (IndexedDB), then sent
 * one step at a time as queue.ts decides — reserve, previews, complete, original — straight to
 * storage. It waits out a lost network (and starts again on the browser's `online`, or when the page
 * comes back to the front), retries each failed step with growing pauses, signs again what expired,
 * and keeps the screen awake while it works. Only one tab of the device sends (Web Locks); another
 * tab of the same gallery shows the progress.
 */

export type Blocked = 'code' | 'paused' | 'scheduled' | 'ended' | 'off' | 'full';

export interface Snapshot {
  items: QueueItem[];
  /** files still being prepared */
  preparing: number;
  blocked: Blocked | null;
  online: boolean;
  /** another tab of this device is sending */
  passive: boolean;
  /** the queue survives closing the page */
  persistent: boolean;
}

export interface AddResult {
  added: number;
  errors: { name: string; code: PrepareError | 'duplicate' | 'storage' }[];
}

export interface UploaderOptions {
  /** the gallery link's token */
  token: string;
  store: QueueStore;
  /** this device's random uploader id */
  uploader: string;
  code(): string | null;
  name(): string | null;
  /** the guest's personal invitation token, when they came through it */
  guest: string | null;
  onChange(snapshot: Snapshot): void;
  /** an item reached the gallery (its outcome is known) */
  onResult?(item: QueueItem): void;
}

export function randomToken(bytes = 16): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const PERMANENT = new Set([
  'too_large',
  'unsupported',
  'unsupported_type',
  'too_long',
  'invalid',
  'full',
  'gone',
  'lost',
]);
const DAY = 86_400_000;

export class Uploader {
  private items = new Map<string, StoredItem>();
  private preparing = 0;
  private blocked: Blocked | null = null;
  private running = false;
  private stopped = false;
  private passive = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unblockTimer: ReturnType<typeof setTimeout> | null = null;
  private abort = new AbortController();
  private releaseLock: (() => void) | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  private emitQueued = false;
  private passivePoll: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly o: UploaderOptions) {}

  // ── lifecycle ──

  async start(): Promise<void> {
    await this.reload();
    // what finished a day ago is only history
    for (const item of [...this.items.values()])
      if ((item.stage === 'done' || item.stage === 'skipped') && Date.now() - item.createdAt > DAY) {
        this.items.delete(item.localId);
        await this.o.store.remove(item.localId).catch(() => undefined);
      }
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('storage', this.onPing);
    document.addEventListener('visibilitychange', this.onVisible);
    await this.takeLock();
    this.emit();
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    this.abort.abort();
    if (this.timer) clearTimeout(this.timer);
    if (this.unblockTimer) clearTimeout(this.unblockTimer);
    if (this.passivePoll) clearInterval(this.passivePoll);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('storage', this.onPing);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.releaseLock?.();
    void this.wakeLock?.release().catch(() => undefined);
  }

  private async reload() {
    const stored = await this.o.store.load(this.o.token).catch(() => [] as StoredItem[]);
    this.items = new Map(stored.map((i) => [i.localId, i]));
  }

  /** One tab sends; the others watch the shared queue until it is theirs. */
  private async takeLock() {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.request) return;
    const name = `badook-gallery:${this.o.token}`;
    const hold = () =>
      new Promise<void>((resolve) => {
        this.releaseLock = resolve;
      });
    const granted = await new Promise<boolean>((resolve) => {
      void locks
        .request(name, { ifAvailable: true }, async (lock) => {
          resolve(!!lock);
          if (lock) await hold();
        })
        .catch(() => resolve(true));
    });
    if (granted) return;
    this.passive = true;
    this.passivePoll = setInterval(() => {
      void this.reload().then(() => this.emit());
    }, 2_000);
    void locks
      .request(name, async () => {
        if (this.stopped) return;
        if (this.passivePoll) clearInterval(this.passivePoll);
        this.passive = false;
        await this.reload();
        this.emit();
        this.kick();
        await hold();
      })
      .catch(() => undefined);
  }

  private onOnline = () => {
    this.retryAll();
  };
  /** Another tab of this device added files: take them into the queue. */
  private onPing = (e: StorageEvent) => {
    if (e.key !== this.pingKey || this.passive) return;
    void this.o.store.load(this.o.token).then((stored) => {
      for (const item of stored) if (!this.items.has(item.localId)) this.items.set(item.localId, item);
      this.emit();
      this.kick();
    });
  };
  private get pingKey() {
    return `badook-gallery:${this.o.token}:added`;
  }
  private onOffline = () => this.emit();
  private onVisible = () => {
    if (document.visibilityState === 'visible') {
      void this.holdWakeLock();
      this.retryAll();
    }
  };

  /** The network is back, or the page is in front again: everything waiting may go now. */
  retryAll(): void {
    for (const item of retryNow([...this.items.values()]) as StoredItem[]) this.items.set(item.localId, item);
    this.kick();
  }

  /** The gallery opened again, or a code was entered. */
  unblock(): void {
    this.blocked = null;
    this.emit();
    this.kick();
  }

  // ── adding and removing ──

  async add(files: File[]): Promise<AddResult> {
    const result: AddResult = { added: 0, errors: [] };
    this.preparing += files.length;
    this.emit();
    for (const file of files) {
      let prepared: Awaited<ReturnType<typeof prepare>>;
      try {
        prepared = await prepare(file);
      } catch {
        prepared = 'unsupported';
      }
      this.preparing--;
      if (typeof prepared === 'string') {
        result.errors.push({ name: file.name, code: prepared });
        this.emit();
        continue;
      }
      // the same photo picked twice (here, or earlier from this phone): once is enough
      const hash = prepared.metrics?.phash;
      if (
        hash &&
        [...this.items.values()].some(
          (i) => i.metrics && i.stage !== 'failed' && hamming(i.metrics.phash, hash) <= 2,
        )
      ) {
        result.errors.push({ name: file.name, code: 'duplicate' });
        this.emit();
        continue;
      }
      const localId = randomToken();
      const parts: StoredItem['parts'] = {
        original: { type: prepared.originalType, size: prepared.original.size, done: false },
      };
      if (prepared.display && prepared.thumb) {
        parts.display = { type: prepared.display.type, size: prepared.display.size, done: false };
        parts.thumb = { type: prepared.thumb.type, size: prepared.thumb.size, done: false };
      }
      const item: StoredItem = {
        gallery: this.o.token,
        localId,
        kind: prepared.kind,
        createdAt: Date.now(),
        remoteId: null,
        stage: 'queued',
        parts,
        meta: {
          width: prepared.width,
          height: prepared.height,
          durationMs: prepared.durationMs,
          takenAt: prepared.takenAt,
        },
        metrics: prepared.metrics,
        result: null,
        attempts: 0,
        nextAt: 0,
        error: null,
        sent: 0,
      };
      try {
        await this.o.store.putBlob(localId, 'original', prepared.original);
        if (prepared.display) await this.o.store.putBlob(localId, 'display', prepared.display);
        if (prepared.thumb) await this.o.store.putBlob(localId, 'thumb', prepared.thumb);
        await this.o.store.put(item);
      } catch {
        await this.o.store.remove(localId).catch(() => undefined);
        result.errors.push({ name: file.name, code: 'storage' });
        this.emit();
        continue;
      }
      this.items.set(localId, item);
      result.added++;
      if (this.passive) {
        try {
          localStorage.setItem(this.pingKey, String(Date.now()));
        } catch {
          // storage blocked: the other tab finds it when it reloads
        }
      }
      this.emit();
      this.kick();
    }
    return result;
  }

  /** Takes an item out of the queue (a failed one, or one the guest changed their mind about). */
  async remove(localId: string): Promise<void> {
    this.items.delete(localId);
    await this.o.store.remove(localId).catch(() => undefined);
    this.emit();
  }

  /** The thumbnail kept for an item still in the queue (for the progress list). */
  thumbnail(localId: string): Promise<Blob | null> {
    return this.o.store.getBlob(localId, 'thumb').catch(() => null);
  }

  // ── the loop ──

  private kick() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.loop();
  }

  private async loop() {
    if (this.running || this.passive || this.stopped) return;
    this.running = true;
    void this.holdWakeLock();
    try {
      for (;;) {
        if (this.stopped || this.passive) break;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        const action = nextAction([...this.items.values()], Date.now(), { blocked: !!this.blocked });
        if (action.type === 'idle') break;
        if (action.type === 'wait') {
          this.timer = setTimeout(() => this.kick(), Math.max(50, action.until - Date.now()));
          break;
        }
        await this.perform(action);
        this.emit();
      }
    } finally {
      this.running = false;
      this.emit();
      void this.holdWakeLock();
    }
  }

  private async perform(action: Exclude<Action, { type: 'wait' } | { type: 'idle' }>) {
    try {
      if (action.type === 'reserve') await this.reserve(action.ids);
      else if (action.type === 'upload') await this.upload(action.id, action.part);
      else await this.complete(action.id, action.originalDone);
    } catch {
      // anything unexpected: that item waits and tries again
      const id = action.type === 'reserve' ? action.ids[0]! : action.id;
      const item = this.items.get(id);
      if (item) await this.save(failed(item, 'network', Date.now()) as StoredItem);
    }
  }

  private async save(item: StoredItem) {
    this.items.set(item.localId, item);
    await this.o.store.put(item).catch(() => undefined);
  }

  private block(state: Blocked) {
    this.blocked = state;
    if (this.unblockTimer) clearTimeout(this.unblockTimer);
    // a paused or closed gallery may open again: ask again in a while (a code needs the guest)
    if (state !== 'code' && state !== 'full')
      this.unblockTimer = setTimeout(() => this.unblock(), GALLERY.queue.blockedRetryMs);
    this.emit();
  }

  private common() {
    return { t: this.o.token, uploader: this.o.uploader, ...(this.o.code() ? { code: this.o.code()! } : {}) };
  }

  /** A refused request: the reason, for every item it concerned. */
  private async refused(items: StoredItem[], status: number, body: Record<string, unknown> | null) {
    const code = typeof body?.code === 'string' ? body.code : '';
    const now = Date.now();
    if (status === 401 && code === 'access_code') return this.block('code');
    if (status === 403) return this.block(((body?.state as Blocked) ?? code ?? 'off') || 'off');
    for (const item of items) {
      if (status === 409 && code === 'full') await this.save({ ...item, stage: 'failed', error: 'full' });
      else if (status === 404) await this.save({ ...item, stage: 'failed', error: 'gone' });
      else if (status === 400) await this.save({ ...item, stage: 'failed', error: 'invalid' });
      else await this.save(failed(item, status === 0 ? 'network' : 'busy', now) as StoredItem);
    }
  }

  private tickets(item: StoredItem, parts: ReservedItem['parts']): StoredItem['parts'] {
    const out = { ...item.parts };
    const now = Date.now();
    for (const [name, t] of Object.entries(parts) as [PartName, PartTicket][]) {
      const current = out[name];
      if (!current) continue;
      out[name] = {
        ...current,
        bucket: t.bucket,
        path: t.path,
        token: t.token,
        url: t.url,
        issuedAt: now,
        apiKey: t.resumable?.apiKey,
        // a resumable upload under way keeps its address and offset with the new token
        resumable: t.resumable
          ? {
              endpoint: t.resumable.endpoint,
              location: current.resumable?.location ?? null,
              offset: current.resumable?.offset ?? 0,
            }
          : null,
      };
    }
    return out;
  }

  private async reserve(ids: string[]) {
    const items = ids.map((id) => this.items.get(id)).filter((i): i is StoredItem => !!i);
    const res = await galleryApi<{ items: ReservedItem[]; rejected: { key: string; code: string }[] }>(
      '/api/gallery/reserve',
      {
        ...this.common(),
        ...(this.o.name() ? { name: this.o.name()! } : {}),
        ...(this.o.guest ? { g: this.o.guest } : {}),
        items: items.map((i) => ({
          key: i.localId,
          kind: i.kind,
          original: { type: i.parts.original!.type, size: i.parts.original!.size },
          ...(i.parts.display ? { display: { type: i.parts.display.type, size: i.parts.display.size } } : {}),
          ...(i.parts.thumb ? { thumb: { type: i.parts.thumb.type, size: i.parts.thumb.size } } : {}),
          width: i.meta.width,
          height: i.meta.height,
          durationMs: i.meta.durationMs,
          takenAt: i.meta.takenAt,
        })),
      },
    );
    if (!res.ok || !res.body)
      return this.refused(items, res.status, res.body as Record<string, unknown> | null);
    for (const r of res.body.items) {
      const item = this.items.get(r.key);
      if (item)
        await this.save({
          ...succeeded(item),
          remoteId: r.id,
          stage: 'reserved',
          parts: this.tickets(item, r.parts),
        } as StoredItem);
    }
    for (const r of res.body.rejected) {
      const item = this.items.get(r.key);
      if (item) {
        await this.save({ ...item, stage: 'failed', error: r.code });
        await this.dropBlobs(item, ['thumb', 'display', 'original']);
      }
    }
  }

  /** Fresh tokens for parts (their two hours ran out, or storage refused them); parts already stored are done. */
  private async resign(item: StoredItem, parts: PartName[]): Promise<boolean> {
    const res = await galleryApi<{ parts: Record<string, PartTicket | { done: true }> }>(
      '/api/gallery/resign',
      {
        ...this.common(),
        id: item.remoteId,
        parts,
      },
    );
    if (!res.ok || !res.body) {
      await this.refused([item], res.status, res.body as Record<string, unknown> | null);
      return false;
    }
    let next = { ...item, parts: { ...item.parts } };
    const fresh: ReservedItem['parts'] = {};
    for (const [name, value] of Object.entries(res.body.parts) as [PartName, PartTicket | { done: true }][]) {
      if ('done' in value) next.parts[name] = { ...next.parts[name]!, done: true };
      else fresh[name] = value;
    }
    next = { ...next, parts: this.tickets(next, fresh) };
    await this.save(next);
    return true;
  }

  private sentOf(item: QueueItem, except?: PartName) {
    return (Object.entries(item.parts) as [PartName, PartState][])
      .filter(([name, p]) => p.done && name !== except)
      .reduce((sum, [, p]) => sum + p.size, 0);
  }

  private async upload(localId: string, part: PartName) {
    let item = this.items.get(localId);
    if (!item) return;
    const p = item.parts[part]!;
    const stale = !p.issuedAt || Date.now() - p.issuedAt > GALLERY.urls.uploadTokenMaxAgeMs;
    if (!p.token || !p.url || stale) {
      if (!(await this.resign(item, [part]))) return;
      item = this.items.get(localId)!;
      if (item.parts[part]!.done) return;
    }
    const current = item.parts[part]!;
    const blob = await this.o.store.getBlob(localId, part);
    if (!blob) {
      await this.save({ ...item, stage: 'failed', error: 'lost' });
      return;
    }
    const before = this.sentOf(item, part);
    let lastEmit = 0;
    const onProgress = (sent: number) => {
      const it = this.items.get(localId);
      if (!it) return;
      this.items.set(localId, { ...it, sent: before + Math.min(sent, current.size) });
      const now = Date.now();
      if (now - lastEmit > 200) {
        lastEmit = now;
        this.emit();
      }
    };
    const target = {
      url: current.url!,
      token: current.token!,
      bucket: current.bucket!,
      path: current.path!,
      type: current.type,
      apiKey: current.apiKey,
    };
    try {
      if (current.resumable && blob.size >= GALLERY.limits.resumableFrom) {
        await tusUpload(
          target,
          blob,
          current.resumable,
          async (state: ResumableState) => {
            const it = this.items.get(localId);
            if (it)
              await this.save({
                ...it,
                parts: { ...it.parts, [part]: { ...it.parts[part]!, resumable: state } },
              });
          },
          onProgress,
          this.abort.signal,
        );
      } else {
        await putFile(target, blob, onProgress, this.abort.signal);
      }
      const it = this.items.get(localId)!;
      const parts = { ...it.parts, [part]: { ...it.parts[part]!, done: true } };
      await this.save({ ...succeeded(it), parts, sent: this.sentOf({ ...it, parts }) } as StoredItem);
    } catch (err) {
      const code = err instanceof UploadFailure ? err.code : 'network';
      if (code === 'aborted') return;
      const it = this.items.get(localId)!;
      if (code === 'too_large' || code === 'unsupported') {
        await this.save({ ...it, stage: 'failed', error: code });
        await this.dropBlobs(it, ['thumb', 'display', 'original']);
        return;
      }
      const retry =
        code === 'expired'
          ? { ...it, parts: { ...it.parts, [part]: { ...it.parts[part]!, token: undefined } } }
          : it;
      await this.save(failed(retry, code, Date.now()) as StoredItem);
    }
  }

  private async complete(localId: string, originalDone: boolean) {
    const item = this.items.get(localId);
    if (!item) return;
    const res = await galleryApi<{
      status: 'published' | 'pending' | 'rejected';
      reason: Reason;
      originalDone: boolean;
      parts?: PartName[];
    }>(
      '/api/gallery/complete',
      { ...this.common(), id: item.remoteId, originalDone, metrics: item.metrics ?? null },
      { timeoutMs: 45_000 },
    );
    if (res.status === 409 && res.body && Array.isArray((res.body as { parts?: unknown }).parts)) {
      // storage doesn't have some of the files after all: send them again
      const missing = (res.body as { parts: PartName[] }).parts;
      const parts = { ...item.parts };
      for (const name of missing) if (parts[name]) parts[name] = { ...parts[name]!, done: false };
      await this.save({ ...succeeded(item), parts } as StoredItem);
      return;
    }
    if (!res.ok || !res.body)
      return this.refused([item], res.status, res.body as Record<string, unknown> | null);
    const body = res.body;
    const result = { status: body.status, reason: body.reason };
    let parts = item.parts;
    // the original was reported sent but the server doesn't see it yet: send it again
    if (originalDone && item.parts.original && !body.originalDone)
      parts = { ...parts, original: { ...parts.original!, done: false } };
    const finished = !parts.original || parts.original.done;
    const next: StoredItem = {
      ...(succeeded(item) as StoredItem),
      parts,
      stage: finished ? 'done' : 'visible',
      result: item.result ?? result,
    };
    await this.save(next);
    await this.dropBlobs(next, finished ? ['thumb', 'display', 'original'] : ['thumb', 'display']);
    if (!item.result) this.o.onResult?.(next);
  }

  private async dropBlobs(item: QueueItem, parts: PartName[]) {
    for (const p of parts) await this.o.store.dropBlob(item.localId, p).catch(() => undefined);
  }

  // ── the screen ──

  /** Keeps the phone's screen on while there is something to send (a locked phone stops the page). */
  private async holdWakeLock() {
    const busy = !this.passive && !settled([...this.items.values()]) && !this.blocked;
    const wl = (
      navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    ).wakeLock;
    if (busy && !this.wakeLock && wl && document.visibilityState === 'visible') {
      try {
        const lock = await wl.request('screen');
        this.wakeLock = lock;
        (lock as unknown as EventTarget).addEventListener?.('release', () => {
          if (this.wakeLock === lock) this.wakeLock = null;
        });
      } catch {
        // refused (battery saver, an old browser): uploads go on while the screen is on
      }
    } else if (!busy && this.wakeLock) {
      const lock = this.wakeLock;
      this.wakeLock = null;
      await lock.release().catch(() => undefined);
    }
  }

  snapshot(): Snapshot {
    return {
      items: [...this.items.values()].sort((a, b) => a.createdAt - b.createdAt),
      preparing: this.preparing,
      blocked: this.blocked,
      online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
      passive: this.passive,
      persistent: this.o.store.persistent,
    };
  }

  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    queueMicrotask(() => {
      this.emitQueued = false;
      if (!this.stopped) this.o.onChange(this.snapshot());
    });
  }
}

export const isPermanent = (error: string | null): boolean => !!error && PERMANENT.has(error);
