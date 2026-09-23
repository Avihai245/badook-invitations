import type { SectionOf } from '../../contracts/types';
import { calendarLabels, calendarLinks, firstVenue } from '../../renderer/calendar-event';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { Reveal } from './Reveal.client';

/** Reveal (§2.2 sections 9, §10.3 save-the-date): the date behind a scratch / tap / spin mechanic. */
export function RevealView({ section, ctx }: SectionViewProps<SectionOf<'reveal'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  return (
    <>
      <section className="sec" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          <SecHead title={ctx.text(d.title)} path={path} />
          <div className="card rv-card reveal" style={iv(2)}>
            <Reveal
              mechanic={d.mechanic}
              prompt={ctx.text(d.prompt)}
              date={ctx.eventDateLong}
              hebrewDate={ctx.hebrewDate}
              iso={ctx.doc.event.date}
              buttonLabel={ctx.t('reveal.button')}
              calendar={
                d.showCalendarButton
                  ? {
                      label: ctx.t('venue.addToCalendar'),
                      labels: calendarLabels(ctx),
                      links: calendarLinks(ctx, firstVenue(ctx)),
                    }
                  : null
              }
            />
          </div>
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
