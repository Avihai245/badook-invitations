import { GALLERY } from '../config';

/**
 * Sending one file straight to Supabase Storage with the server's signed token: a single PUT for
 * small files, a resumable (TUS) upload in 6 MB chunks for large ones — which picks up where the
 * server says it stopped after a dropped connection, a locked phone or a reopened page. Progress
 * comes from XMLHttpRequest (fetch has none for uploads).
 */

export type TransportError =
  /** no network, a dropped connection, a timeout: try again later */
  | 'network'
  /** the signed token expired or was refused: sign again */
  | 'expired'
  /** too big for the bucket */
  | 'too_large'
  /** a type the bucket refuses */
  | 'unsupported'
  /** the server failed or is busy: try again later */
  | 'server'
  | 'aborted';

export class UploadFailure extends Error {
  constructor(readonly code: TransportError) {
    super(code);
  }
}

interface XhrResult {
  status: number;
  text: string;
  header(name: string): string | null;
}

function xhr(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Blob | null,
  onProgress?: (loaded: number) => void,
  signal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(method, url);
    for (const [k, v] of Object.entries(headers)) req.setRequestHeader(k, v);
    req.timeout = timeoutMs;
    if (onProgress) req.upload.onprogress = (e) => onProgress(e.loaded);
    req.onload = () =>
      resolve({ status: req.status, text: req.responseText ?? '', header: (n) => req.getResponseHeader(n) });
    req.onerror = () => reject(new UploadFailure('network'));
    req.ontimeout = () => reject(new UploadFailure('network'));
    req.onabort = () => reject(new UploadFailure('aborted'));
    signal?.addEventListener('abort', () => req.abort(), { once: true });
    req.send(body);
  });
}

/** What a failed storage answer means for the queue. `done`: the file is already there. */
export function classify(status: number, text: string): TransportError | 'done' {
  if (/already exists|duplicate/i.test(text) || status === 409) return 'done';
  if (status === 413 || /payload too large|maximum allowed size|entity too large/i.test(text))
    return 'too_large';
  if (status === 415 || /mime type|invalid_mime/i.test(text)) return 'unsupported';
  if (status === 401 || status === 403 || /jwt|signature|unauthorized|expired/i.test(text)) return 'expired';
  if (status === 0 || status === 408 || status === 429 || status >= 500)
    return status === 0 ? 'network' : 'server';
  return status === 400 ? 'expired' : 'server';
}

export interface Target {
  /** the signed PUT URL */
  url: string;
  token: string;
  bucket: string;
  path: string;
  type: string;
  apiKey?: string;
}

/** One PUT of the whole file (`x-upsert: false`: a path is written once). */
export async function putFile(
  target: Target,
  blob: Blob,
  onProgress: (sent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { 'content-type': target.type, 'x-upsert': 'false' };
  if (target.apiKey) headers.apikey = target.apiKey;
  const res = await xhr('PUT', target.url, headers, blob, onProgress, signal);
  if (res.status >= 200 && res.status < 300) return;
  const outcome = classify(res.status, res.text);
  if (outcome === 'done') return;
  throw new UploadFailure(outcome);
}

export interface ResumableState {
  endpoint: string;
  /** the upload's own address, once created */
  location: string | null;
  /** bytes the server has */
  offset: number;
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

/**
 * A resumable upload (the tus protocol that Supabase Storage speaks, with the signed token in
 * x-signature): created once, then sent in chunks; after any interruption it asks the server how
 * much arrived and continues from there. `save` records the state (IndexedDB) after every step.
 */
export async function tusUpload(
  target: Target,
  blob: Blob,
  state: ResumableState,
  save: (s: ResumableState) => Promise<void> | void,
  onProgress: (sent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base: Record<string, string> = { 'Tus-Resumable': '1.0.0', 'x-signature': target.token };
  if (target.apiKey) base.apikey = target.apiKey;
  let s = { ...state };

  const create = async () => {
    const res = await xhr(
      'POST',
      s.endpoint,
      {
        ...base,
        'Upload-Length': String(blob.size),
        'x-upsert': 'false',
        'Upload-Metadata': [
          `bucketName ${b64(target.bucket)}`,
          `objectName ${b64(target.path)}`,
          `contentType ${b64(target.type)}`,
          `cacheControl ${b64('3600')}`,
        ].join(','),
      },
      null,
      undefined,
      signal,
      30_000,
    );
    if (res.status !== 201) {
      const outcome = classify(res.status, res.text);
      if (outcome === 'done') return 'done' as const;
      throw new UploadFailure(outcome);
    }
    const location = res.header('Location');
    if (!location) throw new UploadFailure('server');
    s = { ...s, location: new URL(location, s.endpoint).toString(), offset: 0 };
    await save(s);
    return 'created' as const;
  };

  if (!s.location) {
    if ((await create()) === 'done') return;
  } else {
    // where did it stop?
    const head = await xhr('HEAD', s.location, base, null, undefined, signal, 30_000);
    if (head.status === 404 || head.status === 410) {
      s = { ...s, location: null, offset: 0 };
      if ((await create()) === 'done') return;
    } else if (head.status >= 200 && head.status < 300) {
      s = { ...s, offset: Number(head.header('Upload-Offset') ?? 0) || 0 };
      await save(s);
    } else {
      const outcome = classify(head.status, head.text);
      if (outcome === 'done') return;
      throw new UploadFailure(outcome);
    }
  }

  const chunk = GALLERY.limits.resumableChunk;
  let conflicts = 0;
  while (s.offset < blob.size) {
    const piece = blob.slice(s.offset, Math.min(blob.size, s.offset + chunk));
    const from = s.offset;
    const res = await xhr(
      'PATCH',
      s.location!,
      { ...base, 'Upload-Offset': String(s.offset), 'Content-Type': 'application/offset+octet-stream' },
      piece,
      (loaded) => onProgress(from + loaded),
      signal,
    );
    if (res.status === 409 || res.status === 423) {
      // the server has a different offset (or is still finishing the last request): ask it and
      // continue from there — a few times; the queue retries later if it keeps disagreeing
      if (++conflicts > 3) throw new UploadFailure('server');
      const head = await xhr('HEAD', s.location!, base, null, undefined, signal, 30_000);
      if (head.status < 200 || head.status >= 300)
        throw new UploadFailure(classify(head.status, head.text) === 'expired' ? 'expired' : 'server');
      s = { ...s, offset: Number(head.header('Upload-Offset') ?? 0) || 0 };
      await save(s);
      continue;
    }
    conflicts = 0;
    if (res.status < 200 || res.status >= 300) {
      const outcome = classify(res.status, res.text);
      if (outcome === 'done') return;
      throw new UploadFailure(outcome);
    }
    s = { ...s, offset: Number(res.header('Upload-Offset') ?? from + piece.size) };
    onProgress(s.offset);
    await save(s);
  }
}
