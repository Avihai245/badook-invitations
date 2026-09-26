import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { GalleryCounts } from '@/features/live-gallery/server/db';
import type { BeaconState, DayRow } from '../model';

/**
 * Typed access to the insights' database functions (supabase/migrations/*_insights.sql). Always the
 * service role; each function checks the owner itself.
 */

export interface RawReport {
  status: 'draft' | 'published' | 'archived';
  timezone: string;
  from: string;
  to: string;
  eventDate: string | null;
  publishedAt: string | null;
  days: DayRow[];
  personal: {
    guests: number;
    sent: number;
    opened: number;
    opens: number;
    firstOpens: { day: string; n: number }[];
  };
  responses: { total: number; attending: number };
  gallery: GalleryCounts | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

type HitState = Omit<BeaconState, 'slug' | 'visit'>;

export const insightsDb = {
  invitation: (slug: string) =>
    rpc<{ id: string; timezone: string | null } | null>('insight_invitation', { p_slug: slug }),

  hit: (invitationId: string, visit: string, day: string, state: HitState, rateKey: string) =>
    rpc<{ ok: boolean; code?: string } | null>('insight_hit', {
      p_invitation_id: invitationId,
      p_visit: visit,
      p_day: day,
      p_state: state,
      p_rate_key: rateKey,
    }),

  report: (id: string, ownerId: string, days: number) =>
    rpc<RawReport | null>('insight_owner_report', { p_id: id, p_owner: ownerId, p_days: days }),

  maintenance: (days: number) => rpc<{ visits: number }>('insight_maintenance', { p_days: days }),
};

export type InsightsDb = typeof insightsDb;
