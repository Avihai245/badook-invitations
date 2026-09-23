import type { SectionOf } from '../../contracts/types';
import { isHttpsUrl } from '../../lib/urls';
import { Icon } from '../../ui/Icon';
import { editPath, type SectionViewProps } from '../shared';
import { CopyButton } from './CopyButton.client';

export function GiftsView({ section, ctx }: SectionViewProps<SectionOf<'gifts'>>) {
  const d = section.data;
  const path = editPath(ctx, section, 'data');
  // A way to give needs its name and either a link (a button) or details (bank transfer); a half-filled
  // one is left out, and without any the section itself is (no card of "you can also give here:").
  const links = d.links
    .map((link, i) => ({ link, i, label: ctx.text(link.label), details: ctx.text(link.details) }))
    .filter(({ link, label, details }) => label && (isHttpsUrl(link.url) || (!link.url && details)));
  if (!links.length) return null;
  const body = ctx.text(d.body);
  return (
    <section className="sec" data-edit-path={editPath(ctx, section)}>
      <div className="wrap">
        <div className="card reveal">
          <span className="badge" aria-hidden="true">
            <Icon name="gift" size={22} />
          </span>
          <h2 className="sec-title" data-edit-path={path && `${path}.title`}>
            {ctx.text(d.title)}
          </h2>
          {body ? (
            <p className="sec-body" data-edit-path={path && `${path}.body`}>
              {body}
            </p>
          ) : null}
          <div className="stack">
            {links.map(({ link, i, label, details }) =>
              link.url ? (
                <a
                  key={link.id}
                  className="btn btn-outline"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-edit-path={path && `${path}.links.${i}`}
                >
                  {label}
                </a>
              ) : (
                <div key={link.id} className="details" data-edit-path={path && `${path}.links.${i}`}>
                  <strong>{label}</strong>
                  <div>{details}</div>
                  <CopyButton text={details} label={ctx.t('gifts.copy')} done={ctx.t('gifts.copied')} />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
