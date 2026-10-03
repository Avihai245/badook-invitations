import 'server-only';
import { randomUUID } from 'node:crypto';
import { featureInput } from '@/features/flags/server';
import { hostDb } from '@/features/invitations/server/host-db';
import { serviceDb } from '@/lib/supabase/server';
import type { PrivateTemplateItems } from '../model/draft';
import type { PlanningDeps } from './types';

/** The files bucket (supabase/migrations/*_planning_core.sql): private, <owner>/<invitation>/<file>. */
export const PLAN_FILES_BUCKET = 'plan-files';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

/** The planning API's dependencies on Supabase (the service role; every function checks the owner). */
export const planningDeps: PlanningDeps = {
  access: featureInput,
  rpc,
  async summary(invitationId, ownerId) {
    const list = await hostDb.list(ownerId);
    const item = list.find((i) => i.id === invitationId);
    return item
      ? {
          eventType: item.eventType,
          status: item.status,
          unpublishedChanges: item.unpublishedChanges,
          guests: item.guests,
          sent: item.sent,
          responses: item.responses,
        }
      : null;
  },
  now: () => Date.now(),
  newId: randomUUID,
  async privateTemplate(id, ownerId) {
    const { data, error } = await serviceDb()
      .from('plan_templates')
      .select('items')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) throw new Error(`plan_templates: ${error.message}`);
    return (data?.items as PrivateTemplateItems | undefined) ?? null;
  },
  async signedUpload(path) {
    const { data, error } = await serviceDb().storage.from(PLAN_FILES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`signed upload: ${error?.message ?? 'no data'}`);
    return { path: data.path, url: data.signedUrl, token: data.token };
  },
  async signedReads(paths) {
    if (!paths.length) return {};
    const { data, error } = await serviceDb().storage.from(PLAN_FILES_BUCKET).createSignedUrls(paths, 3600);
    if (error) throw new Error(`signed reads: ${error.message}`);
    const urls: Record<string, string> = {};
    for (const d of data ?? []) if (d.signedUrl && d.path) urls[d.path] = d.signedUrl;
    return urls;
  },
};
