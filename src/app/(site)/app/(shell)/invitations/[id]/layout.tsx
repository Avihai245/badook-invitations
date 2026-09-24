import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { InvitationWorkspace } from '@/features/invitations/app/workspace/InvitationWorkspace';
import { requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

/**
 * An invitation's workspace — its overview, guests & WhatsApp, RSVPs and sharing share one header
 * (poster, names, date, status, publish) and tabs; the editor (app/(editor)) stays full-screen.
 * An id that isn't one of the host's invitations is a 404.
 */
export default async function InvitationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}`);
  const item = await ownerInvitation(user.id, id);
  if (!item) notFound();
  return (
    <>
      {/* the header's poster writes the names in the design's font */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationWorkspace item={item}>{children}</InvitationWorkspace>
    </>
  );
}
