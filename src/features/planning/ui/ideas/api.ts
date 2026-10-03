import { hostApi, loginUrl, type ApiResponse } from '@/features/invitations/app/api';
import type { PlanApi } from '../PlanProvider';

/** The browser's side of the ideas board's calls that are not changes of the plan: reading, previews, pictures. */

/** POST to one of the plan's routes without touching the "all changes saved" line (a read is not a change). */
export async function readApi<T = Record<string, unknown>>(
  planId: string,
  path: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  const res = await hostApi<T>(`/api/invitations/${planId}/planning${path}`, { method: 'POST', body });
  if (res.status === 401) window.location.assign(loginUrl());
  return res;
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** The bucket's limit (server/files.ts). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** A picture bigger than this is scaled down in the browser before it goes up. */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1800;

export class ImageError extends Error {
  constructor(readonly code: 'type' | 'size' | 'failed') {
    super(code);
  }
}

const isImageType = (type: string): type is (typeof IMAGE_TYPES)[number] =>
  (IMAGE_TYPES as readonly string[]).includes(type);

/** A big photo scaled to at most 1800 px on its long side (a phone's 12 MB shot becomes a few hundred KB). */
async function prepare(file: File): Promise<Blob> {
  if (file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type === 'image/png' ? 'image/webp' : file.type, 0.85),
    );
    return blob && isImageType(blob.type) && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Sends a picture to the plan's private files: the files route gives a signed address under
 * `<owner>/<invitation>/…`, and the browser PUTs the file there. Answers the stored path (which the card
 * keeps as `imagePath`) and the file itself (to show at once, before a signed read exists).
 */
export async function uploadIdeaImage(
  call: PlanApi['call'],
  file: File,
): Promise<{ path: string; blob: Blob }> {
  if (!isImageType(file.type)) throw new ImageError('type');
  const blob = await prepare(file);
  if (blob.size > MAX_IMAGE_BYTES) throw new ImageError('size');
  const ticket = await call<{ path?: string; url?: string }>('/files', {
    op: 'upload',
    purpose: 'idea_image',
    contentType: blob.type,
    size: blob.size,
  });
  const { path, url } = ticket.body ?? {};
  if (!ticket.ok || !path || !url)
    throw new ImageError(ticket.status === 413 ? 'size' : ticket.status === 415 ? 'type' : 'failed');
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': blob.type, 'x-upsert': 'false' },
    body: blob,
  }).catch(() => null);
  if (!put?.ok) throw new ImageError('failed');
  return { path, blob };
}
