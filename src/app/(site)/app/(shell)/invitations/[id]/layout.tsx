import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { whyOff } from '@/features/flags/features';
import { deploymentFeatures, featureInput } from '@/features/flags/server';
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
  const [item, input] = await Promise.all([ownerInvitation(user.id, id), featureInput(id).catch(() => null)]);
  if (!item) notFound();
  // the seating tab: when the event has the feature, or when only the package keeps it off
  const seatingOff = input ? whyOff('seating', input) : 'unavailable';
  const seating = seatingOff === null ? 'on' : seatingOff === 'plan' ? 'plan' : null;
  // the event day (check-in and the live hall) the same way
  const dayOff = input ? whyOff('checkin', input) : 'unavailable';
  const eventDay = dayOff === null ? 'on' : dayOff === 'plan' ? 'plan' : null;
  return (
    <>
      {/* the header's poster writes the names in the design's font */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationWorkspace
        item={item}
        seating={seating}
        eventDay={eventDay}
        galleryTab={deploymentFeatures().has('live_gallery')}
      >
        {children}
      </InvitationWorkspace>
    </>
  );
}
