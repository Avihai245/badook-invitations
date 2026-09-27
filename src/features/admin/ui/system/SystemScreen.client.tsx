'use client';

import { CheckCircle2, CircleMinus, KeyRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Hint } from '@/components/app';
import type { MessageKind, SystemState } from '../../server/core-db';
import type { Deployment } from '../../server/system';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { ActionDialog } from '../core/ActionDialog.client';
import { adminCall } from '../core/post';
import { ScrollArea } from '../core/ScrollArea.client';
import { TimeAgo } from '../core/TimeAgo.client';

const KINDS: readonly MessageKind[] = ['invitation', 'table', 'gallery'];
/** How long a job may run before another server takes it again (features/jobs: runJob's lease). */
const LEASE_MS = { daily: 15 * 60_000, whatsapp: 120_000 } as const;

function Section({
  title,
  intro,
  children,
  testId,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Card padding="md" className="min-w-0" data-testid={testId}>
      <h2 className="text-[15px] font-bold">{title}</h2>
      {intro ? <p className="mb-2 text-[12.5px] text-muted">{intro}</p> : null}
      {children}
    </Card>
  );
}

/** Set up, or not — a mark and a word (never the value). */
function YesNo({ on }: { on: boolean }) {
  const { t } = useAdminUi();
  return on ? (
    <span className="inline-flex items-center gap-1.5 text-success">
      <CheckCircle2 aria-hidden className="size-4" />
      <span className="text-[13px] font-medium">{t.system.services.on}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <CircleMinus aria-hidden className="size-4" />
      <span className="text-[13px]">{t.system.services.off}</span>
    </span>
  );
}

/**
 * The system now: the recurring jobs (when each last finished, whether one is running), the WhatsApp
 * queues of the three kinds, the connected services (yes or no), the WhatsApp templates' languages,
 * the designs' version in the database against the code's, the running build, and the console's live
 * channel with "a new name" for owners.
 */
export function SystemScreen({ state, deployment: dep }: { state: SystemState; deployment: Deployment }) {
  const { t, fmt, number, dateTime, can } = useAdminUi();
  const S = t.system;
  const [renaming, setRenaming] = useState(false);
  const now = Date.parse(state.now);

  const job = (name: 'daily' | 'whatsapp') => {
    const row = state.jobs[name];
    const finished = row && row.finished !== '-infinity' ? row.finished : null;
    const taken = row?.taken ?? null;
    const runningSince = taken && (!finished || Date.parse(taken) > Date.parse(finished)) ? taken : null;
    const stuck = runningSince ? now - Date.parse(runningSince) > LEASE_MS[name] : false;
    return (
      <div className="border-b border-line py-3 last:border-b-0" data-testid={`admin-job-${name}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold">{S.jobs[name]}</h3>
          {runningSince ? (
            <Badge variant={stuck ? 'warning' : 'info'}>
              {stuck ? S.jobs.stuckShort : S.jobs.runningShort}
            </Badge>
          ) : (
            <Badge variant="neutral">{S.jobs.idle}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {name === 'daily' ? S.jobs.dailyHelp : S.jobs.whatsappHelp}
        </p>
        <p className="mt-1.5 text-[13px]">
          {S.jobs.lastRun}:{' '}
          {finished ? (
            <>
              <TimeAgo at={finished} /> <span className="text-muted">({dateTime(finished)})</span>
            </>
          ) : (
            <span className="text-muted">{S.jobs.never}</span>
          )}
        </p>
        {runningSince ? (
          <p className="text-[12.5px] text-muted">
            {fmt(stuck ? S.jobs.stuck : S.jobs.running, { when: dateTime(runningSince) })}
          </p>
        ) : null}
        {name === 'daily' ? (
          <p className="text-[12.5px] text-muted">{fmt(S.jobs.next, { when: dateTime(dep.dailyNext) })}</p>
        ) : null}
      </div>
    );
  };

  const services: [string, boolean][] = [
    [S.services.names.supabase, dep.services.supabase],
    [S.services.names.whatsapp, dep.services.whatsapp],
    [S.services.names.whatsappWebhook, dep.services.whatsappWebhook],
    [S.services.names.templateInvitation, dep.services.templates.invitation],
    [S.services.names.templateTable, dep.services.templates.table],
    [S.services.names.templateGallery, dep.services.templates.gallery],
    [S.services.names.payplus, dep.services.payplus],
    [S.services.names.email, dep.services.email],
    [S.services.names.supportEmail, dep.services.supportEmail],
    [S.services.names.ai, dep.services.ai],
    [S.services.names.tts, dep.services.tts],
    [S.services.names.partnerApi, dep.services.partnerApi],
    [S.services.names.faceAlbums, dep.services.faceAlbums],
    [S.services.names.cronSecret, dep.services.cronSecret],
    [S.services.names.jobsFallback, dep.services.jobsFallback],
  ];
  const seedDb = state.seedVersion?.value ?? null;

  return (
    <>
      <AdminPageHeader title={S.title} intro={S.intro} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={S.jobs.title} intro={S.jobs.intro} testId="admin-system-jobs">
          {job('daily')}
          {job('whatsapp')}
        </Section>

        <Section title={S.queues.title} intro={S.queues.intro} testId="admin-system-queues">
          <ScrollArea label={S.queues.title} className="-mx-[18px]">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">{S.queues.title}</caption>
              <thead>
                <tr>
                  {[S.queues.kind, S.queues.queued, S.queues.sending, S.queues.failed, S.queues.oldest].map(
                    (h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`border-b border-line bg-canvas px-3 py-2.5 font-semibold whitespace-nowrap text-muted ${i === 0 ? 'text-start' : 'text-center'}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {KINDS.map((k) => {
                  const q = state.queues[k];
                  return (
                    <tr key={k} data-kind={k}>
                      <th
                        scope="row"
                        className="border-b border-line px-3 py-2.5 text-start font-medium whitespace-nowrap"
                      >
                        {S.queues.kinds[k]}
                      </th>
                      <td className="border-b border-line px-3 py-2.5 text-center tabular-nums">
                        {number(q.queued)}
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-center tabular-nums">
                        {number(q.sending)}
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-center tabular-nums">
                        {number(q.failed24h)}
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-center whitespace-nowrap">
                        {q.oldest ? <TimeAgo at={q.oldest} /> : S.queues.none}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </Section>

        <Section title={S.services.title} intro={S.services.intro} testId="admin-system-services">
          <ul className="divide-y divide-line">
            {services.map(([name, on]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-[13.5px]">{name}</span>
                <YesNo on={on} />
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-[13.5px]">{S.services.billing}</span>
              <span className="text-[13px] font-medium">{S.services.billingModes[dep.services.billing]}</span>
            </li>
            <li className="py-2">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13.5px]">{S.services.langs}</span>
                <span dir="ltr" className="text-[13px] font-medium" data-testid="admin-system-langs">
                  {dep.templateLangs.join(', ')}
                </span>
              </span>
              <span className="block text-[12px] text-muted">{S.services.langsHelp}</span>
            </li>
          </ul>
        </Section>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title={S.seed.title} intro={S.seed.intro} testId="admin-system-seed">
            <dl className="text-[13px]">
              <div className="flex flex-wrap justify-between gap-2 py-1.5">
                <dt className="text-muted">{S.seed.db}</dt>
                <dd dir="ltr" className="font-mono text-[12px]">
                  {seedDb ? seedDb.slice(0, 12) : S.seed.missing}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 py-1.5">
                <dt className="text-muted">{S.seed.code}</dt>
                <dd dir="ltr" className="font-mono text-[12px]">
                  {dep.seedVersion.slice(0, 12)}
                </dd>
              </div>
            </dl>
            <p className="mt-1">
              <Badge variant={seedDb === dep.seedVersion ? 'live' : 'warning'}>
                {seedDb === dep.seedVersion ? S.seed.same : S.seed.differs}
              </Badge>
              {state.seedVersion ? (
                <span className="ms-2 text-[12px] text-muted">
                  {fmt(S.seed.updated, { when: '' })}
                  <TimeAgo at={state.seedVersion.updatedAt} />
                </span>
              ) : null}
            </p>
          </Section>

          <Section title={S.build.title} testId="admin-system-build">
            <dl className="text-[13px]">
              <div className="flex flex-wrap justify-between gap-2 py-1.5">
                <dt className="text-muted">{S.build.commit}</dt>
                <dd dir="ltr" className="font-mono text-[12.5px]" data-testid="admin-system-commit">
                  {dep.build.commit === 'local' ? S.build.local : dep.build.commit}
                </dd>
              </div>
              {dep.build.builtAt ? (
                <div className="flex flex-wrap justify-between gap-2 py-1.5">
                  <dt className="text-muted">{S.build.builtAt}</dt>
                  <dd>{dateTime(dep.build.builtAt)}</dd>
                </div>
              ) : null}
            </dl>
          </Section>

          <Section title={S.channel.title} intro={S.channel.intro} testId="admin-system-channel">
            <p className="text-[13px]">
              {state.channel ? (
                <>
                  {fmt(S.channel.namedAt, { when: '' })}
                  <TimeAgo at={state.channel.namedAt} />
                </>
              ) : (
                S.channel.notYet
              )}
            </p>
            <div className="mt-3">
              <Hint
                text={S.channel.renameHelp}
                disabledText={can('staff.owners') ? null : S.channel.renameOwners}
              >
                <Button
                  variant="secondary"
                  icon={<KeyRound />}
                  disabled={!can('staff.owners')}
                  onClick={() => setRenaming(true)}
                  data-testid="admin-system-rename"
                >
                  {S.channel.rename}
                </Button>
              </Hint>
            </div>
          </Section>
        </div>
      </div>

      <ActionDialog
        open={renaming}
        onOpenChange={setRenaming}
        testId="admin-rename-dialog"
        title={S.channel.dialogTitle}
        description={S.channel.dialogBody}
        reason={false}
        confirmLabel={S.channel.confirm}
        confirmHelp={S.channel.confirmHelp}
        success={S.channel.done}
        onConfirm={() => adminCall('/api/admin/system/channel', {})}
      />
    </>
  );
}
