import type { SectionOf } from '../../contracts/types';
import { countdownPhase } from '../../lib/countdown';
import { eventRange, zonedTimeToUtc } from '../../lib/dates';
import { SecHead, editPath, type SectionViewProps } from '../shared';
import { Countdown } from './Countdown.client';

export function CountdownView({ section, ctx }: SectionViewProps<SectionOf<'countdown'>>) {
  const d = section.data;
  const target =
    d.target === 'event'
      ? eventRange(ctx.doc).start.getTime()
      : zonedTimeToUtc(d.target.date, d.target.time, ctx.doc.timezone).getTime();
  // From the target until +24h the afterEvent text shows; after that the section hides (§2.2.3).
  if (countdownPhase(target, ctx.now) === 'hidden') return null;
  const path = editPath(ctx, section, 'data');
  return (
    <>
      <section className="sec" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          <SecHead title={ctx.text(d.title)} sub={ctx.text(d.subtitle)} path={path} />
          <Countdown
            targetMs={target}
            initialNow={ctx.now}
            locale={ctx.locale}
            afterText={ctx.text(d.afterEvent)}
          />
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
