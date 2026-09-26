import type { SectionOf } from '../../contracts/types';
import { isHttpsUrl } from '../../lib/urls';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

/**
 * Text with a picture or video (v2): a title, a subtitle, the text and a button, beside or over the
 * section's media (drawn by its CineSection). Without any text it is a picture band of its own — as
 * long as there is a picture to show (the `cinematic` feature on); otherwise nothing.
 */
export function CustomView({ section, ctx }: SectionViewProps<SectionOf<'custom'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  const title = ctx.text(d.title);
  const body = ctx.text(d.body);
  const cta = d.cta && isHttpsUrl(d.cta.url) ? d.cta : null;
  const ctaLabel = cta ? ctx.text(cta.label) : '';
  const pictureOnly = ctx.cinematic && !!section.media;
  if (!title && !body && !ctaLabel && !pictureOnly) return null;
  return (
    <section className="sec cu" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        {title ? <SecHead title={title} sub={ctx.text(d.subtitle)} path={path} /> : null}
        {body ? (
          <p className="sec-body reveal" style={iv(2)} data-edit-path={path && `${path}.body`}>
            {body}
          </p>
        ) : null}
        {cta && ctaLabel ? (
          <div className="actions reveal" style={iv(3)}>
            <a className="btn btn-outline" href={cta.url} target="_blank" rel="noopener noreferrer">
              {ctaLabel}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
