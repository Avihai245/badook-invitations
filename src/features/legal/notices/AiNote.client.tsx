'use client';

import { useUi } from '@/lib/i18n/client';
import { NoteAnchor } from './CollectionNote';
import { useLegalNotices } from './flag.client';

/**
 * One line next to a host AI feature that sends the host's text or photos to a provider: which provider
 * processes it, with the policy one link away (Privacy Protection Law s.11, the legal documents' version
 * 2; the policy's section 5 lists the providers and what each one gets). Only where the screen said
 * nothing about it. Nothing while version 2 is not in force.
 */
export function AiNote({
  kind,
  provider,
  anchor = 'share',
  className = 'mt-2 text-[12px] text-muted',
}: {
  kind: 'text' | 'photos';
  provider: string;
  /** the policy's section: 'share' (the providers), 'planning' */
  anchor?: string;
  className?: string;
}) {
  const active = useLegalNotices();
  const { t, fmt } = useUi();
  if (!active) return null;
  const n = t.collectionNotes;
  return (
    <p className={className} data-testid="ai-note">
      {fmt(n.ai[kind], { provider })}{' '}
      <NoteAnchor href={`/privacy#${anchor}`} label={n.ai.link} newTab={n.newTab} />
    </p>
  );
}
