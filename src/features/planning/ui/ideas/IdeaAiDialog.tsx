'use client';

import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Dialog, Skeleton, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { isCategoryKey } from '../../model/categories';
import type { PlanIdea } from '../../model/plan';
import { usePlan } from '../PlanProvider';
import { readApi } from './api';

interface Step {
  title: string;
  category: string | null;
}

type State =
  | { status: 'working' }
  | { status: 'ready'; summary: string; steps: Step[] }
  | { status: 'error'; code: string };

/**
 * "Summarize and suggest steps" for one card (the assistant, a Pro tool): a one-line summary and a few
 * steps to tick, which become tasks. Nothing is saved by asking; on the free plan the same dialog is a
 * soft lock with the way to Pro. The answer is read like a preview (it is not a change of the plan),
 * the tasks the host chooses are saved like any other task.
 */
export function IdeaAiDialog({ idea, onClose }: { idea: PlanIdea; onClose(): void }) {
  const { t, fmt, plural, number, locale } = useUi();
  const T = t.planning.ideas.ai;
  const plan = usePlan();
  const { toast } = useToast();
  const enabled = plan.view.features.ai;
  const hasText = !!(idea.title || idea.body || idea.url || idea.items.length > 0);
  const [state, setState] = useState<State>({ status: 'working' });
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addFailed, setAddFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !hasText) return;
    let current = true;
    setState({ status: 'working' });
    void readApi<{ summary?: string; steps?: Step[]; code?: string }>(plan.id, '/ai', {
      kind: 'idea',
      ideaId: idea.id,
      locale,
    }).then((res) => {
      if (!current) return;
      const steps = res.body?.steps;
      if (res.ok && typeof res.body?.summary === 'string' && Array.isArray(steps)) {
        setState({ status: 'ready', summary: res.body.summary, steps });
        setPicked(new Set(steps.map((_, i) => i)));
      } else setState({ status: 'error', code: res.body?.code ?? 'ai_failed' });
    });
    return () => {
      current = false;
    };
  }, [enabled, hasText, idea.id, locale, plan.id, attempt]);

  const toggle = (i: number, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });

  const addTasks = async () => {
    if (state.status !== 'ready') return;
    const chosen = state.steps.filter((_, i) => picked.has(i));
    if (chosen.length === 0) return;
    setAdding(true);
    setAddFailed(false);
    let made = 0;
    for (const step of chosen) {
      const res = await plan.call('/tasks', {
        op: 'save',
        task: {
          title: step.title,
          ...(step.category && isCategoryKey(step.category) ? { category: step.category } : {}),
        },
      });
      if (!res.ok) break;
      made += 1;
    }
    setAdding(false);
    if (made > 0) {
      void plan.refresh();
      toast({
        variant: 'success',
        title: plural(T.added, made, { n: number(made) }),
      });
    }
    if (made === chosen.length) onClose();
    else setAddFailed(true);
  };

  const message = !hasText
    ? T.empty
    : state.status === 'error'
      ? state.code === 'ai_unavailable'
        ? T.unavailable
        : state.code === 'rate_limited'
          ? T.limit
          : T.failed
      : null;
  const retryable = hasText && state.status === 'error' && state.code === 'ai_failed';
  const count = picked.size;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={T.title}
      description={enabled ? T.body : undefined}
      closeLabel={t.planning.common.close}
      footer={
        enabled && state.status === 'ready' && state.steps.length > 0 ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.planning.common.cancel}
            </Button>
            <Button loading={adding} disabled={count === 0} onClick={() => void addTasks()}>
              {plural(T.add, count, { n: number(count) })}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {t.planning.common.close}
          </Button>
        )
      }
    >
      {!enabled ? (
        <Card tone="info" padding="sm" className="flex flex-wrap items-center gap-3" data-testid="ai-locked">
          <Lock aria-hidden className="size-4 shrink-0 text-info" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-[200px]">
            <p className="text-[13.5px] font-semibold text-info">{T.locked.title}</p>
            <p className="text-[12.5px] text-ink/80">{T.locked.body}</p>
          </div>
          <Button asChild variant="secondary" className="min-h-11">
            <Link href="/app/billing?plan=pro">{fmt(t.planning.common.upgrade, { plan: 'Pro' })}</Link>
          </Button>
        </Card>
      ) : message ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-[14px] text-ink/80">{message}</p>
          {retryable ? (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {T.retry}
            </Button>
          ) : null}
        </div>
      ) : state.status === 'working' ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <p className="inline-flex items-center gap-2 text-[14px] text-muted">
            <Sparkles aria-hidden className="size-4 text-brand" />
            {T.working}
          </p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state.status === 'ready' ? (
        <div className="flex flex-col gap-4" data-testid="ai-result">
          <section aria-labelledby="idea-ai-summary">
            <h3 id="idea-ai-summary" className="mb-1 text-[13px] font-semibold text-muted">
              {T.summary}
            </h3>
            <p className="text-[15px] leading-relaxed">{state.summary}</p>
          </section>
          {state.steps.length > 0 ? (
            <fieldset className="min-w-0">
              <legend className="text-[13px] font-semibold text-muted">{T.steps}</legend>
              <p className="mb-2 text-[12.5px] text-muted">{T.stepsHint}</p>
              <ul className="flex flex-col gap-2">
                {state.steps.map((step, i) => (
                  <li key={i} className="rounded-input border border-line bg-surface px-3 py-2.5">
                    <Checkbox
                      checked={picked.has(i)}
                      onCheckedChange={(v) => toggle(i, v)}
                      label={step.title}
                    />
                    {step.category && isCategoryKey(step.category) ? (
                      <p className="ps-7 text-[12px] text-muted">{t.planning.categories[step.category]}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {addFailed ? (
                <p role="alert" className="mt-2 text-[13px] text-danger">
                  {T.addFailed}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-[14px] text-muted">{T.noSteps}</p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
