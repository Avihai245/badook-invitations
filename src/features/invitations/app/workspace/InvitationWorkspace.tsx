'use client';

import type { ReactNode } from 'react';
import type { InvitationSummary } from '../../server/host-db';
import { InWorkspace } from './context';
import { EventBar, EventBottomBar, EventSidebar } from './EventSpace';
import type { WorkspaceCaps } from './stages';

/**
 * An event's space (UX report §4.1): every screen of the event — its home, the four stages (planning,
 * inviting, arranging, celebrating), insights and settings — inside one frame. From 1024px the app's
 * sidebar gives way to the event's own (the shell hides its sidebar while `data-event-space` is on the
 * page), and a compact strip (names, date, countdown, publish) tops every screen; on phones the bottom
 * bar is the event's. The editor (app/(editor)) stays full-screen.
 */
export function InvitationWorkspace({
  item,
  caps,
  plan = null,
  seating = null,
  account,
  thumb,
  children,
}: {
  item: InvitationSummary;
  caps: WorkspaceCaps;
  /** the plan's open tasks and this week's (null: no plan yet, or no planning) */
  plan?: { open: number; week: number } | null;
  /** the seating's tables and confirmed guests not seated yet (null: not known) */
  seating?: { tables: number; unseated: number } | null;
  /** the account menu at the sidebar's foot */
  account: ReactNode;
  /** the invitation's poster, drawn on the server (app/ItemPoster) */
  thumb?: ReactNode;
  children: ReactNode;
}) {
  const data = { item, caps, plan, seating, thumb };
  return (
    <InWorkspace.Provider value>
      <div data-event-space="" className="lg:grid lg:min-h-dvh lg:grid-cols-[264px_minmax(0,1fr)]">
        <EventSidebar data={data} account={account} />
        <div className="min-w-0">
          <EventBar item={item} thumb={thumb} tools={caps.tools} />
          {children}
        </div>
      </div>
      <EventBottomBar data={data} />
    </InWorkspace.Provider>
  );
}
