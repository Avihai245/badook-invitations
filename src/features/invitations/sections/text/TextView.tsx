import type { SectionOf } from '../../contracts/types';
import { Icon } from '../../ui/Icon';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

export function TextView({ section, prev, ctx }: SectionViewProps<SectionOf<'text'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  const illustration = d.illustration ? ctx.asset(d.illustration) : null;
  return (
    <section
      className={prev?.type === 'text' ? 'sec tight' : 'sec'}
      data-edit-path={editPath(ctx, section)}
      data-kind={d.kind}
    >
      <div className="wrap">
        {d.title ? <SecHead title={ctx.text(d.title)} sub={ctx.text(d.subtitle)} path={path} /> : null}
        <p className="sec-body reveal" style={iv(2)} data-edit-path={path && `${path}.body`}>
          {ctx.text(d.body)}
        </p>
        {illustration ? (
          <img
            className="illus-img reveal"
            style={iv(3)}
            src={illustration}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : d.illustration ? (
          <span className="illus reveal" style={iv(3)} aria-hidden="true">
            <Icon name={ctx.art.ornament} size={88} strokeWidth={0.8} />
          </span>
        ) : null}
        {d.cta ? (
          <div className="actions reveal" style={iv(4)}>
            <a className="btn btn-outline" href={d.cta.url} target="_blank" rel="noopener noreferrer">
              {ctx.text(d.cta.label)}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
