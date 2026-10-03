import 'server-only';
import { whyOff, type FeatureInput } from '@/features/flags/features';
import { readIntegrations } from '../model/integrations';
import type { CategoryKey } from '../model/categories';
import { planningDeps } from './deps';
import { rawState } from './types';

/** The budget block of the invitation's insights tab: committed against planned, by category. */
export interface InsightsBudget {
  rows: {
    id: string;
    key: CategoryKey | null;
    name: string | null;
    planned: number;
    committed: number;
    paid: number;
  }[];
  total: number | null;
  committed: number;
  paid: number;
}

/**
 * The insights tab's budget block, or null: the event has no planning, the plan has no spending yet, or
 * the host turned the plan's overview-and-insights link off. Never in the way of the page.
 */
export async function insightsBudget(
  ownerId: string,
  id: string,
  input: (FeatureInput & { ownerId: string }) | null,
): Promise<InsightsBudget | null> {
  if (!input || whyOff('planning', input) !== null) return null;
  try {
    const raw = await rawState(planningDeps, id, ownerId);
    if (!raw?.settings || raw.invitation.eventType === 'save_the_date') return null;
    if (!readIntegrations(raw.settings.integrations).overview) return null;
    const rows = raw.categories
      .map((c) => {
        const t = raw.totals.byCategory.find((x) => x.id === c.id);
        return {
          id: c.id,
          key: c.key,
          name: c.name,
          planned: t?.planned ?? 0,
          committed: t?.committed ?? 0,
          paid: t?.paid ?? 0,
        };
      })
      .filter((r) => r.committed > 0 || r.planned > 0);
    if (!rows.some((r) => r.committed > 0)) return null;
    return { rows, total: raw.totals.totalBudget, committed: raw.totals.committed, paid: raw.totals.paid };
  } catch (err) {
    console.error('[planning insights]', err);
    return null;
  }
}
