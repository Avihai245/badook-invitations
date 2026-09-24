import type { CSSProperties } from 'react';
import type { SectionOf } from '../../contracts/types';
import { longestWordLength } from '../../lib/text';
import { DAY_MONTH_YEAR, formatDate } from '../../lib/dates';
import { Icon } from '../../ui/Icon';
import { editPath, iv, type SectionViewProps } from '../shared';

export function FooterView({ section, ctx }: SectionViewProps<SectionOf<'footer'>>) {
  const d = section.data;
  const { hosts } = ctx.doc;
  const path = editPath(ctx, section, 'data');
  const decoration = ctx.asset(ctx.template.decorations.footer);
  const names = [
    ctx.text(hosts.primary),
    hosts.secondary ? ctx.text(hosts.joiner) || '&' : '',
    ctx.text(hosts.secondary),
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <footer className="sec" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        {decoration ? (
          <img className="illus-img reveal" src={decoration} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="illus reveal" aria-hidden="true">
            <Icon name={ctx.art.ornament} size={72} strokeWidth={0.8} />
          </span>
        )}
        {d.showHosts ? (
          <p
            className="f-names reveal"
            style={{ ...iv(1), '--chars': longestWordLength(names, ctx.locale) } as CSSProperties}
          >
            <bdi>{names}</bdi>
          </p>
        ) : null}
        {d.showDate ? (
          <p className="f-date reveal" style={iv(2)}>
            {formatDate(ctx.doc.event.date, ctx.locale, DAY_MONTH_YEAR)}
          </p>
        ) : null}
        {d.showParents && hosts.parents ? (
          <p className="f-parents reveal" style={iv(3)}>
            {ctx.text(hosts.parents)}
          </p>
        ) : null}
        {d.closingLine ? (
          <p className="f-close reveal" style={iv(4)} data-edit-path={path && `${path}.closingLine`}>
            {ctx.text(d.closingLine)}
          </p>
        ) : null}
        {d.showCredit ? <p className="credit">{ctx.t('footer.madeWith', { brand: ctx.brand })}</p> : null}
        {/* guests reach the accessibility statement and the privacy policy from every invitation */}
        <p className="f-legal">
          <a href="/accessibility" target="_blank" rel="noopener">
            {ctx.t('footer.accessibility')}
          </a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy" target="_blank" rel="noopener">
            {ctx.t('footer.privacy')}
          </a>
        </p>
      </div>
    </footer>
  );
}
