import { hostRoute } from '@/features/invitations/server/host-route';
import { setEventTools } from '@/features/invitations/server/tools-api';
import { serviceDb } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

/** PUT /api/invitations/:id/tools { tools } — what the host needs for the event (invitations/lib/tools). */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) =>
    setEventTools(userId, id, body, {
      async set(invitationId, ownerId, tools) {
        const { data, error } = await serviceDb().rpc('invitation_tools_set', {
          p_id: invitationId,
          p_owner: ownerId,
          p_tools: tools,
        });
        if (error) throw new Error(`invitation_tools_set: ${error.message}`);
        return data;
      },
    }),
  );
}
