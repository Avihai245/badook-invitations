import { Fragment, type ComponentType, type CSSProperties } from 'react';
import { FollowUpCard } from '../sections/follow-up/FollowUpCard';
import { Decoration, type SectionViewProps } from '../sections/shared';
import { SECTION_VIEWS } from '../sections/views';
import { CineSection } from './cinematic/CineSection';
import { sectionPresentation } from './cinematic/presentation';
import type { RenderContext } from './context-core';

/**
 * The invitation's sections in document order (§5) — rendered on the server by every page, and in the
 * browser by the live language switch (the other locale) and the editor preview. A section with a v2
 * presentation (and the `cinematic` feature on) is drawn inside its CineSection; every other section
 * renders exactly as in v1. As a scroll scene each section is drawn over the scene's backdrop.
 */
export function InvitationSections({ ctx }: { ctx: RenderContext }) {
  const enabled = ctx.doc.sections.filter((s) => s.enabled);
  const scene = ctx.scene;
  if (scene) {
    // The scroll scene (renderer/scene): every section over the pinned backdrop, transparent, in a
    // wrapper that says which picture is behind it (SceneDriver) and how its texts come in (its
    // `animation` read for the scene: rise-blur by default, its stagger). Its media is the backdrop's
    // picture, so no section draws media of its own, nor colors of its own (one film, one light).
    return (
      <main>
        {enabled.map((section) => {
          const View = SECTION_VIEWS[section.type] as ComponentType<SectionViewProps>;
          const reveal = scene.revealOf[section.id];
          return (
            <div
              key={section.id}
              className="sc-sec"
              data-section={section.id}
              data-type={section.type}
              data-layer={scene.layerOf[section.id]}
              data-reveal={reveal?.preset}
              style={{ '--sr-step': `${reveal?.stagger ?? 90}ms` } as CSSProperties}
            >
              <View section={section} prev={undefined} ctx={ctx} />
              {section.type === 'hero' ? <FollowUpCard ctx={ctx} /> : null}
            </div>
          );
        })}
      </main>
    );
  }
  const shown = enabled.map((s) => sectionPresentation(s, ctx));
  return (
    <main>
      {enabled.map((section, k) => {
        const View = SECTION_VIEWS[section.type] as ComponentType<SectionViewProps>;
        const p = shown[k];
        // a band of its own (media, its own colors) doesn't tighten against the text before it
        const prev = p?.band || shown[k - 1]?.band ? undefined : enabled[k - 1];
        const view = <View section={section} prev={prev} ctx={ctx} />;
        return (
          <Fragment key={section.id}>
            {p ? (
              <CineSection p={p} sectionId={section.id}>
                {view}
              </CineSection>
            ) : (
              view
            )}
            {section.type === 'hero' ? (
              <>
                <Decoration slot="afterHero" ctx={ctx} />
                <FollowUpCard ctx={ctx} />
              </>
            ) : null}
          </Fragment>
        );
      })}
    </main>
  );
}
