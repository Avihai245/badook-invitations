import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { planBaseUrl, PLAN_BUCKET } from '@/features/seating/server';
import { serviceDb } from '@/lib/supabase/server';
import { PARTNER_SOURCE, type PartnerDeps } from './api';
import { fetchPlanFile } from './fetch-plan';
import { MAX_PLAN_BYTES, type VenueDeps, type VenuePutAnswer, type VenueRecord } from './venues';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

/**
 * The venue API's dependencies on Supabase (the service role; the functions keep each partner to its
 * own venues), the venue-plans bucket and the safe fetcher. The rate limit is the partner API's.
 */
export function venueDeps(partner: Pick<PartnerDeps, 'rateHit'>): VenueDeps {
  const storage = () => serviceDb().storage.from(PLAN_BUCKET);
  return {
    rateHit: partner.rateHit,
    get: (venueId) =>
      rpc<VenueRecord | null>('partner_venue_get', { p_source: PARTNER_SOURCE, p_external_id: venueId }),
    put: (venueId, fields, values, plan) =>
      rpc<VenuePutAnswer>('partner_venue_put', {
        p_source: PARTNER_SOURCE,
        p_external_id: venueId,
        p_fields: fields,
        p_name: values.name,
        p_address: values.address,
        p_width_meters: values.widthMeters,
        p_plan: plan,
      }),
    fetchPlan: async (url) => (await fetchPlanFile(url, { maxBytes: MAX_PLAN_BYTES })).bytes,
    async store(path, bytes, contentType) {
      const { error } = await storage().upload(path, bytes, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
      if (error) throw new Error(`plan upload: ${error.message}`);
    },
    async remove(path) {
      const { error } = await storage().remove([path]);
      if (error) throw new Error(`plan remove: ${error.message}`);
    },
    planUrl: (path) => `${planBaseUrl()}/${path}`,
    // the venue's folder: its id hashed (the path shows nothing of the partner's ids)
    folder: (venueId) =>
      createHash('sha256').update(`${PARTNER_SOURCE}:${venueId}`).digest('hex').slice(0, 32),
    newId: randomUUID,
  };
}
