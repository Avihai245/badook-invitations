import { hostApi } from '@/features/invitations/app/api';
import type { Face } from '../model';
import type { FaceHostView, PendingForBrowser } from '../server/api';
import { loadFaceEngine, pictureForFaces } from './engine';

/**
 * The host's "prepare face search", in their browser: the photos no browser has looked at yet come in
 * small batches (signed URLs of their display versions), the faces in each are found right here, and
 * only what was found (boxes and descriptors) goes back — with the next batch in the answer. Resumable:
 * the server knows which photos are done, so stopping (or closing the tab) and starting again goes on
 * from the same point. A photo the browser can't read counts as looked at, with no faces.
 */
export interface PrepareProgress {
  /** photos done in this run */
  done: number;
  /** photos left when this run started (its own ones included) */
  total: number;
  phase: 'model' | 'faces';
}

export type PrepareOutcome =
  | { ok: true; done: number; faces: number }
  | { ok: false; error: 'unsupported' | 'failed' | 'unauthorized' | 'aborted'; done: number };

export async function prepareFaces(
  invitationId: string,
  onProgress: (p: PrepareProgress) => void,
  signal: AbortSignal,
): Promise<PrepareOutcome> {
  const url = `/api/invitations/${invitationId}/gallery/faces`;
  const first = await hostApi<{ view: FaceHostView; pending: PendingForBrowser[] }>(url);
  if (first.status === 401) return { ok: false, error: 'unauthorized', done: 0 };
  if (!first.ok || !first.body) return { ok: false, error: 'failed', done: 0 };
  const { view } = first.body;
  let pending = first.body.pending;
  const total = Math.max(0, view.state.photos - view.state.scanned);
  let done = 0;
  let faces = 0;
  onProgress({ done, total, phase: 'model' });
  let engine;
  try {
    engine = await loadFaceEngine();
  } catch {
    return { ok: false, error: 'unsupported', done };
  }
  onProgress({ done, total, phase: 'faces' });
  while (pending.length) {
    if (signal.aborted) return { ok: false, error: 'aborted', done };
    const results: { id: string; faces: Face[] }[] = [];
    for (const photo of pending) {
      if (signal.aborted) break;
      let found: Face[] = [];
      try {
        found = await engine.detect(await pictureForFaces(photo.url));
      } catch {
        found = [];
      }
      results.push({ id: photo.id, faces: found });
    }
    if (!results.length) return { ok: false, error: 'aborted', done };
    const res = await hostApi<{ done: number; faces: number; pending: PendingForBrowser[] }>(url, {
      method: 'POST',
      body: { results },
    });
    if (res.status === 401) return { ok: false, error: 'unauthorized', done };
    if (!res.ok || !res.body) return { ok: false, error: 'failed', done };
    done += results.length;
    faces += res.body.faces;
    onProgress({ done, total: Math.max(total, done), phase: 'faces' });
    pending = res.body.pending;
  }
  return { ok: true, done, faces };
}
