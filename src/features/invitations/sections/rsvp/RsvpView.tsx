import type { SectionOf } from '../../contracts/types';
import { endOfDayUtc } from '../../lib/dates';
import { Decoration, SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { venueCalendarEvent } from '../venues/VenuesView';
import { buildIcs, googleCalendarUrl, outlookCalendarUrl } from '../../lib/calendar';
import { RsvpForm, type RsvpFormConfig } from './RsvpForm.client';

export function RsvpView({ section, ctx }: SectionViewProps<SectionOf<'rsvp'>>) {
  const d = section.data;
  const { doc } = ctx;
  const path = editPath(ctx, section, 'data');
  // After rsvpDeadline (end of that day in doc.timezone) the closed message replaces the form (§6.7).
  const closed = doc.event.rsvpDeadline
    ? ctx.now > endOfDayUtc(doc.event.rsvpDeadline, doc.timezone).getTime()
    : false;
  const subtitle =
    ctx.text(d.subtitle) ||
    (doc.event.rsvpDeadline ? ctx.t('rsvp.deadline', { date: ctx.tokens.deadline ?? '' }) : '');

  const firstVenue = doc.sections.find((s) => s.type === 'venues')?.data;
  const venue = firstVenue && 'items' in firstVenue ? firstVenue.items[0] : undefined;
  const event = venue ? venueCalendarEvent(ctx, venue) : null;
  const config: RsvpFormConfig = {
    slug: doc.share.slug,
    locale: ctx.locale,
    askChildren: d.askChildren,
    maxAdults: d.maxAdults,
    maxChildren: d.askChildren ? d.maxChildren : 0,
    requirePhone: d.requirePhone,
    requireEmail: d.requireEmail,
    perAttendeeDetails: d.perAttendeeDetails,
    dietary: {
      enabled: d.dietary.enabled,
      options: d.dietary.options,
      note: ctx.text(d.dietary.note) || null,
    },
    customQuestions: d.customQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      required: q.required,
      label: ctx.text(q.label),
      options: q.options?.map((o) => ({ value: o.value, label: ctx.text(o.label) })),
    })),
    messageLabel: ctx.text(d.messageLabel),
    successMessage: ctx.text(d.successMessage),
    declineMessage: ctx.text(d.declineMessage),
    calendar:
      event && venue
        ? {
            label: ctx.t('venue.addToCalendar'),
            labels: {
              google: ctx.t('calendar.google'),
              apple: ctx.t('calendar.apple'),
              outlook: ctx.t('calendar.outlook'),
            },
            links: {
              google: googleCalendarUrl(event),
              outlook: outlookCalendarUrl(event),
              ics: ctx.icsViaRoute
                ? `/i/${doc.share.slug}/event.ics?venue=${encodeURIComponent(venue.id)}`
                : `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event, new Date(ctx.now)))}`,
              icsFileName: `${doc.share.slug}-${venue.id}.ics`,
            },
          }
        : null,
    submitMode: ctx.mode === 'live' && ctx.icsViaRoute ? 'api' : 'simulate',
  };

  return (
    <>
      <Decoration slot="beforeRsvp" ctx={ctx} />
      <section className="sec" id="rsvp" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          <SecHead title={ctx.text(d.title)} sub={subtitle} path={path} />
          <div className="form reveal" style={iv(2)}>
            {closed ? <p className="closed">{ctx.text(d.closedMessage)}</p> : <RsvpForm config={config} />}
          </div>
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
