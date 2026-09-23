import type { SectionOf } from '../../contracts/types';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';

/**
 * Gallery and Reveal are P4 deliverables (§11). Until then they render in a static, on-brand form so
 * documents that contain them (e.g. the save-the-date fixture) never break.
 */
export function GalleryView({ section, ctx }: SectionViewProps<SectionOf<'gallery'>>) {
  const images = section.data.images
    .map((img) => ({ ...img, url: ctx.asset(img.src) }))
    .filter((img): img is typeof img & { url: string } => !!img.url);
  if (!images.length) return null;
  return (
    <section className="sec" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        {section.data.title ? <SecHead title={ctx.text(section.data.title)} /> : null}
        <div className="gallery-grid reveal" style={iv(2)}>
          {images.map((img) => (
            <img key={img.id} src={img.url} alt={ctx.text(img.alt)} loading="lazy" decoding="async" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function RevealView({ section, ctx }: SectionViewProps<SectionOf<'reveal'>>) {
  const d = section.data;
  return (
    <>
      <section className="sec" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          <SecHead title={ctx.text(d.title)} />
          <div className="card reveal" style={iv(2)}>
            <p className="sec-sub">{ctx.text(d.prompt)}</p>
            <p className="v-name" style={{ marginTop: 12 }}>
              {ctx.eventDateLong}
            </p>
            {ctx.hebrewDate ? <p className="v-addr">{ctx.hebrewDate}</p> : null}
          </div>
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
