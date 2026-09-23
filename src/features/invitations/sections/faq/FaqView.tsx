import type { SectionOf } from '../../contracts/types';
import { Icon } from '../../ui/Icon';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

export function FaqView({ section, ctx }: SectionViewProps<SectionOf<'faq'>>) {
  const d = section.data;
  if (d.items.length === 0) return null;
  const path = editPath(ctx, section, 'data');
  return (
    <section className="sec" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <SecHead title={ctx.text(d.title)} path={path} />
        <div className="faq reveal" style={iv(2)}>
          {d.items.map((q, i) => (
            <details key={q.id} data-edit-path={path && `${path}.items.${i}`}>
              <summary>
                {ctx.text(q.q)}
                <Icon name="chevron-down" size={20} />
              </summary>
              <p>{ctx.text(q.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
