import { Fragment, type ComponentType } from 'react';
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
 * renders exactly as in v1.
 */
export function InvitationSections({ ctx }: { ctx: RenderContext }) {
  const enabled = ctx.doc.sections.filter((s) => s.enabled);
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
