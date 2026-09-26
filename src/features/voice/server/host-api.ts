import 'server-only';
import { packageFor, whyOff, type FeatureInput } from '@/features/flags/features';

/**
 * The host's view of the invitation read aloud (GET /api/invitations/:id/voice): whether guests are
 * offered "listen", whether the audio is made here or read by the guests' devices, and each language's
 * state. Switching it off or on is the features API's (PATCH /api/invitations/:id/features).
 */

export type ApiResult = { status: number; body: Record<string, unknown> };

export interface VoiceHostDeps {
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  state(
    invitationId: string,
    ownerId: string,
  ): Promise<
    | {
        locale: string;
        status: 'pending' | 'processing' | 'ready' | 'failed';
        ready: boolean;
        updatedAt: string;
      }[]
    | null
  >;
  /** the speech service is set up */
  configured: boolean;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function getVoice(userId: string, id: string, deps: VoiceHostDeps): Promise<ApiResult> {
  const notFound = { status: 404, body: { ok: false, code: 'not_found' } };
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  const why = whyOff('voice', input);
  // not offered here, or not in the plan: refused (the editor shows the upgrade)
  if (why === 'unavailable' || why === 'plan')
    return {
      status: 403,
      body: { ok: false, code: 'feature_off', feature: 'voice', package: packageFor('voice') },
    };
  const languages = (await deps.state(id, userId)) ?? [];
  return {
    status: 200,
    body: { ok: true, on: why === null, configured: deps.configured, languages },
  };
}
