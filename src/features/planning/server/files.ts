import { z } from 'zod';
import { fail, gate, isRefusal, notFound, ok, type ApiResult, type PlanningDeps } from './types';

/**
 * The plan's files: quotes, contracts and receipts (a paid tool: `planning_export`) and the ideas board's
 * pictures (the section's own). The browser uploads straight to the private plan-files bucket with a
 * signed URL under <owner>/<invitation>/<uuid>.<ext>, and reads them back through signed URLs for the
 * paths of this event only.
 */

export const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
/** The bucket's own limit. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const FilesOp = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('upload'),
    purpose: z.enum(['attachment', 'idea_image']),
    contentType: z.string().max(100),
    size: z.number().int().positive(),
  }),
  z.strictObject({ op: z.literal('read'), paths: z.array(z.string().max(300)).min(1).max(60) }),
]);

/** POST …/planning/files { op: 'upload' | 'read', … }. */
export async function filesOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const parsed = FilesOp.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid');
  const input = parsed.data;
  const g = await gate(
    userId,
    id,
    deps,
    input.op === 'upload' && input.purpose === 'attachment' ? 'planning_export' : 'planning',
  );
  if (isRefusal(g)) return g;
  if (input.op === 'upload') {
    if (!deps.signedUpload) return fail(501, 'unsupported');
    const ext = FILE_TYPES[input.contentType];
    if (!ext) return fail(415, 'unsupported_type');
    if (input.size > MAX_FILE_BYTES) return fail(413, 'too_large', { max: MAX_FILE_BYTES });
    const signed = await deps.signedUpload(`${userId}/${id}/${deps.newId()}.${ext}`);
    return ok({ path: signed.path, url: signed.url, token: signed.token });
  }
  if (!deps.signedReads) return fail(501, 'unsupported');
  const prefix = `${userId}/${id}/`;
  // only this event's own files, and nothing that climbs out of its folder
  const own = [...new Set(input.paths)].filter(
    (p) => p.startsWith(prefix) && !p.includes('..') && !p.slice(prefix.length).includes('/'),
  );
  if (own.length === 0) return notFound;
  return ok({ urls: await deps.signedReads(own) });
}
