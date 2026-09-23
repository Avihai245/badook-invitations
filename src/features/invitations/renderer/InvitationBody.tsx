import { Fragment, type ComponentType } from 'react';
import type { Locale } from '../contracts/types';
import { SECTIONS } from '../sections/registry';
import { Decoration, type SectionViewProps } from '../sections/shared';
import type { RenderContext } from './context';
import { CoverOverlay } from './cover/CoverOverlay.client';
import { FitNames } from './FitNames.client';
import { FloatingControls } from './FloatingControls.client';
import { RevealObserver } from './RevealObserver.client';

/**
 * The single renderer body used by the public page, the preview link, the editor preview frame and
 * the kitchen sink (§5 — the same renderer everywhere). Section order = document order.
 */
export function InvitationBody({
  ctx,
  showCover,
  langSwitchHref,
}: {
  ctx: RenderContext;
  /** false with `?open=1`, in the editor/preview frame and for OG screenshots */
  showCover: boolean;
  /** URL of the same invitation in the next locale (null when there is only one locale) */
  langSwitchHref: string | null;
}) {
  const { doc, template } = ctx;
  const enabled = doc.sections.filter((s) => s.enabled);
  const coverOn = showCover && doc.cover.enabled && ctx.mode === 'live';
  const nextLocale = doc.locales[(doc.locales.indexOf(ctx.locale) + 1) % doc.locales.length] as Locale;

  return (
    <div className="inv" data-mode={ctx.mode}>
      {coverOn ? (
        <>
          <script dangerouslySetInnerHTML={{ __html: "document.body.classList.add('locked')" }} />
          <CoverOverlay
            locale={ctx.locale}
            style={template.cover.style}
            overlay={{
              kind: template.cover.overlay.kind,
              exit: template.cover.overlay.exit,
              textColor: template.cover.overlay.text.color,
            }}
            monogram={ctx.text(doc.cover.monogram)}
            hint={ctx.text(doc.cover.hint) || ctx.t('cover.hint')}
            skipLabel={ctx.t('cover.skip')}
          />
        </>
      ) : (
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.opened='1'" }} />
      )}
      <FloatingControls
        langSwitch={
          doc.locales.length > 1 && langSwitchHref
            ? { href: langSwitchHref, label: ctx.t('locale.switch'), targetLocale: nextLocale }
            : null
        }
        music={
          doc.music.enabled ? { playLabel: ctx.t('music.play'), pauseLabel: ctx.t('music.pause') } : null
        }
      />
      <main>
        {enabled.map((section, k) => {
          const View = SECTIONS[section.type].view as ComponentType<SectionViewProps>;
          return (
            <Fragment key={section.id}>
              <View section={section} prev={enabled[k - 1]} ctx={ctx} />
              {section.type === 'hero' ? <Decoration slot="afterHero" ctx={ctx} /> : null}
            </Fragment>
          );
        })}
      </main>
      <RevealObserver />
      <FitNames />
    </div>
  );
}
