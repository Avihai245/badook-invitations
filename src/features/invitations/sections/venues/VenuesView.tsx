import { Fragment } from 'react';
import type { SectionOf, Venue } from '../../contracts/types';
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from '../../lib/calendar';
import { DAY_MONTH_YEAR, eventRange, formatDate } from '../../lib/dates';
import { googleMapsUrl, hasLocation, wazeUrl } from '../../lib/maps';
import type { RenderContext } from '../../renderer/context';
import { Icon } from '../../ui/Icon';
import { Decoration, SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { CalendarMenu, type CalendarLinks } from './CalendarMenu.client';

/** Event title for calendars: the hosts ("נועה & איתי") or the custom hero title. */
export function calendarTitle(ctx: RenderContext): string {
  const hero = ctx.doc.sections.find((s) => s.type === 'hero');
  if (hero?.type === 'hero' && hero.data.title.mode === 'custom') return ctx.text(hero.data.title.text);
  const { primary, secondary, joiner } = ctx.doc.hosts;
  return [ctx.text(primary), secondary ? ctx.text(joiner) || '&' : '', ctx.text(secondary)]
    .filter(Boolean)
    .join(' ');
}

export function venueCalendarEvent(ctx: RenderContext, venue: Venue): CalendarEvent {
  const { start, end } = eventRange(ctx.doc, venue);
  const base = ctx.doc.share.slug;
  return {
    uid: `${base}-${venue.id}@${new URL(ctx.publicBaseUrl).host}`,
    title: calendarTitle(ctx),
    start,
    end,
    location: [ctx.text(venue.name), ctx.text(venue.address)].filter(Boolean).join(', '),
    url: `${ctx.publicBaseUrl}/i/${base}`,
    timezone: ctx.doc.timezone,
  };
}

function calendarLinks(ctx: RenderContext, venue: Venue): CalendarLinks {
  const event = venueCalendarEvent(ctx, venue);
  const slug = ctx.doc.share.slug;
  return {
    google: googleCalendarUrl(event),
    outlook: outlookCalendarUrl(event),
    ics: ctx.icsViaRoute
      ? `/i/${slug}/event.ics?venue=${encodeURIComponent(venue.id)}`
      : `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event, new Date(ctx.now)))}`,
    icsFileName: `${slug}-${venue.id}.ics`,
  };
}

export function VenuesView({ section, ctx }: SectionViewProps<SectionOf<'venues'>>) {
  return (
    <>
      {section.data.items.map((v, idx) => {
        const date = v.date ?? ctx.doc.event.date;
        const path = editPath(ctx, section, `data.items.${idx}`);
        const located = hasLocation({ ...v, fallbackQuery: ctx.text(v.address) });
        const mapsTarget = { ...v, fallbackQuery: [ctx.text(v.name), ctx.text(v.address)].join(' ') };
        return (
          <Fragment key={v.id}>
            <section className="sec" data-edit-path={path}>
              <div className="wrap">
                <SecHead title={ctx.text(v.label)} />
                <div className="badge reveal" style={iv(1)} aria-hidden="true">
                  <Icon name="map-pin" size={22} />
                </div>
                <h3 className="v-name reveal" style={iv(2)} data-edit-path={path && `${path}.name`}>
                  {ctx.text(v.name)}
                </h3>
                <p className="v-addr reveal" style={iv(2)} data-edit-path={path && `${path}.address`}>
                  {ctx.text(v.address)}
                </p>
                <p className="v-when reveal" style={iv(3)}>
                  <span>{formatDate(date, ctx.locale, { weekday: 'long' })}</span>
                  <span className="sep" aria-hidden="true" />
                  <span>{formatDate(date, ctx.locale, DAY_MONTH_YEAR)}</span>
                </p>
                <p className="v-when reveal" style={iv(3)}>
                  <Icon name="clock" size={18} /> <span className="ltr">{ctx.time(v.startTime)}</span>
                </p>
                {v.showMap && located ? (
                  <div
                    className="map reveal"
                    style={iv(4)}
                    role="img"
                    aria-label={ctx.t('map.label', { name: ctx.text(v.name) })}
                  >
                    <span className="pin">
                      <Icon name="map-pin" size={40} strokeWidth={1.6} />
                    </span>
                    <span className="chip">Google Maps</span>
                  </div>
                ) : null}
                <div className="actions reveal" style={iv(5)}>
                  {v.buttons.maps ? (
                    <a
                      className="btn btn-outline"
                      href={googleMapsUrl(mapsTarget)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="navigation" size={18} />
                      {ctx.t('venue.openInMaps')}
                    </a>
                  ) : null}
                  {v.buttons.waze ? (
                    <a
                      className="btn btn-outline"
                      href={wazeUrl(mapsTarget)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="navigation" size={18} />
                      {ctx.t('venue.openInWaze')}
                    </a>
                  ) : null}
                  {v.buttons.calendar ? (
                    <CalendarMenu
                      label={ctx.t('venue.addToCalendar')}
                      links={calendarLinks(ctx, v)}
                      labels={{
                        google: ctx.t('calendar.google'),
                        apple: ctx.t('calendar.apple'),
                        outlook: ctx.t('calendar.outlook'),
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </section>
            <Decoration slot="betweenVenues" ctx={ctx} />
          </Fragment>
        );
      })}
    </>
  );
}
