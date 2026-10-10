'use client';

import { Camera, Check, MessageCircleHeart, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/app/utils';
import { useUi } from '@/lib/i18n/client';

const STEP_ICONS: LucideIcon[] = [Camera, MessageCircleHeart, Sparkles];

/**
 * What the AI photos are, for the hosts, before anything else: three steps (you upload your photos ·
 * guests write what they'd like · AI makes the photo), a few things guests ask for, and who sees what.
 * `compact`: the steps only (the gallery tab's card).
 */
export function AiExplainer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useUi();
  const E = t.aiPhotos.explain;
  return (
    <section
      className={cn(
        'rounded-[18px] border border-brand-line bg-[linear-gradient(140deg,var(--color-brand-soft),var(--color-surface)_70%)]',
        compact ? 'p-3' : 'p-5 sm:p-6',
        className,
      )}
      aria-label={E.title}
      data-testid={compact ? 'ai-explainer-compact' : 'ai-explainer'}
    >
      {!compact ? (
        <div className="mb-4">
          <h2 className="text-[17px] font-bold">{E.title}</h2>
          <p className="mt-1 max-w-[70ch] text-[14px] text-muted">{E.lead}</p>
        </div>
      ) : null}
      <ol className={cn('grid gap-3', compact ? 'sm:grid-cols-3' : 'md:grid-cols-3')}>
        {E.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? Sparkles;
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'relative grid shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_6px_16px_-8px_rgba(160,112,63,0.8)]',
                  compact ? 'size-8' : 'size-11',
                )}
              >
                <Icon className={compact ? 'size-4' : 'size-5'} />
                <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-surface bg-ink text-[10.5px] font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className={cn('block font-bold', compact ? 'text-[13px]' : 'text-[14.5px]')}>
                  {step.title}
                </span>
                {!compact ? <span className="mt-0.5 block text-[13px] text-muted">{step.body}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {!compact ? (
        <>
          <p className="mt-5 mb-2 text-[12.5px] font-semibold text-muted">{E.examples}</p>
          <ul className="flex flex-wrap gap-2">
            {E.samples.map((s) => (
              <li
                key={s}
                className="rounded-[14px] rounded-es-[4px] bg-surface px-3 py-2 text-[13px] shadow-[0_2px_10px_-6px_rgba(28,25,23,0.35)]"
              >
                “{s}”
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-1.5 text-[12.5px] text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {E.privacy}
          </p>
        </>
      ) : null}
    </section>
  );
}

/** Where the setup stands: the photos, the consent, open to guests — each checked when done. */
export function AiProgress({
  people,
  consent,
  enabled,
}: {
  people: boolean;
  consent: boolean;
  enabled: boolean;
}) {
  const { t } = useUi();
  const P = t.aiPhotos.progress;
  const steps = [
    { done: people, label: P.people },
    { done: consent, label: P.consent },
    { done: enabled, label: P.enabled },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={P.label} data-testid="ai-progress">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold',
            s.done ? 'border-success-line bg-success-bg text-success' : 'border-line bg-surface text-muted',
          )}
          data-done={s.done ? '' : undefined}
        >
          {s.done ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <span aria-hidden className="tabular-nums">
              {i + 1}
            </span>
          )}
          {s.label}
        </li>
      ))}
    </ol>
  );
}
