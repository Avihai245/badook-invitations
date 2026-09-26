import type { SectionOf } from '../../contracts/types';
import { editPath, iv, type SectionViewProps } from '../shared';

/**
 * A quote (v2): a verse, a song, a line the hosts love — large, in the display font, with its source
 * below. Nothing in this language → no section.
 */
export function QuoteView({ section, ctx }: SectionViewProps<SectionOf<'quote'>>) {
  const d = section.data;
  const text = ctx.text(d.text);
  if (!text) return null;
  const path = editPath(ctx, section, 'data');
  const by = ctx.text(d.attribution);
  return (
    <section className="sec qt" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <figure className="qt-figure">
          {/* an opening quote mark, drawn (mirrored in Hebrew: it opens on the right) */}
          <svg className="qt-mark reveal" viewBox="0 0 48 36" aria-hidden="true" focusable="false">
            <path d="M20 4C10 6 3 13 3 23c0 6 4 10 9 10 5 0 8-3 8-8s-3-8-8-8c-1 0-2 0-3 .5C10 12 14 8 21 7zM45 4C35 6 28 13 28 23c0 6 4 10 9 10 5 0 8-3 8-8s-3-8-8-8c-1 0-2 0-3 .5C35 12 39 8 46 7z" />
          </svg>
          <blockquote className="q-text reveal" style={iv(1)} data-edit-path={path && `${path}.text`}>
            {text}
          </blockquote>
          {by ? (
            <figcaption className="q-by reveal" style={iv(2)} data-edit-path={path && `${path}.attribution`}>
              {by}
            </figcaption>
          ) : null}
        </figure>
      </div>
    </section>
  );
}
