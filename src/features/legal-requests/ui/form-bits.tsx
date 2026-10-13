'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** The error summary above a form: announced when it appears; each entry takes you to its field. */
export function ErrorSummary({
  title,
  errors,
  labels,
  focusField,
}: {
  title: string;
  errors: Record<string, string>;
  labels: Record<string, string>;
  focusField: (name: string) => void;
}) {
  const names = Object.keys(errors).filter((n) => n !== 'form');
  if (!names.length && !errors.form) return null;
  return (
    <div
      role="alert"
      className="rounded-card border border-danger/30 bg-danger-bg px-4 py-3 text-[14px] text-danger"
      data-testid="form-errors"
    >
      {names.length ? (
        <>
          <p className="font-semibold">{title}</p>
          <ul className="mt-1 list-disc ps-5">
            {names.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => focusField(n)}
                  className="text-start underline underline-offset-2"
                >
                  {labels[n] ? `${labels[n]}: ` : ''}
                  {errors[n]}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {errors.form ? <p className={names.length ? 'mt-2' : ''}>{errors.form}</p> : null}
    </div>
  );
}

/** A field people don't see: bots fill it in, and the submission is then dropped. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/** The result of a submission: a heading that takes the focus, inside a polite live region. */
export function Result({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div aria-live="polite" className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-6">
      <h2 ref={heading} tabIndex={-1} className="text-[20px] font-bold outline-hidden">
        {title}
      </h2>
      {children}
    </div>
  );
}

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const phoneOk = (v: string) => /^[+\d\s().-]{5,30}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 5;
