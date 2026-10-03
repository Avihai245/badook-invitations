'use client';

import { ArrowLeft, ClipboardList, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardTitle } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { percentOf } from '../model/budget';
import { systemText } from '../model/system-text';
import { SYSTEM_HREF } from '../model/system-tasks';
import { taskTitle } from '../model/task-text';
import type { PlanningCardData } from '../server/overview-card';
import { Money } from './Money';

/**
 * On the invitation's overview, under "what to do now": the planning's next step (when the host's plan
 * follows the overview) with the week's count and a thin budget line — or, before a plan exists, a
 * gentle way in. One action, and it goes to the plan.
 */
export function PlanningCard({ id, data }: { id: string; data: PlanningCardData }) {
  const { t, plural, number, locale } = useUi();
  const P = t.planning;
  const base = `/app/invitations/${id}/plan`;
  if (data.state === 'invite') {
    return (
      <Card padding="lg" className="flex flex-wrap items-center gap-4" data-plan-card="invite">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand-deep"
        >
          <ClipboardList className="size-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 basis-[260px]">
          <CardTitle as="h3">{P.title}</CardTitle>
          <p className="mt-0.5 text-[13.5px] text-muted">{P.subtitle}</p>
        </div>
        <Button asChild className="max-sm:w-full">
          <Link href={base}>{P.onboarding.finish}</Link>
        </Button>
      </Card>
    );
  }
  const task = data.next;
  const title = task
    ? (taskTitle(task, { templateKey: data.templateKey }, locale) ??
      (task.systemKey ? systemText(t, task.systemKey, data.confirmed).title : ''))
    : '';
  const href = task?.systemKey ? SYSTEM_HREF[task.systemKey] : null;
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-plan-card="overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle as="h3">{P.overview.next.title}</CardTitle>
        <span className="text-[12.5px] font-semibold text-muted">
          {plural(P.tabWeek, data.week, { n: number(data.week) })}
        </span>
      </div>
      <p className="text-[16px] leading-snug font-bold">
        <bdi>{task ? title : P.overview.next.allDone}</bdi>
      </p>
      {data.budget ? (
        <div>
          <p className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Wallet aria-hidden className="size-3.5" />
              {P.overview.budget.committed}: <Money value={data.budget.committed} />
            </span>
            <span>
              {P.overview.budget.paid}: <Money value={data.budget.paid} />
            </span>
          </p>
          <div aria-hidden className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-subtle">
            <span
              className="bg-success"
              style={{
                width: `${percentOf(data.budget.paid, Math.max(data.budget.total, data.budget.committed))}%`,
              }}
            />
            <span
              className="bg-brand"
              style={{
                width: `${Math.max(0, percentOf(data.budget.committed, Math.max(data.budget.total, data.budget.committed)) - percentOf(data.budget.paid, Math.max(data.budget.total, data.budget.committed)))}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1">
        {href ? (
          <Button icon={<ArrowLeft className="icon-dir" />} asChild>
            <Link href={`/app/invitations/${id}${href}`}>{P.overview.next.doIt}</Link>
          </Button>
        ) : null}
        <Button variant={href ? 'secondary' : 'primary'} asChild>
          <Link href={base}>{P.nav.overview}</Link>
        </Button>
      </div>
    </Card>
  );
}
