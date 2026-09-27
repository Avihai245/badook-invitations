import { Building2 } from 'lucide-react';
import { fmt, intlLocale, type UiLocale } from '@/lib/i18n/app';
import type { AdminDict } from '../../i18n';
import type { PartnerSource } from '../model';

/**
 * Where an account came from when Badook Events opened it (a user's page in the console): "Opened
 * through Badook Events by Ronit Cohen (manager) · 12 Sep 2026 · Venue Gan Hall", the ids there (the
 * customer's, the opener's, the venue's), whether the user now signs in by themselves, and the calls
 * about the account. Renders on the server (no hooks): the words and the language come in.
 */
export function PartnerSourceCard({
  source,
  t,
  locale,
}: {
  source: PartnerSource;
  t: AdminDict['partners'];
  locale: UiLocale;
}) {
  const S = t.source;
  const when = (iso: string, withTime = false) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone: 'Asia/Jerusalem',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(new Date(iso));
  const o = source.opener;
  const who = o ? (o.name ?? o.id) : null;
  const parts = [
    who ? fmt(S.line, { name: who }) + (o?.role ? ` (${o.role})` : '') : S.lineUnknown,
    when(source.openedAt),
    source.venue ? fmt(S.venue, { name: source.venue.name }) : null,
  ].filter(Boolean);
  const ids = [
    source.externalId ? fmt(S.customerId, { id: source.externalId }) : null,
    o ? fmt(S.openerId, { id: o.id }) : null,
    source.venue ? fmt(S.venueId, { id: source.venue.id }) : null,
  ].filter((v): v is string => !!v);
  return (
    <section
      aria-labelledby="partner-source-title"
      data-testid="partner-source"
      className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id="partner-source-title" className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <Building2 aria-hidden className="size-[18px] text-brand-deep" strokeWidth={1.75} />
        {S.title}
      </h2>
      <p className="mt-2 text-[14px] text-ink" data-testid="partner-source-line">
        {parts.join(' · ')}
        {o?.via === 'venue' ? <span className="text-muted"> ({S.viaVenue})</span> : null}
      </p>
      {o?.email ? (
        <p className="mt-0.5 text-[12.5px] text-muted">
          <bdi dir="ltr">{o.email}</bdi>
        </p>
      ) : null}
      {!o ? <p className="mt-1 text-[13px] text-muted">{S.unknownOpener}</p> : null}
      {ids.length ? (
        <p className="mt-2 text-[12.5px] text-muted" data-testid="partner-source-ids">
          <span className="font-semibold">{S.ids}:</span>{' '}
          {ids.map((id, i) => (
            <span key={id}>
              {i ? ' · ' : ''}
              <bdi>{id}</bdi>
            </span>
          ))}
        </p>
      ) : null}
      {source.userManaged ? <p className="mt-2 text-[12.5px] text-muted">{S.selfManaged}</p> : null}
      {source.provisions.length ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-muted hover:text-ink">{S.history}</summary>
          <ol className="mt-2 flex flex-col gap-1">
            {source.provisions.map((p, i) => (
              <li key={`${p.at}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="text-muted tabular-nums">{when(p.at, true)}</span>
                <span className="font-medium">{S.actions[p.action]}</span>
                {p.by ? (
                  <span>
                    {fmt(S.by, { name: p.by.name ?? p.by.id })}
                    {p.by.role ? ` (${p.by.role})` : ''}
                  </span>
                ) : null}
                {p.venue ? <span className="text-muted">· {fmt(S.venue, { name: p.venue })}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
