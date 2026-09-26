import type { SectionOf } from '../../contracts/types';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

/**
 * The parents (v2) — a fixture of Israeli invitations: each side's parents under its label ("The
 * bride's parents" · "Rachel & Moshe Cohen"), side by side when there are two; without names of its
 * own, the event's `hosts.parents` as one line. Nothing to show → no section.
 */
export function ParentsView({ section, ctx }: SectionViewProps<SectionOf<'parents'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  const items = d.items
    .map((item, i) => ({ id: item.id, i, label: ctx.text(item.label), names: ctx.text(item.names) }))
    .filter((item) => item.names);
  const fallback = items.length ? '' : ctx.text(ctx.doc.hosts.parents);
  if (!items.length && !fallback) return null;
  const title = ctx.text(d.title);
  const note = ctx.text(d.note);
  return (
    <section className="sec pa" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        {title ? <SecHead title={title} path={path} /> : null}
        {items.length ? (
          <div className={items.length === 2 ? 'pa-list pair' : 'pa-list'}>
            {items.map((item, k) => (
              <div
                key={item.id}
                className="pa-item reveal"
                style={iv(k + 1)}
                data-edit-path={path && `${path}.items.${item.i}`}
              >
                {item.label ? <p className="pa-label">{item.label}</p> : null}
                <p className="pa-names">
                  <bdi>{item.names}</bdi>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="pa-names pa-one reveal" style={iv(1)}>
            <bdi>{fallback}</bdi>
          </p>
        )}
        {note ? (
          <p className="pa-note reveal" style={iv(items.length + 2)} data-edit-path={path && `${path}.note`}>
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
