import type { Metadata } from 'next';
import { InvitationsList } from '@/features/invitations/app/list/InvitationsList';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { hostDb } from '@/features/invitations/server/host-db';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.list.title };
}

/** /app/invitations — the host's invitations (§9B.3-A). */
export default async function InvitationsPage() {
  const user = await requireUser('/app/invitations');
  return (
    <>
      {/* the cards' posters write the names in their designs' fonts */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationsList items={await hostDb.list(user.id)} />
    </>
  );
}
