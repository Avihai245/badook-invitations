import type { SectionOf } from '../../contracts/types';
import { DAY_MONTH_YEAR, formatDate } from '../../lib/dates';
import { googleMapsEmbedUrl, googleMapsUrl, hasLocation, wazeUrl } from '../../lib/maps';
import { calendarLabels, calendarLinks } from '../../renderer/calendar-event';
import { Icon } from '../../ui/Icon';
import { editPath, iv, type SectionViewProps } from '../shared';
import { CalendarMenu } from '../venues/CalendarMenu.client';
import { MapEmbed } from '../venues/MapEmbed.client';

/**
 * Where (v2): one place told big — its label as the title, the name, the address, the day and time,
 * the map (lazy, as in venues), the Maps / Waze / calendar buttons and a note (directions, parking).
 */
export function WhereView({ section, ctx }: SectionViewProps<SectionOf<'where'>>) {
  const { venue: v, note } = section.data;
  const path = editPath(ctx, section, 'data');
  const date = v.date ?? ctx.doc.event.date;
  const name = ctx.text(v.name);
  const address = ctx.text(v.address);
  const located = hasLocation({ ...v, fallbackQuery: address });
  const mapsTarget = { ...v, fallbackQuery: [name, address].join(' ') };
  const noteText = ctx.text(note);
  return (
    <section className="sec wr" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <h2 className="sec-title reveal" data-edit-path={path && `${path}.venue.label`}>
          {ctx.text(v.label)}
        </h2>
        {name ? (
          <h3 className="v-name wr-name reveal" style={iv(1)} data-edit-path={path && `${path}.venue.name`}>
            {name}
          </h3>
        ) : null}
        {address ? (
          <p className="v-addr reveal" style={iv(2)} data-edit-path={path && `${path}.venue.address`}>
            {address}
          </p>
        ) : null}
        <p className="v-when reveal" style={iv(3)}>
          <span>{formatDate(date, ctx.locale, { weekday: 'long' })}</span>
          <span className="sep" aria-hidden="true" />
          <span>{formatDate(date, ctx.locale, DAY_MONTH_YEAR)}</span>
          <span className="sep" aria-hidden="true" />
          <span className="ltr">{ctx.time(v.startTime)}</span>
        </p>
        {v.showMap && located ? (
          <MapEmbed
            src={ctx.mode === 'live' ? googleMapsEmbedUrl(mapsTarget, ctx.locale) : null}
            label={ctx.t('map.label', { name })}
            style={iv(4)}
          />
        ) : null}
        {noteText ? (
          <p className="wr-note reveal" style={iv(5)} data-edit-path={path && `${path}.note`}>
            {noteText}
          </p>
        ) : null}
        <div className="actions reveal" style={iv(6)}>
          {v.buttons.maps && located ? (
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
          {v.buttons.waze && located ? (
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
  );
}
