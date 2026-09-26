import type { PartName, QueueItem } from '../queue';

/**
 * Where the guest's upload queue lives between visits: IndexedDB (the prepared files included), so
 * closing the page, losing the network or the phone locking loses nothing — the queue carries on
 * when the page opens again. Private windows and old browsers that refuse IndexedDB get the same
 * store in memory (it lasts while the page is open).
 */

export interface StoredItem extends QueueItem {
  /** the gallery link's token: one phone can hold queues of two galleries */
  gallery: string;
}

export interface QueueStore {
  readonly persistent: boolean;
  load(gallery: string): Promise<StoredItem[]>;
  put(item: StoredItem): Promise<void>;
  putBlob(localId: string, part: PartName, blob: Blob): Promise<void>;
  getBlob(localId: string, part: PartName): Promise<Blob | null>;
  dropBlob(localId: string, part: PartName): Promise<void>;
  /** the item and its files */
  remove(localId: string): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string | null): Promise<void>;
}

const DB_NAME = 'badook-gallery';
const VERSION = 1;
const blobKey = (localId: string, part: PartName) => `${localId}:${part}`;

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'localId' });
        items.createIndex('gallery', 'gallery');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('blocked'));
  });
}

class IdbStore implements QueueStore {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}

  async load(gallery: string) {
    const tx = this.db.transaction('items', 'readonly');
    return request(tx.objectStore('items').index('gallery').getAll(gallery)) as Promise<StoredItem[]>;
  }
  async put(item: StoredItem) {
    const tx = this.db.transaction('items', 'readwrite');
    tx.objectStore('items').put(item);
    await done(tx);
  }
  async putBlob(localId: string, part: PartName, blob: Blob) {
    const tx = this.db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put(blob, blobKey(localId, part));
    await done(tx);
  }
  async getBlob(localId: string, part: PartName) {
    const tx = this.db.transaction('blobs', 'readonly');
    const value = await request(tx.objectStore('blobs').get(blobKey(localId, part)));
    return value instanceof Blob ? value : null;
  }
  async dropBlob(localId: string, part: PartName) {
    const tx = this.db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').delete(blobKey(localId, part));
    await done(tx);
  }
  async remove(localId: string) {
    const tx = this.db.transaction(['items', 'blobs'], 'readwrite');
    tx.objectStore('items').delete(localId);
    for (const part of ['thumb', 'display', 'original'] as const)
      tx.objectStore('blobs').delete(blobKey(localId, part));
    await done(tx);
  }
  async getMeta(key: string) {
    const tx = this.db.transaction('meta', 'readonly');
    const value = await request(tx.objectStore('meta').get(key));
    return typeof value === 'string' ? value : null;
  }
  async setMeta(key: string, value: string | null) {
    const tx = this.db.transaction('meta', 'readwrite');
    if (value === null) tx.objectStore('meta').delete(key);
    else tx.objectStore('meta').put(value, key);
    await done(tx);
  }
}

/** The same store in memory (the page must stay open). */
export class MemoryStore implements QueueStore {
  readonly persistent = false;
  private items = new Map<string, StoredItem>();
  private blobs = new Map<string, Blob>();
  private meta = new Map<string, string>();

  async load(gallery: string) {
    return [...this.items.values()].filter((i) => i.gallery === gallery).map((i) => ({ ...i }));
  }
  async put(item: StoredItem) {
    this.items.set(item.localId, { ...item });
  }
  async putBlob(localId: string, part: PartName, blob: Blob) {
    this.blobs.set(blobKey(localId, part), blob);
  }
  async getBlob(localId: string, part: PartName) {
    return this.blobs.get(blobKey(localId, part)) ?? null;
  }
  async dropBlob(localId: string, part: PartName) {
    this.blobs.delete(blobKey(localId, part));
  }
  async remove(localId: string) {
    this.items.delete(localId);
    for (const part of ['thumb', 'display', 'original'] as const) this.blobs.delete(blobKey(localId, part));
  }
  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: string, value: string | null) {
    if (value === null) this.meta.delete(key);
    else this.meta.set(key, value);
  }
}

/**
 * IndexedDB when the browser allows it and can keep files in it (checked with a tiny one — some
 * old versions of Safari couldn't), else memory.
 */
export async function openStore(): Promise<QueueStore> {
  try {
    if (typeof indexedDB === 'undefined') return new MemoryStore();
    const db = await openDb();
    const store = new IdbStore(db);
    await store.putBlob('probe', 'thumb', new Blob(['ok'], { type: 'text/plain' }));
    const back = await store.getBlob('probe', 'thumb');
    await store.dropBlob('probe', 'thumb');
    if (!back || back.size !== 2) return new MemoryStore();
    return store;
  } catch {
    return new MemoryStore();
  }
}
