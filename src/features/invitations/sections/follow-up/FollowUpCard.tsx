import type { RenderContext } from '../../renderer/context-core';
import { Icon } from '../../ui/Icon';

/**
 * A save-the-date whose full invitation is published: the way there, right after the opening. Not a
 * document section — the page adds it (the host doesn't edit it) and it goes when that invitation
 * is archived.
 */
export function FollowUpCard({ ctx }: { ctx: RenderContext }) {
  if (!ctx.followUp) return null;
  return (
    <>
      <section className="sec fu">
        <div className="wrap">
          <div className="card reveal">
            <span className="badge" aria-hidden="true">
              <Icon name="send" size={22} />
            </span>
            <h2 className="sec-title">{ctx.t('followUp.title')}</h2>
            <p className="sec-body">{ctx.t('followUp.body')}</p>
            <div className="actions">
              <a
                className="btn btn-primary"
                href={ctx.followUp.href}
                hrefLang={ctx.followUp.lang ?? undefined}
              >
                {ctx.t('followUp.cta')}
              </a>
            </div>
          </div>
        </div>
      </section>
      <div className="divider" />
    </>
  );
}
