import type { Venue } from '../contracts/types';
import { buildIcs, type CalendarEvent } from '../lib/calendar';
import { eventRange } from '../lib/dates';
import type { RenderContext } from './context-core';

/** Event title for calendars: the hosts ("נועה & איתי") or the custom hero title. */
export function calendarTitle(ctx: RenderContext): string {
  const hero = ctx.doc.sections.find((s) => s.type === 'hero');
  if (hero?.type === 'hero' && hero.data.title.mode === 'custom') return ctx.text(hero.data.title.text);
  const { primary, secondary, joiner } = ctx.doc.hosts;
  return [ctx.text(primary), secondary ? ctx.text(joiner) || '&' : '', ctx.text(secondary)]
    .filter(Boolean)
    .join(' ');
}

/** The invitation page's title (and link-preview title): the host's share title, else the calendar title. */
export function pageTitle(ctx: RenderContext): string {
  return ctx.text(ctx.doc.share.ogTitle) || calendarTitle(ctx);
}

/** Calendar event of one venue — shared by the venue/RSVP calendar menus and /i/[slug]/event.ics. */
export function venueCalendarEvent(ctx: RenderContext, venue: Venue): CalendarEvent {
  const { start, end } = eventRange(ctx.doc, venue);
  const base = ctx.doc.share.slug;
  return {
    uid: `${base}-${venue.id}@${new URL(ctx.publicBaseUrl).hostname}`,
    title: calendarTitle(ctx),
    start,
    end,
    location: [ctx.text(venue.name), ctx.text(venue.address)].filter(Boolean).join(', '),
    url: `${ctx.publicBaseUrl}/i/${base}`,
    timezone: ctx.doc.timezone,
  };
}

/** "Apple / .ics" link: the /i/[slug]/event.ics route on the public page, a data: URL elsewhere. */
export function icsHref(ctx: RenderContext, venue: Venue): string {
  return ctx.icsViaRoute
    ? `/i/${ctx.doc.share.slug}/event.ics?venue=${encodeURIComponent(venue.id)}&lang=${ctx.locale}`
    : `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(venueCalendarEvent(ctx, venue), new Date(ctx.now)))}`;
}
