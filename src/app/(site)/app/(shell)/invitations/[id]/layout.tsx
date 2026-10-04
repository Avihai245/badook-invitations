import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { mayOpenConsole } from '@/features/admin/server/gate';
import { whyOff } from '@/features/flags/features';
import { deploymentFeatures, featureInput } from '@/features/flags/server';
import { ItemPoster } from '@/features/invitations/app/ItemPoster';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { InvitationWorkspace } from '@/features/invitations/app/workspace/InvitationWorkspace';
import { planningTab } from '@/features/planning/server/badge';
import { ticketsDb } from '@/features/support/tickets/server/db';
import { getUiLocale } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';
import { UserMenu } from '../../ShellNav.client';

type Params = Promise<{ id: string }>;

/**
 * An event's space — its home, the four stages' screens, insights and settings share one frame: the
 * event's sidebar (from 1024px) or bottom bar (phones), and a compact strip with the names, date and
 * publish; the editor (app/(editor)) stays full-screen. An id that isn't one of the host's invitations
 * is a 404.
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
  const [item, input, admin, unread, uiLocale] = await Promise.all([
    ownerInvitation(user.id, id),
    featureInput(id).catch(() => null),
    mayOpenConsole(user),
    ticketsDb.unread(user.id).catch(() => 0),
    getUiLocale(),
  ]);
  if (!item) notFound();
  // seating and the event day: there when the event has them, or offered when only the package keeps them off
  const offer = (why: ReturnType<typeof whyOff> | 'unavailable') =>
    why === null ? ('on' as const) : why === 'plan' ? ('plan' as const) : null;
  const seating = offer(input ? whyOff('seating', input) : 'unavailable');
  const eventDay = offer(input ? whyOff('checkin', input) : 'unavailable');
  // the planning stage (feature planning): there when the event has it, with its open tasks
  const planning = await planningTab(
    user.id,
    item,
    {
      eventType: item.eventType,
      status: item.status,
      unpublishedChanges: item.unpublishedChanges,
      guests: item.guests,
      sent: item.sent,
      responses: item.responses,
    },
    input,
  );
  const features = deploymentFeatures();
  return (
    <>
      {/* the posters write the names in the design's font */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationWorkspace
        item={item}
        caps={{
          planning: planning !== null,
          seating,
          eventDay,
          gallery: features.has('live_gallery'),
          insights: features.has('analytics'),
        }}
        plan={planning?.planned ? { open: planning.open } : null}
        seating={planning?.seating ?? null}
        account={<UserMenu email={user.email ?? null} admin={admin} unread={unread} compact />}
        thumb={
          <ItemPoster
            item={item}
            uiLocale={uiLocale}
            className="w-full rounded-[9px]! shadow-[0_8px_16px_-10px_rgba(60,35,15,0.7)]!"
          />
        }
      >
        {children}
      </InvitationWorkspace>
    </>
  );
}
