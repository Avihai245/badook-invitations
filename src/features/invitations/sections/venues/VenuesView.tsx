import { Fragment } from 'react';
import type { SectionOf } from '../../contracts/types';
import { DAY_MONTH_YEAR, formatDate } from '../../lib/dates';
import { googleMapsEmbedUrl, googleMapsUrl, hasLocation, wazeUrl } from '../../lib/maps';
import { calendarLabels, calendarLinks } from '../../renderer/calendar-event';
import { Icon } from '../../ui/Icon';
import { Decoration, SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { CalendarMenu } from './CalendarMenu.client';
import { MapEmbed } from './MapEmbed.client';

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
                  <MapEmbed
                    // the editor and previews keep the placeholder (an iframe would swallow clicks)
                    src={ctx.mode === 'live' ? googleMapsEmbedUrl(mapsTarget, ctx.locale) : null}
                    label={ctx.t('map.label', { name: ctx.text(v.name) })}
                    style={iv(4)}
                  />
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
                      labels={calendarLabels(ctx)}
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
