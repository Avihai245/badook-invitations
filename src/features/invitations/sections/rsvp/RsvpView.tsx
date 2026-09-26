import type { SectionOf } from '../../contracts/types';
import { dictEntries } from '../../i18n/dictionary';
import { INTL_LOCALE, endOfDayUtc } from '../../lib/dates';
import { Decoration, SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { calendarLabels, calendarLinks, firstVenue } from '../../renderer/calendar-event';
import { fxTheme } from '../../renderer/fx/theme';
import { RSVP_NOTES } from './notes';
import { RsvpForm, type RsvpFormConfig } from './RsvpForm.client';
import { RSVP_KEYS } from './strings';

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

  const config: RsvpFormConfig = {
    slug: doc.share.slug,
    locale: ctx.locale,
    intl: INTL_LOCALE[ctx.locale],
    strings: dictEntries(ctx.locale, RSVP_KEYS),
    notes: RSVP_NOTES[ctx.locale],
    askChildren: d.askChildren,
    maxAdults: d.maxAdults,
    maxChildren: d.askChildren ? d.maxChildren : 0,
    requirePhone: d.requirePhone,
    requireEmail: d.askEmail && d.requireEmail,
    askEmail: d.askEmail,
    nameFormat: d.nameFormat,
    askMessage: d.askMessage,
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
    closedMessage: ctx.text(d.closedMessage),
    // the first venue's event — or, without venues, the event itself
    calendar: {
      label: ctx.t('venue.addToCalendar'),
      labels: calendarLabels(ctx),
      links: calendarLinks(ctx, firstVenue(ctx)),
    },
    submitMode: ctx.mode === 'live' && ctx.icsViaRoute ? 'api' : 'simulate',
    celebrate: (() => {
      const fx = fxTheme(ctx.template, doc);
      return fx.burst ? { kind: fx.burst, colors: fx.burstColors } : null;
    })(),
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
