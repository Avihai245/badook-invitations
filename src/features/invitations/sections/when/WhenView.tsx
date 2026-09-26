import type { SectionOf } from '../../contracts/types';
import { countdownPhase } from '../../lib/countdown';
import { eventRange, formatDate } from '../../lib/dates';
import { calendarLabels, calendarLinks, firstVenue } from '../../renderer/calendar-event';
import { Icon } from '../../ui/Icon';
import { Countdown } from '../countdown/Countdown.client';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { CalendarMenu } from '../venues/CalendarMenu.client';

/**
 * When (v2): the date told big — the weekday, the day's number, the month and year — then the Hebrew
 * date, the time, an optional small countdown and "Add to calendar". Always the event's own date, so
 * it follows every change to it.
 */
export function WhenView({ section, ctx }: SectionViewProps<SectionOf<'when'>>) {
  const d = section.data;
  const { doc } = ctx;
  const path = editPath(ctx, section, 'data');
  const date = doc.event.date;
  const start = eventRange(doc).start.getTime();
  const counting = d.countdown && countdownPhase(start, ctx.now) === 'counting';
  const title = ctx.text(d.title);
  const note = ctx.text(d.note);
  let i = title ? 1 : 0;
  return (
    <section className="sec wh" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        {title ? <SecHead title={title} path={path} /> : null}
        <p className="wh-date reveal" style={iv(i++)}>
          {d.showWeekday ? (
            <span className="wh-weekday">{formatDate(date, ctx.locale, { weekday: 'long' })}</span>
          ) : null}
          <span className="wh-day">{formatDate(date, ctx.locale, { day: 'numeric' })}</span>
          <span className="wh-month">{formatDate(date, ctx.locale, { month: 'long', year: 'numeric' })}</span>
        </p>
        {d.showHebrewDate && ctx.hebrewDate ? (
          <p className="wh-hdate reveal" style={iv(i++)}>
            {ctx.hebrewDate}
          </p>
        ) : null}
        {d.showTime ? (
          <p className="v-when wh-time reveal" style={iv(i++)}>
            <Icon name="clock" size={18} /> <span className="ltr">{ctx.time(doc.event.startTime)}</span>
          </p>
        ) : null}
        {counting ? (
          <Countdown targetMs={start} initialNow={ctx.now} locale={ctx.locale} afterText="" />
        ) : null}
        {note ? (
          <p className="wh-note reveal" style={iv(i++)} data-edit-path={path && `${path}.note`}>
            {note}
          </p>
        ) : null}
        {d.showCalendar ? (
          <div className="actions reveal" style={iv(i++)}>
            <CalendarMenu
              label={ctx.t('venue.addToCalendar')}
              links={calendarLinks(ctx, firstVenue(ctx))}
              labels={calendarLabels(ctx)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
