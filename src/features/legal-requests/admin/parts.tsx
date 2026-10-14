'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/app';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import type { LegalEvent } from '../types';
import type { AdminStrings } from './shared';

/** A labelled fact of the detail panel. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-[14px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Text a person typed: its own direction, line breaks kept. */
export function Typed({ children }: { children: string }) {
  return (
    <p
      dir="auto"
      className="rounded-[10px] bg-subtle px-3 py-2 text-[14px] whitespace-pre-line [overflow-wrap:anywhere]"
    >
      {children}
    </p>
  );
}

export type NoticeState = { kind: 'sent'; at: string } | { kind: 'notSent' } | { kind: 'text'; text: string };

/** The delivery state of the notices: sent, or NOT sent (shown unmistakably, so staff can follow up by hand). */
export function Notices({ s, rows }: { s: AdminStrings; rows: { label: string; state: NoticeState }[] }) {
  const { fmt, relative } = useAdminUi();
  return (
    <Card padding="md" asChild>
      <section aria-labelledby="notices-title" data-testid="notices">
        <h3 id="notices-title" className="text-[14px] font-bold">
          {s.notices.title}
        </h3>
        <p className="mt-0.5 text-[12px] text-muted">{s.notices.help}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {rows.map(({ label, state }) => (
            <li key={label} className="flex flex-wrap items-center gap-x-2 text-[14px]">
              <span className="font-medium">{label}:</span>
              {state.kind === 'sent' ? (
                <span className="inline-flex items-center gap-1 text-success" data-state="sent">
                  <CheckCircle2 aria-hidden className="size-4" />
                  {fmt(s.notices.sent, { when: relative(state.at) })}
                </span>
              ) : state.kind === 'notSent' ? (
                <span className="inline-flex items-center gap-1 font-bold text-danger" data-state="not-sent">
                  <AlertTriangle aria-hidden className="size-4" />
                  {s.notices.notSentFollowUp}
                </span>
              ) : (
                <span className="text-muted">{state.text}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

/** What happened, oldest first. */
export function Timeline({ s, events }: { s: AdminStrings; events: LegalEvent[] | undefined }) {
  const { dateTime } = useAdminUi();
  const labels = s.events as Record<string, unknown>;
  return (
    <Card padding="md" asChild>
      <section aria-labelledby="timeline-title">
        <h3 id="timeline-title" className="text-[14px] font-bold">
          {s.detail.timeline}
        </h3>
        {events?.length ? (
          <ol className="mt-2 flex flex-col gap-2 text-[13px]" data-testid="timeline">
            {events.map((e, i) => {
              const label = typeof labels[e.action] === 'string' ? (labels[e.action] as string) : e.action;
              const sent = typeof e.detail.sent === 'boolean' ? e.detail.sent : null;
              return (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <time dateTime={e.at} className="text-muted tabular-nums">
                    {dateTime(e.at)}
                  </time>
                  <span className="text-muted">{s.events.actor[e.actor]}</span>
                  <span className="font-medium">{label}</span>
                  {sent !== null ? (
                    <span className={sent ? 'text-success' : 'font-bold text-danger'}>
                      {sent ? s.events.sent : s.events.notSent}
                    </span>
                  ) : null}
                  {typeof e.detail.note === 'string' ? (
                    <span className="w-full">
                      <span className="text-muted">{s.detail.staffNote}: </span>
                      <span dir="auto" className="whitespace-pre-line [overflow-wrap:anywhere]">
                        {e.detail.note}
                      </span>
                    </span>
                  ) : e.detail.hasNote === true ? (
                    <span className="text-muted">({s.events.withNote})</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-[13px] text-muted">{s.detail.noEvents}</p>
        )}
      </section>
    </Card>
  );
}
