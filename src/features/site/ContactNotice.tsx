import { CollectionNote, NoteAnchor } from '@/features/legal/notices/CollectionNote';
import type { LegalContext } from '@/features/legal/types';
import { PRIVACY_REQUEST_PATH } from '@/features/legal/versions';
import { fmt } from '@/lib/i18n/app';
import type { AppDict } from '@/lib/i18n/app';

/**
 * The notice above the contact form's button (Privacy Protection Law s.11), once the legal documents'
 * version 2 is in force: that giving the details is voluntary and what follows if one doesn't, who is
 * responsible for them (only the operator's details that are filled in), why, who sees them, and the
 * way to use the rights — the privacy request form — with the policy's section on support one link away.
 * A server component: the form (a client component) receives it as `notice`.
 */
export function ContactNotice({
  t,
  operator,
}: {
  t: Pick<AppDict, 'collectionNotes' | 'legalRequests'>;
  operator: LegalContext['operator'];
}) {
  const n = t.collectionNotes;
  const c = n.contact;
  const f = t.legalRequests.notice.controllerFields;
  const controller = [
    operator.name && fmt(f.name, { name: operator.name }),
    operator.id && fmt(f.id, { id: operator.id }),
    operator.address && fmt(f.address, { address: operator.address }),
    operator.phone && fmt(f.phone, { phone: operator.phone }),
    operator.email && fmt(f.email, { email: operator.email }),
  ].filter((v): v is string => !!v);
  return (
    <CollectionNote
      title={c.title}
      more={n.more}
      newTab={n.newTab}
      testId="contact-notice"
      rows={[
        { label: n.rows.voluntary, value: c.voluntary },
        { label: n.rows.controller, value: controller.join(' · ') },
        { label: n.rows.purpose, value: c.purpose },
        { label: n.rows.recipients, value: c.recipients },
        {
          label: n.rows.rights,
          value: (
            <>
              {c.rights} <NoteAnchor href={PRIVACY_REQUEST_PATH} label={c.rightsLink} newTab={n.newTab} />
            </>
          ),
        },
      ]}
      links={[{ href: '/privacy#support', label: c.link }]}
    >
      {c.short}
    </CollectionNote>
  );
}
