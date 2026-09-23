import type { SectionOf } from '../../contracts/types';
import { Icon } from '../../ui/Icon';
import { editPath, type SectionViewProps } from '../shared';

export function GiftsView({ section, ctx }: SectionViewProps<SectionOf<'gifts'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  return (
    <section className="sec" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <div className="card reveal">
          <span className="badge" aria-hidden="true">
            <Icon name="gift" size={22} />
          </span>
          <h2 className="sec-title" data-edit-path={path && `${path}.title`}>
            {ctx.text(d.title)}
          </h2>
          <p className="sec-body" data-edit-path={path && `${path}.body`}>
            {ctx.text(d.body)}
          </p>
          {d.links.length ? (
            <div className="stack">
              {d.links.map((l, i) =>
                l.url ? (
                  <a
                    key={l.id}
                    className="btn btn-outline"
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-edit-path={path && `${path}.links.${i}`}
                  >
                    {ctx.text(l.label)}
                  </a>
                ) : (
                  <div key={l.id} className="details" data-edit-path={path && `${path}.links.${i}`}>
                    <strong>{ctx.text(l.label)}</strong>
                    {l.details ? <div>{ctx.text(l.details)}</div> : null}
                  </div>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
