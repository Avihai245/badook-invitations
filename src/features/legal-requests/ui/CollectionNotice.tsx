import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmt } from '@/lib/i18n/app';
import type { AppDict } from '@/lib/i18n/app';
import type { LegalContext } from '@/features/legal/types';
import { PRIVACY_REQUEST_PATH } from '@/features/legal/versions';

type Notice = AppDict['legalRequests']['notice'];

/**
 * The notice above the submit button (Privacy Protection Law s.11), short, with the full text one link
 * away: that giving the details is voluntary and what follows if one doesn't, who is responsible for
 * them (only the operator's details that are filled in), why they are collected, who sees them and the
 * person's rights. A server component: the form (a client component) receives it as `notice`.
 */
export function CollectionNotice({
  kind,
  t,
  operator,
}: {
  kind: 'report' | 'request';
  t: Notice;
  operator: LegalContext['operator'];
}) {
  const k = t[kind];
  const controller = [
    operator.name && fmt(t.controllerFields.name, { name: operator.name }),
    operator.id && fmt(t.controllerFields.id, { id: operator.id }),
    operator.address && fmt(t.controllerFields.address, { address: operator.address }),
    operator.phone && fmt(t.controllerFields.phone, { phone: operator.phone }),
    operator.email && fmt(t.controllerFields.email, { email: operator.email }),
  ].filter((v): v is string => !!v);
  const rows: [string, ReactNode][] = [
    [t.voluntary, k.voluntary],
    [t.controller, controller.join(' · ')],
    [t.purpose, k.purpose],
    [t.recipients, k.recipients],
    [
      t.rights,
      <>
        {k.rights}{' '}
        {kind === 'report' ? (
          <Link href={PRIVACY_REQUEST_PATH} className="font-medium underline underline-offset-2">
            {t.rightsLink}
          </Link>
        ) : null}
      </>,
    ],
  ];
  return (
    <section
      aria-labelledby="collection-notice"
      className="rounded-[14px] border border-line bg-subtle/60 p-4 text-[13px] leading-relaxed"
      data-testid="collection-notice"
    >
      <h2 id="collection-notice" className="text-[14px] font-bold">
        {t.title}
      </h2>
      <dl className="mt-2 flex flex-col gap-2">
        {rows
          .filter(([, v]) => v !== '')
          .map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold">{label}</dt>
              <dd className="text-muted [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-3">
        <Link href="/privacy" className="font-medium underline underline-offset-2">
          {t.more}
        </Link>
      </p>
    </section>
  );
}
