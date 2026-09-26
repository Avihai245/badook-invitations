'use client';

import { zipStream, type ZipSource } from '../zip';

/**
 * "Download everything" in the host's browser: the list of files comes from the API page by page
 * (each with a signed URL), every file is fetched in turn and written into a ZIP as it arrives. Where
 * the browser can write to a file the host picks (Chrome, Edge), one archive streams to disk however
 * big the gallery is; elsewhere the archive is built in parts of about 500 MB, each saved as it is
 * done. A file that can't be fetched (three tries) is left out and listed in the archive.
 */

export interface DownloadFile {
  id: string;
  name: string;
  url: string;
  size: number;
  date: string;
  partial: boolean;
}

export interface DownloadPage {
  files: DownloadFile[];
  next: { at: string; id: string } | null;
  total: number;
  bytes: number;
}

export interface DownloadProgress {
  files: number;
  total: number;
  bytes: number;
  totalBytes: number;
  /** the archive part being written (1-based) */
  part: number;
  current: string | null;
}

export interface DownloadOptions {
  /** the next page after `after` (null: the first) */
  page(after: DownloadPage['next']): Promise<DownloadPage>;
  /** the archive's name without ".zip" */
  filename: string;
  onProgress(p: DownloadProgress): void;
  signal: AbortSignal;
  /** the name of the list of files that couldn't be fetched, inside the archive */
  missingListName: string;
  /** the text above that list */
  missingIntro: string;
  /** use the browser's "save as" and stream to disk when it has one (default: yes) */
  streamToDisk?: boolean;
}

/** Parts at most this big when the browser can't stream to disk. */
export const PART_BYTES = 500 * 1024 * 1024;

type SaveFilePicker = (options: {
  suggestedName: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;

async function fetchFile(url: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal, cache: 'no-store' });
      if (res.ok && res.body) return res.body;
      last = new Error(`status ${res.status}`);
    } catch (err) {
      if (signal.aborted) throw err;
      last = err;
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw last instanceof Error ? last : new Error('fetch failed');
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const encoder = new TextEncoder();
const empty = () => new ReadableStream<Uint8Array>({ start: (c) => c.close() });

export async function downloadAll(
  o: DownloadOptions,
): Promise<{ files: number; missing: number; parts: number }> {
  const first = await o.page(null);
  const progress: DownloadProgress = {
    files: 0,
    total: first.total,
    bytes: 0,
    totalBytes: first.bytes,
    part: 1,
    current: null,
  };
  const missing: string[] = [];
  const report = () => o.onProgress({ ...progress });

  // every file, page after page
  async function* pages(): AsyncGenerator<DownloadFile> {
    let page: DownloadPage | null = first;
    while (page) {
      for (const f of page.files) yield f;
      page = page.next ? await o.page(page.next) : null;
    }
  }
  const files = pages();
  let held: DownloadFile | null = null;
  let exhausted = false;

  /** Files for one archive, up to `limit` bytes (a single bigger file still goes, alone). */
  async function* part(limit: number): AsyncGenerator<ZipSource> {
    let size = 0;
    for (;;) {
      let f = held;
      held = null;
      if (!f) {
        const r = await files.next();
        if (r.done) {
          exhausted = true;
          break;
        }
        f = r.value;
      }
      if (size > 0 && size + f.size > limit) {
        held = f;
        break;
      }
      size += f.size;
      const file = f;
      const before = progress.bytes;
      yield {
        name: file.name,
        date: new Date(file.date),
        open: async () => {
          progress.current = file.name;
          report();
          try {
            return await fetchFile(file.url, o.signal);
          } catch (err) {
            if (o.signal.aborted) throw err;
            missing.push(file.name);
            return empty();
          }
        },
      };
      // this file is in: count it (a file that failed still moves the bar)
      progress.files++;
      progress.bytes = Math.max(progress.bytes, before + file.size);
      report();
    }
    // the last part lists what couldn't be fetched
    if (exhausted && missing.length)
      yield {
        name: o.missingListName,
        date: new Date(),
        open: async () =>
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(encoder.encode(`${o.missingIntro}\n\n${missing.join('\n')}\n`));
              c.close();
            },
          }),
      };
  }
  const counting = (start: number) => (copied: number) => {
    progress.bytes = start + copied;
    report();
  };

  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker && o.streamToDisk !== false) {
    let handle: Awaited<ReturnType<SaveFilePicker>> | null = null;
    try {
      handle = await picker({
        suggestedName: `${o.filename}.zip`,
        types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
      });
    } catch (err) {
      // the host closed the dialog: stop; any other refusal: build the archive in memory instead
      if ((err as { name?: string })?.name === 'AbortError') throw err;
    }
    if (handle) {
      const writable = await handle.createWritable();
      await zipStream(part(Number.POSITIVE_INFINITY), { onBytes: counting(0) }).pipeTo(writable, {
        signal: o.signal,
      });
      report();
      return { files: progress.files, missing: missing.length, parts: 1 };
    }
  }

  // no streaming to disk: parts of about 500 MB, each saved when done
  let parts = 0;
  while (!exhausted) {
    parts++;
    progress.part = parts;
    const chunks: Uint8Array[] = [];
    const reader = zipStream(part(PART_BYTES), { onBytes: counting(progress.bytes) }).getReader();
    for (;;) {
      if (o.signal.aborted) {
        await reader.cancel();
        throw new DOMException('Aborted', 'AbortError');
      }
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const name = parts === 1 && exhausted ? `${o.filename}.zip` : `${o.filename}-${parts}.zip`;
    saveBlob(new Blob(chunks as BlobPart[], { type: 'application/zip' }), name);
  }
  report();
  return { files: progress.files, missing: missing.length, parts };
}
