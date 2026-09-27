import type { CSSProperties } from 'react';
import { preload } from 'react-dom';
import { HeroPlaceholder } from '../../sections/hero/HeroView';
import type { RenderContext } from '../context-core';
import { SCENE_OVERLAY, type SceneModel } from './model';
import { SceneParticles } from './SceneParticles.client';
import { SceneProp } from './SceneProp';

/**
 * The scroll scene's backdrop (renderer/scene): pinned behind the page (`.sc-back` is sticky, one
 * screen tall), a stack of pictures that SceneDriver cross-fades and slowly zooms as the guest scrolls,
 * each under the dark gradient that keeps the texts readable, and the particles' canvas over them. The
 * first picture is the page's one eager image — preloaded, at high priority: the first screen once the
 * cover opens (or at once with ?open=1). The others carry their addresses as data only: they load as
 * the guest nears them. Decorative: aria-hidden.
 */
export function SceneBackdrop({ ctx, scene }: { ctx: RenderContext; scene: SceneModel }) {
  const first = scene.layers[0]?.picture;
  if (first)
    preload(first.src, {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: first.srcSet,
      imageSizes: first.sizes,
    });
  return (
    <div className="sc-back" aria-hidden="true">
      {scene.layers.map((layer, i) => (
        <div
          key={layer.key}
          className="sc-layer"
          data-i={i}
          data-zoom={layer.zoom}
          data-drift={layer.drift ?? undefined}
          style={{ '--sc-k': Math.round((layer.overlay / SCENE_OVERLAY) * 100) / 100 } as CSSProperties}
        >
          {layer.picture ? (
            <img
              className="sc-pic"
              src={i === 0 ? layer.picture.src : undefined}
              srcSet={i === 0 ? layer.picture.srcSet : undefined}
              sizes={layer.picture.sizes}
              data-src={i === 0 ? undefined : layer.picture.src}
              data-srcset={i === 0 ? undefined : layer.picture.srcSet}
              data-fallback={layer.picture.fallback}
              alt=""
              decoding="async"
              fetchPriority={i === 0 ? 'high' : 'low'}
              draggable={false}
              style={{ objectPosition: layer.picture.position }}
              // the error fallback (images.ts) may swap it for the original before React hydrates, and
              // the driver gives the later pictures their addresses
              suppressHydrationWarning
            />
          ) : (
            // the design's own art: the hero's sky, clouds and hills — or its drawn scene
            <div className="sc-pic sc-art">
              <HeroPlaceholder art={ctx.art} date={ctx.doc.event.date} />
            </div>
          )}
          <div className="sc-shade" />
        </div>
      ))}
      {scene.prop ? <SceneProp kind={scene.prop} /> : null}
      {scene.particles !== 'none' ? (
        <SceneParticles
          kind={scene.particles}
          colors={scene.particleColors}
          seed={`${ctx.template.id}:${ctx.doc.share.slug}`}
        />
      ) : null}
    </div>
  );
}
