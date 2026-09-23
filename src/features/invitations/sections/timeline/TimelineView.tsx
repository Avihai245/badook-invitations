import type { CSSProperties } from 'react';
import type { SectionOf } from '../../contracts/types';
import { Icon, TIMELINE_ICON } from '../../ui/Icon';
import { Decoration, SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { FlipCards } from './FlipCards.client';

export type TimelineVariant = 'horizontal-icons' | 'vertical' | 'flip-cards';

export function TimelineView({ section, ctx }: SectionViewProps<SectionOf<'timeline'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  const variant = (section.variant ??
    ctx.template.sectionDefaults.variants.timeline ??
    'vertical') as TimelineVariant;
  const flip = variant === 'flip-cards' || d.revealMode === 'flip';
  // Horizontal only from 640px, when the variant allows it and there are ≤ 6 items (§9A.4).
  const horizontal = variant === 'horizontal-icons' && d.items.length <= 6;
  return (
    <>
      <section className="sec" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          <SecHead title={ctx.text(d.title)} path={path} />
          {d.showDate ? (
            <p className="tl-date reveal" style={iv(1)}>
              {ctx.eventDateLong}
            </p>
          ) : null}
          {flip ? (
            <FlipCards
              hint={ctx.t('timeline.tapToReveal')}
              items={d.items.map((it) => ({
                id: it.id,
                time: ctx.time(it.time),
                icon: TIMELINE_ICON[it.icon],
                label: ctx.text(it.label),
              }))}
            />
          ) : (
            <ol className={horizontal ? 'tl h' : 'tl'} style={{ '--n': d.items.length } as CSSProperties}>
              {d.items.map((it, i) => (
                <li
                  className="reveal"
                  style={iv(i + 2)}
                  key={it.id}
                  data-edit-path={path && `${path}.items.${i}`}
                >
                  <span className="dot" aria-hidden="true">
                    <Icon name={TIMELINE_ICON[it.icon]} size={20} />
                  </span>
                  <span>
                    <span className="pill ltr">{ctx.time(it.time)}</span>
                    <span className="lbl">{ctx.text(it.label)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      <Decoration slot="afterTimeline" ctx={ctx} />
      <div className="divider" />
    </>
  );
}
