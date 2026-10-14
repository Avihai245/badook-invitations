'use client';

import { CollectionNote } from '@/features/legal/notices/CollectionNote';
import { useLegalNotices } from '@/features/legal/notices/flag.client';
import { useUi } from '@/lib/i18n/client';

/**
 * What the host should know about the guests' details they enter or upload (Privacy Protection Law s.11,
 * the legal documents' version 2): the host decides whom to invite and answers for being allowed to, the
 * details are processed on the host's behalf, nothing is used for marketing. Short, with the rest in a
 * disclosure and the policy's section on who is responsible for what. Nothing while version 2 is not in
 * force.
 */
export function GuestsNote({ kind, className }: { kind: 'add' | 'import'; className?: string }) {
  const active = useLegalNotices();
  const { t } = useUi();
  if (!active) return null;
  const n = t.collectionNotes;
  const g = n.guests;
  return (
    <CollectionNote
      title={g.title}
      more={n.more}
      newTab={n.newTab}
      testId="guests-note"
      className={className}
      rows={[
        { label: n.rows.voluntary, value: g[kind].voluntary },
        { label: n.rows.controller, value: g.controller },
        { label: n.rows.purpose, value: g.purpose },
        { label: n.rows.recipients, value: g.recipients },
        { label: n.rows.rights, value: g.rights },
      ]}
      links={[{ href: '/privacy#roles', label: g.link }]}
    >
      {g.short}
    </CollectionNote>
  );
}
