import { Fragment, type ReactNode } from 'react';

const SLOT = '';

/**
 * A sentence with a family's name in it (`say` fills its template with the name it is given), the
 * name kept whole in any script by a <bdi>: a Russian family in a Hebrew sentence, an Arabic one in
 * English, never reordered with the numbers and signs around it. Its text stays the plain sentence —
 * what screen readers announce and what a search finds.
 */
export function withName(say: (name: string) => string, name: string): ReactNode {
  const parts = say(SLOT).split(SLOT);
  if (parts.length === 1) return parts[0];
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? <bdi>{name}</bdi> : null}
      {part}
    </Fragment>
  ));
}
