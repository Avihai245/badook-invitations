import type { SectionOf } from '../../contracts/types';
import { isHttpsUrl } from '../../lib/urls';
import { Icon } from '../../ui/Icon';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

export function TextView({ section, prev, ctx }: SectionViewProps<SectionOf<'text'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  const title = d.title ? ctx.text(d.title) : '';
  const body = ctx.text(d.body);
  const cta = d.cta && isHttpsUrl(d.cta.url) ? d.cta : null;
  // nothing to say in this language → no section at all (no empty band of padding)
  if (!title && !body && !d.illustration && !cta) return null;
  const illustration = d.illustration ? ctx.asset(d.illustration) : null;
  return (
    <section
      className={prev?.type === 'text' ? 'sec tight' : 'sec'}
      data-edit-path={editPath(ctx, section)}
      data-kind={d.kind}
    >
      <div className="wrap">
        {title ? <SecHead title={title} sub={ctx.text(d.subtitle)} path={path} /> : null}
        {body ? (
          <p className="sec-body reveal" style={iv(2)} data-edit-path={path && `${path}.body`}>
            {body}
          </p>
        ) : null}
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
        {cta ? (
          <div className="actions reveal" style={iv(4)}>
            <a className="btn btn-outline" href={cta.url} target="_blank" rel="noopener noreferrer">
              {ctx.text(cta.label)}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
