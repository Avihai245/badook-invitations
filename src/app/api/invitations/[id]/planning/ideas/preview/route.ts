import { hostRoute } from '@/features/invitations/server/host-route';
import { planningDeps } from '@/features/planning/server/deps';
import {
  liveFetch,
  liveResolve,
  PREVIEW_LIMIT,
  previewOperation,
  type PreviewDeps,
} from '@/features/planning/server/preview';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

/** The real DNS and connection, and the hour's count per user (the support assistant's counter, under its own key). */
const previewDeps: PreviewDeps = {
  resolve: liveResolve,
  fetch: liveFetch,
  async rateHit(userId) {
    const { data, error } = await serviceDb().rpc('support_rate_hit', {
      p_key_hash: rateKey('planning', 'preview', userId),
      p_limit: PREVIEW_LIMIT.count,
      p_window_seconds: PREVIEW_LIMIT.windowSeconds,
    });
    if (error) throw new Error(`support_rate_hit: ${error.message}`);
    return data === true;
  },
};

/** POST /api/invitations/:id/planning/ideas/preview — { url } → { preview: { title?, description?, image?, site? } }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => previewOperation(userId, id, body, planningDeps, previewDeps));
}
