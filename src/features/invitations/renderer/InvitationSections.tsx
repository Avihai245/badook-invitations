import { Fragment, type ComponentType } from 'react';
import { FollowUpCard } from '../sections/follow-up/FollowUpCard';
import { Decoration, type SectionViewProps } from '../sections/shared';
import { SECTION_VIEWS } from '../sections/views';
import type { RenderContext } from './context-core';

/**
 * The invitation's sections in document order (§5) — rendered on the server by every page, and in the
 * browser by the live language switch (the other locale) and the editor preview.
 */
export function InvitationSections({ ctx }: { ctx: RenderContext }) {
  const enabled = ctx.doc.sections.filter((s) => s.enabled);
  return (
    <main>
      {enabled.map((section, k) => {
        const View = SECTION_VIEWS[section.type] as ComponentType<SectionViewProps>;
        return (
          <Fragment key={section.id}>
            <View section={section} prev={enabled[k - 1]} ctx={ctx} />
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
