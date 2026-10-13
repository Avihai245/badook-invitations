'use client';

import type { ReactNode } from 'react';
import { NoteAnchor } from '@/features/legal/notices/CollectionNote';
import { useLegalNotices } from '@/features/legal/notices/flag.client';
import { useUi } from '@/lib/i18n/client';

/**
 * One line for a planning form that takes a person's or a business's details (Privacy Protection Law
 * s.11, the legal documents' version 2): the host enters them, only the host sees them, and the policy's
 * section on planning has the rest. `undefined` while version 2 is not in force, so a field's `help` (or
 * a conditional paragraph) is left exactly as it was.
 */
export function usePlanningNote(kind: 'vendor' | 'person'): ReactNode | undefined {
  const active = useLegalNotices();
  const { t } = useUi();
  if (!active) return undefined;
  const n = t.collectionNotes;
  return (
    <span data-testid="planning-note">
      {n.planning[kind]} <NoteAnchor href="/privacy#planning" label={n.planning.link} newTab={n.newTab} />
    </span>
  );
}
