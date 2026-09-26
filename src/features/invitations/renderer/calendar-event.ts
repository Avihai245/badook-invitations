import type { Venue } from '../contracts/types';
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from '../lib/calendar';
import { eventRange } from '../lib/dates';
import type { CalendarLinks } from '../sections/venues/CalendarMenu.client';
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

/** The link-preview description: the host's share description, else the date (+ the Hebrew date). */
export function pageDescription(ctx: RenderContext): string {
  return (
    ctx.text(ctx.doc.share.ogDescription) || [ctx.eventDateLong, ctx.hebrewDate].filter(Boolean).join(' · ')
  );
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

/**
 * The event itself when the invitation has no venue (a save-the-date): the event's date and times,
 * no location.
 */
export function eventCalendarEvent(ctx: RenderContext): CalendarEvent {
  const { start, end } = eventRange(ctx.doc);
  const base = ctx.doc.share.slug;
  return {
    uid: `${base}@${new URL(ctx.publicBaseUrl).hostname}`,
    title: calendarTitle(ctx),
    start,
    end,
    location: '',
    url: `${ctx.publicBaseUrl}/i/${base}`,
    timezone: ctx.doc.timezone,
  };
}

/** Every venue the invitation shows: the enabled venues sections' items, then the `where` sections' places. */
export function shownVenues(doc: RenderContext['doc']): Venue[] {
  const venues = doc.sections.flatMap((s) => (s.enabled && s.type === 'venues' ? s.data.items : []));
  const places = doc.sections.flatMap((s) => (s.enabled && s.type === 'where' ? [s.data.venue] : []));
  return [...venues, ...places];
}

/** The first venue of the enabled venues section, if any (else a `where` section's place). */
export function firstVenue(ctx: RenderContext): Venue | null {
  const section = ctx.doc.sections.find((s) => s.type === 'venues' && s.enabled);
  if (section?.type === 'venues') return section.data.items[0] ?? null;
  return shownVenues(ctx.doc)[0] ?? null;
}

/**
 * "Apple / .ics" link: the /i/[slug]/event.ics route on the public page, a data: URL elsewhere.
 * Without a venue: the event itself.
 */
export function icsHref(ctx: RenderContext, venue: Venue | null): string {
  if (ctx.icsViaRoute) {
    const query = venue ? `venue=${encodeURIComponent(venue.id)}&` : '';
    return `/i/${ctx.doc.share.slug}/event.ics?${query}lang=${ctx.locale}`;
  }
  const event = venue ? venueCalendarEvent(ctx, venue) : eventCalendarEvent(ctx);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event, new Date(ctx.now)))}`;
}

/** Google / Outlook / .ics links of a venue — or, without one, of the event itself. */
export function calendarLinks(ctx: RenderContext, venue: Venue | null): CalendarLinks {
  const event = venue ? venueCalendarEvent(ctx, venue) : eventCalendarEvent(ctx);
  const slug = ctx.doc.share.slug;
  return {
    google: googleCalendarUrl(event),
    outlook: outlookCalendarUrl(event),
    ics: icsHref(ctx, venue),
    icsFileName: venue ? `${slug}-${venue.id}.ics` : `${slug}.ics`,
  };
}

/** The "Add to calendar" menu's labels in the page's locale. */
export const calendarLabels = (ctx: RenderContext) => ({
  google: ctx.t('calendar.google'),
  apple: ctx.t('calendar.apple'),
  outlook: ctx.t('calendar.outlook'),
});
