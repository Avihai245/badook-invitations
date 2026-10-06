import 'server-only';
import { HOST_EVENTS, type HostEventName } from '@/features/analytics/model';
import { serviceDb } from '@/lib/supabase/server';

/** One step of the hosts' path (features/analytics) over the last 30 days: how many hosts, how often. */
export interface HostPathStep {
  name: HostEventName;
  hosts: number;
  times: number;
}

/**
 * The hosts' path on the console's overview — where new hosts stop between seeing their events and
 * sending the invitation. Every known step, in the path's order (a step nobody took: zeros); null when
 * it couldn't be read.
 */
export async function hostPathSummary(now = Date.now()): Promise<HostPathStep[] | null> {
  try {
    const { data, error } = await serviceDb().rpc('host_funnel', {
      p_from: new Date(now - 30 * 86_400_000).toISOString(),
      p_to: new Date(now).toISOString(),
    });
    if (error) throw new Error(error.message);
    const rows = new Map(((data as HostPathStep[] | null) ?? []).map((r) => [r.name, r]));
    return HOST_EVENTS.map((name) => ({
      name,
      hosts: Number(rows.get(name)?.hosts ?? 0),
      times: Number(rows.get(name)?.times ?? 0),
    }));
  } catch (err) {
    console.error('[admin] host path', err);
    return null;
  }
}
