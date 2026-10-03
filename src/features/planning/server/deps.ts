import 'server-only';
import { randomUUID } from 'node:crypto';
import { featureInput } from '@/features/flags/server';
import { hostDb } from '@/features/invitations/server/host-db';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';
import type { PrivateTemplateItems } from '../model/draft';
import { planningAi } from './ai';
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
  // the AI of the paid tools: the same model and key as the translation and the design studio
  get ai() {
    const env = serverEnv();
    return planningAi(
      env.ANTHROPIC_API_KEY && env.INVITES_AI_MODEL
        ? { apiKey: env.ANTHROPIC_API_KEY, model: env.INVITES_AI_MODEL, apiBase: env.INVITES_AI_API_BASE }
        : null,
    );
  },
  async rateHit(key, limit, windowSeconds) {
    const { data, error } = await serviceDb().rpc('gallery_rate_hit', {
      p_key_hash: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(`gallery_rate_hit: ${error.message}`);
    return data === true;
  },
  rateKey: (scope, value) => rateKey('planning-ai', scope, value),
  get aiLimits() {
    const env = serverEnv();
    return { perAccount: env.INVITES_PLANNING_AI_DAILY_LIMIT, site: env.INVITES_AI_DAILY_LIMIT };
  },
  async privateTemplate(id, ownerId) {
    return rpc<PrivateTemplateItems | null>('planning_template_get', { p_owner: ownerId, p_id: id });
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
