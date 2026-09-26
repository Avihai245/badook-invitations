import 'server-only';
import { featureInput, featuresFor } from '@/features/flags/server';
import { rateKey } from '@/lib/links/tokens';
import { INSIGHTS } from '../config';
import { memo, type BeaconDeps, type ReportDeps } from './api';
import { insightsDb } from './db';

/** The real dependencies of the insights' API (tests pass their own). */

// an invitation's slug and its feature, remembered for a minute per server: most beacons cost one query
const invitationOf = memo(INSIGHTS.cacheMs, (slug: string) => insightsDb.invitation(slug));
const analyticsOf = memo(INSIGHTS.cacheMs, async (id: string) => (await featuresFor(id)).has('analytics'));

export function beaconDeps(): BeaconDeps {
  return {
    db: { invitation: (slug) => invitationOf(slug), hit: insightsDb.hit },
    analytics: (id) => analyticsOf(id),
    rateKey: (ip) => rateKey('insights', 'ip', ip ?? 'unknown'),
    now: () => Date.now(),
  };
}

export function reportDeps(): ReportDeps {
  return { db: insightsDb, featureInput };
}

/** The daily run: page loads older than the policy says go (the daily numbers stay). */
export async function insightsHousekeeping() {
  return insightsDb.maintenance(INSIGHTS.rawDays);
}
