import type { ReactNode } from 'react';

export interface NoteRow {
  label: string;
  value: ReactNode;
}

export interface NoteLink {
  href: string;
  label: string;
}

/**
 * A short collection notice (Privacy Protection Law s.11) with the long form one disclosure away: two or
 * three lines that are always visible, the rows (voluntary or not, who is responsible, why, who sees it,
 * the rights) inside a native <details> — keyboard operable, no script — and the links to the policy.
 * A notice, not a consent: nothing here is ticked and nothing blocks the form. The links open in a new
 * tab, so the form being filled in is not lost; `newTab` is the screen-reader text for that.
 *
 * Plain markup, no hooks, no host-app imports: the public contact page renders it on the server, the host
 * app's dialogs in the browser.
 */
export function CollectionNote({
  title,
  children,
  more,
  rows = [],
  links = [],
  newTab,
  testId = 'collection-note',
  className = '',
}: {
  /** the notice's accessible name */
  title: string;
  /** the short text */
  children: ReactNode;
  /** the disclosure's label; the disclosure is left out when there are no rows */
  more?: string;
  rows?: NoteRow[];
  links?: NoteLink[];
  newTab: string;
  testId?: string;
  className?: string;
}) {
  const shown = rows.filter((r) => r.value !== '' && r.value !== null && r.value !== undefined);
  return (
    <div
      role="note"
      aria-label={title}
      data-testid={testId}
      className={`rounded-[12px] border border-line bg-subtle/60 px-3 py-2.5 text-[12.5px] leading-[1.55] text-muted ${className}`}
    >
      <p className="text-pretty">{children}</p>
      {shown.length && more ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer rounded-[4px] font-semibold text-ink">{more}</summary>
          <dl className="mt-1.5 flex flex-col gap-1.5">
            {shown.map((r) => (
              <div key={r.label}>
                <dt className="font-semibold text-ink">{r.label}</dt>
                <dd className="[overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {links.length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {links.map((l) => (
            <NoteAnchor key={l.href} {...l} newTab={newTab} />
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** A link in a notice: opens in a new tab and says so to screen readers. */
export function NoteAnchor({ href, label, newTab }: NoteLink & { newTab: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="rounded-[4px] font-semibold text-ink underline underline-offset-2"
    >
      {label}
      <span className="sr-only"> {newTab}</span>
    </a>
  );
}
