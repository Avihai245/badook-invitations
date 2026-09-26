import { featureInput } from '@/features/flags/server';
import { hostRoute } from '@/features/invitations/server/host-route';
import { speechConfig } from '@/features/voice/server/deps';
import { getVoice } from '@/features/voice/server/host-api';
import { speechConfigured } from '@/features/voice/server/speech';
import { serviceDb } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/voice — the invitation read aloud: offered or not, and each language's state. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) =>
    getVoice(userId, id, {
      featureInput,
      async state(invitationId, ownerId) {
        const { data, error } = await serviceDb().rpc('voice_owner_state', {
          p_id: invitationId,
          p_owner: ownerId,
        });
        if (error) throw new Error(`voice_owner_state: ${error.message}`);
        return data;
      },
      configured: speechConfigured(speechConfig()),
    }),
  );
}
