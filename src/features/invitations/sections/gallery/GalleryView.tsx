import type { SectionOf } from '../../contracts/types';
import { SecHead, editPath, iv, type SectionViewProps } from '../shared';
import { Gallery } from '../../renderer/lazy.client';
import type { GalleryImage } from './Gallery.client';

/** Gallery (§2.2 sections 8): the host's photos as a carousel or a grid, each opening full screen. */
export function GalleryView({ section, ctx }: SectionViewProps<SectionOf<'gallery'>>) {
  const d = section.data;
  const images = d.images.flatMap((img): GalleryImage[] => {
    const url = ctx.asset(img.src);
    return url ? [{ id: img.id, url, alt: ctx.text(img.alt), width: img.width, height: img.height }] : [];
  });
  if (!images.length) return null;
  const path = editPath(ctx, section, 'data');
  return (
    <>
      <section className="sec" data-edit-path={editPath(ctx, section)}>
        <div className="wrap">
          {d.title ? <SecHead title={ctx.text(d.title)} path={path} /> : null}
          <div className="gallery reveal" style={iv(2)} data-layout={d.layout}>
            <Gallery
              images={images}
              layout={d.layout}
              labels={{
                label: ctx.text(d.title) || ctx.t('gallery.label'),
                open: ctx.t('gallery.open'),
                close: ctx.t('gallery.close'),
                prev: ctx.t('gallery.prev'),
                next: ctx.t('gallery.next'),
                counter: ctx.t('gallery.counter'),
              }}
            />
          </div>
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
