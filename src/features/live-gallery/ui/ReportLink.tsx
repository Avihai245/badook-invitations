import { Flag } from 'lucide-react';

/**
 * "Report" on a photo or video (version 2 of the legal documents): a link to the report form, which
 * opens in a new tab so the viewer, the story and the guest's place in the gallery stay as they were.
 * The accessible name says what is reported ("Report this photo"); the visible word, when shown, is
 * part of it.
 */
export function ReportLink({
  href,
  label,
  text,
  className,
}: {
  href: string;
  /** "Report this photo" */
  label: string;
  /** the short visible word ("Report"); icon only when absent */
  text?: string;
  className: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener" aria-label={label} title={label} className={className}>
      <Flag aria-hidden className="size-[18px]" />
      {text ? <span>{text}</span> : null}
    </a>
  );
}
