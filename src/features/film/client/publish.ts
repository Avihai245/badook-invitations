import { hostApi } from '@/features/invitations/app/api';
import { GALLERY } from '@/features/live-gallery/config';
import {
  putFile,
  tusUpload,
  UploadFailure,
  type ResumableState,
} from '@/features/live-gallery/client/transport';
import type { PartTicket, ReservedItem } from '@/features/live-gallery/types';

/**
 * "Add to the gallery": the finished film goes the way guests' uploads do — the server reserves its
 * place and signs an upload URL for each file (the video, its still, its thumbnail), the browser sends
 * them straight to storage (a large film resumably, in chunks), and the server checks they arrived
 * before the film joins the gallery — in the guests' feed and on the venue screen when `show`.
 */

export type PublishOutcome =
  | { ok: true; id: string }
  | {
      ok: false;
      code:
        | 'unauthorized'
        | 'full'
        | 'no_gallery'
        | 'feature_off'
        | 'too_large'
        | 'upload'
        | 'failed'
        | 'aborted';
    };

interface FilmFiles {
  video: Blob;
  display: Blob;
  thumb: Blob;
  width: number;
  height: number;
  durationMs: number;
}

async function send(
  ticket: PartTicket,
  blob: Blob,
  type: string,
  onSent: (n: number) => void,
  signal: AbortSignal,
) {
  const target = {
    url: ticket.url,
    token: ticket.token,
    bucket: ticket.bucket,
    path: ticket.path,
    type,
    apiKey: ticket.resumable?.apiKey,
  };
  if (ticket.resumable && blob.size >= GALLERY.limits.resumableFrom) {
    let state: ResumableState = { endpoint: ticket.resumable.endpoint, location: null, offset: 0 };
    // a dropped connection: ask the server where it stopped, and go on (a few times)
    for (let attempt = 0; ; attempt++) {
      try {
        await tusUpload(target, blob, state, (s) => void (state = s), onSent, signal);
        return;
      } catch (err) {
        if (!(err instanceof UploadFailure) || err.code !== 'network' || attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  await putFile(target, blob, onSent, signal);
}

export async function addFilmToGallery(
  invitationId: string,
  files: FilmFiles,
  show: boolean,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<PublishOutcome> {
  const url = `/api/invitations/${invitationId}/gallery/film`;
  const reserved = await hostApi<{ item?: ReservedItem; code?: string }>(url, {
    method: 'POST',
    body: {
      step: 'reserve',
      original: { type: files.video.type, size: files.video.size },
      display: { type: 'image/jpeg', size: files.display.size },
      thumb: { type: 'image/jpeg', size: files.thumb.size },
      width: files.width,
      height: files.height,
      durationMs: files.durationMs,
    },
  });
  if (reserved.status === 401) return { ok: false, code: 'unauthorized' };
  const code = reserved.body?.code;
  if (!reserved.ok || !reserved.body?.item) {
    if (code === 'full' || code === 'no_gallery' || code === 'feature_off' || code === 'too_large')
      return { ok: false, code };
    return { ok: false, code: 'failed' };
  }
  const item = reserved.body.item;
  const total = files.video.size + files.display.size + files.thumb.size;
  const sent = { thumb: 0, display: 0, original: 0 };
  const report = () => onProgress((sent.thumb + sent.display + sent.original) / total);
  try {
    await send(item.parts.thumb!, files.thumb, 'image/jpeg', (n) => ((sent.thumb = n), report()), signal);
    await send(
      item.parts.display!,
      files.display,
      'image/jpeg',
      (n) => ((sent.display = n), report()),
      signal,
    );
    await send(
      item.parts.original!,
      files.video,
      files.video.type,
      (n) => ((sent.original = n), report()),
      signal,
    );
  } catch (err) {
    if (err instanceof UploadFailure && err.code === 'aborted') return { ok: false, code: 'aborted' };
    if (err instanceof UploadFailure && err.code === 'too_large') return { ok: false, code: 'too_large' };
    return { ok: false, code: 'upload' };
  }
  const done = await hostApi<{ code?: string }>(url, {
    method: 'POST',
    body: { step: 'done', id: item.id, show },
  });
  if (done.status === 401) return { ok: false, code: 'unauthorized' };
  if (!done.ok) return { ok: false, code: 'failed' };
  return { ok: true, id: item.id };
}
