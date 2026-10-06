'use client';

import {
  Accessibility,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Lock,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button, Dialog, Hint, IconButton, Segmented, Switch, cn } from '@/components/app';
import { hostApi } from '@/features/invitations/app/api';
import type { AppDict } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_MODES, type SeatingSettings } from '../model';
import type { SolverInput, SolverIssue, SolverProgress, SolverResult } from '../solver';
import type { WordsAnswer } from '../words';

/**
 * Runs the solver in a Web Worker (solver.worker.ts); where there are no workers, on the page itself.
 * Returns a cancel function.
 */
export function runSolver(
  input: SolverInput,
  on: { progress(p: SolverProgress): void; done(r: SolverResult): void; error(): void },
): () => void {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('../solver.worker.ts', import.meta.url));
  } catch {
    worker = null;
  }
  if (!worker) {
    const timer = window.setTimeout(() => {
      void import('../solver')
        .then(({ solve }) => on.done(solve(input, on.progress)))
        .catch(() => on.error());
    }, 30);
    return () => window.clearTimeout(timer);
  }
  worker.onmessage = (e: MessageEvent<{ type: string } & Record<string, unknown>>) => {
    if (e.data.type === 'progress') on.progress(e.data as unknown as SolverProgress);
    else if (e.data.type === 'done') {
      on.done(e.data.result as SolverResult);
      worker?.terminate();
    } else {
      on.error();
      worker?.terminate();
    }
  };
  worker.onerror = () => {
    on.error();
    worker?.terminate();
  };
  worker.postMessage({ input });
  return () => worker?.terminate();
}

/** The options of the automatic seating, and "Seat everyone". */
export function AutoDialog({
  settings,
  lockedTables,
  running,
  progress,
  error,
  onSettings,
  onRun,
  onCancel,
  onClose,
  words,
}: {
  settings: SeatingSettings;
  lockedTables: number;
  running: boolean;
  progress: SolverProgress | null;
  error: string | null;
  onSettings(patch: Partial<SeatingSettings>): void;
  onRun(): void;
  onCancel(): void;
  onClose(): void;
  /** "tell us in words" (WordsPanel), where the AI is there */
  words?: ReactNode;
}) {
  const { t, plural } = useUi();
  const a = t.seating.auto;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !running && onClose()}
      title={a.title}
      description={a.subtitle}
      closeLabel={t.common.close}
      footer={
        running ? (
          <Button variant="secondary" onClick={onCancel}>
            {a.cancel}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {a.close}
            </Button>
            <Button icon={<Sparkles />} onClick={onRun} data-testid="run-auto">
              {a.run}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="auto-dialog">
        {words}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{a.categories}</span>
          <Segmented
            label={a.categories}
            value={settings.categories}
            onValueChange={(categories) => onSettings({ categories })}
            options={CATEGORY_MODES.map((m) => ({ value: m, label: a.modes[m] }))}
            fullWidth
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[13px] font-semibold">
            {a.minFill}
            <span className="tabular-nums text-muted" dir="ltr">
              {Math.round(settings.minFill * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={Math.round(settings.minFill * 100)}
            onChange={(e) => onSettings({ minFill: Number(e.target.value) / 100 })}
            className="w-full accent-ink"
          />
          <span className="text-[12px] text-muted">{a.minFillHint}</span>
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <Switch
            label={a.includePending}
            checked={settings.includePending}
            onCheckedChange={(includePending) => onSettings({ includePending })}
          />
          {a.includePending}
        </label>
        {lockedTables ? (
          <p className="flex items-center gap-2 text-[12.5px] text-muted">
            <Lock aria-hidden className="size-4" />
            {plural(a.lockedTables, lockedTables)}
          </p>
        ) : null}
        {running ? (
          <p role="status" className="text-[13px] font-semibold">
            {a.running}
            {progress ? ` ${Math.round((progress.restart / progress.restarts) * 100)}%` : ''}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

const MAX_NAMES = 4;

/** One thing the arrangement couldn't satisfy, in words. */
export function describeIssue(
  issue: SolverIssue,
  names: ReadonlyMap<string, string>,
  numbers: ReadonlyMap<string, number>,
  a: AppDict['seating']['auto'],
  fmt: (s: string, v: Record<string, string | number>) => string,
  join: (list: string[]) => string,
): string {
  const name = (id: string) => names.get(id) ?? '?';
  const list = (ids: readonly string[]) => {
    const shown = ids.slice(0, MAX_NAMES).map(name);
    if (ids.length > MAX_NAMES) shown.push(fmt(a.issues.more, { n: ids.length - MAX_NAMES }));
    return join(shown);
  };
  const i = a.issues;
  switch (issue.code) {
    case 'unseated':
      return fmt(
        issue.reason === 'accessible' ? i.accessible : issue.reason === 'too_big' ? i.tooBig : i.room,
        {
          name: name(issue.unit),
          seats: issue.seats,
        },
      );
    case 'rule': {
      const kind = issue.hard ? i.hardKind : i.softKind;
      if (issue.kind === 'apart') return fmt(i.apart, { a: name(issue.a), b: name(issue.b), kind });
      if (issue.locked)
        return fmt(i.togetherLocked, {
          a: name(issue.a),
          b: name(issue.b),
          kind,
          table: numbers.get(issue.locked) ?? '?',
        });
      return fmt(i.together, { a: name(issue.a), b: name(issue.b), kind });
    }
    case 'conflict':
      return fmt(i.conflict, { names: list(issue.units) });
    case 'too_big_together':
      return fmt(i.tooBigTogether, { names: list(issue.units), seats: issue.seats });
    case 'mixed':
      return fmt(i.mixed, { table: numbers.get(issue.table) ?? '?', categories: join(issue.categories) });
    case 'unmixed':
      return fmt(i.unmixed, { table: numbers.get(issue.table) ?? '?', category: issue.category });
    case 'lonely':
      return fmt(i.lonely, { table: numbers.get(issue.table) ?? '?', names: list(issue.units) });
    case 'underfilled':
      return fmt(i.underfilled, {
        table: numbers.get(issue.table) ?? '?',
        seated: issue.seated,
        capacity: issue.capacity,
      });
    case 'preference':
      return fmt(issue.near ? i.near : i.far, { zone: i.zones[issue.zone], names: list(issue.units) });
  }
}

/** The order issues are listed in: what matters most first. */
const RANK: Record<SolverIssue['code'], number> = {
  unseated: 0,
  conflict: 1,
  too_big_together: 2,
  rule: 3,
  underfilled: 5,
  preference: 6,
  mixed: 7,
  unmixed: 7,
  lonely: 7,
};

/**
 * The arrangement's result beside the map (not a dialog, so the host can look at the tables and lock
 * the ones they like): its score, what didn't work out in words, "Rearrange" and "Undo".
 */
export function AutoResult({
  result,
  run,
  names,
  numbers,
  rules = 0,
  onRerun,
  onUndo,
  onClose,
  className,
}: {
  result: SolverResult;
  /** the rules between the units that were seated (for "3 of 4 rules kept") */
  rules?: number;
  /** how many arrangements were made so far (a new one is a new result) */
  run: number;
  names: ReadonlyMap<string, string>;
  numbers: ReadonlyMap<string, number>;
  onRerun(): void;
  onUndo(): void;
  onClose(): void;
  className?: string;
}) {
  const { t, fmt, plural, locale } = useUi();
  const a = t.seating.auto;
  const [open, setOpen] = useState(true);
  const join = (list: string[]) =>
    new Intl.ListFormat(locale === 'he' ? 'he' : 'en', { type: 'conjunction' }).format(list);
  const issues = [...result.issues]
    .sort(
      (x, y) =>
        RANK[x.code] -
        RANK[y.code] +
        (x.code === 'rule' && !x.hard ? 0.5 : 0) -
        (y.code === 'rule' && !y.hard ? 0.5 : 0),
    )
    .map((issue) => ({ issue, text: describeIssue(issue, names, numbers, a, fmt, join) }));
  const serious = (i: SolverIssue) =>
    i.code === 'unseated' || i.code === 'conflict' || (i.code === 'rule' && i.hard);
  // in plain words first: families whole (always), the rules kept, who has no seat
  const broken = result.issues.filter((i) => i.code === 'rule').length;
  const kept = Math.max(0, rules - broken);
  const summary = [
    a.summary.families,
    rules
      ? kept === rules
        ? plural(a.summary.allRulesKept, rules)
        : plural(a.summary.rulesKept, kept, { total: rules })
      : null,
    result.unseated ? plural(a.summary.unseated, result.unseated) : null,
  ].filter(Boolean);
  return (
    <section
      aria-label={a.resultTitle}
      data-testid="auto-result"
      data-run={run}
      className={cn(
        'absolute inset-x-2 top-2 z-10 max-h-[60%] overflow-hidden rounded-card border border-line bg-surface shadow-lg sm:inset-x-auto sm:end-3 sm:top-3 sm:w-[360px]',
        className,
      )}
    >
      <div className="flex items-start gap-2 border-b border-line p-3">
        {issues.some((x) => serious(x.issue)) ? (
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        ) : (
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold">{a.resultTitle}</h3>
          <p className="text-[12.5px] text-muted">
            {plural(a.seated, result.seated)} ·{' '}
            <Hint text={a.scoreHint}>
              <span
                className="underline decoration-dotted underline-offset-2"
                data-testid="auto-score"
                tabIndex={0}
              >
                {fmt(a.score, { score: result.score })}
              </span>
            </Hint>
          </p>
        </div>
        <IconButton label={a.close} size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="max-h-[calc(60vh-120px)] overflow-y-auto p-3">
        <p className="mb-2 text-[12.5px] font-semibold" data-testid="auto-summary">
          {summary.join(' · ')}
        </p>
        {issues.length === 0 ? (
          <p className="text-[13px] text-success">{result.score === 0 ? a.perfect : a.nearlyPerfect}</p>
        ) : (
          <>
            <button
              type="button"
              className="mb-1.5 text-[12.5px] font-semibold text-ink/80 underline-offset-2 hover:underline"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {a.issuesTitle} ({issues.length})
            </button>
            {open ? (
              <ul className="flex flex-col gap-1.5" data-testid="auto-issues">
                {issues.map(({ issue, text }, i) => (
                  <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug">
                    <span
                      aria-hidden
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${serious(issue) ? 'bg-danger' : 'bg-faint'}`}
                    />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        <p className="mt-3 flex gap-1.5 text-[12px] text-muted">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {a.lockTip}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-2.5">
        <Hint text={a.rerunHint}>
          <Button size="sm" icon={<RotateCcw className="icon-dir" />} onClick={onRerun} data-testid="rerun">
            {a.rerun}
          </Button>
        </Hint>
        <Button size="sm" variant="ghost" icon={<Undo2 className="icon-dir" />} onClick={onUndo}>
          {a.undo}
        </Button>
      </div>
    </section>
  );
}

/** The automatic seating isn't in this plan's package: what it is and where to get it. */
export function AutoUpgrade({
  packageName,
  planName,
  onClose,
}: {
  packageName: string;
  planName: string;
  onClose(): void;
}) {
  const { t, fmt } = useUi();
  const a = t.seating.auto;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={a.upgradeTitle}
      description={fmt(a.upgradeBody, { package: packageName, plan: planName })}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {a.later}
          </Button>
          <Button icon={<Sparkles />} asChild>
            <Link href="/app/billing" data-testid="upgrade-link">
              {a.upgradeCta}
            </Link>
          </Button>
        </>
      }
    />
  );
}

type WordItem =
  | { key: string; kind: 'rule'; rule: WordsAnswer['rules'][number] }
  | { key: string; kind: 'zone'; zone: WordsAnswer['zones'][number] }
  | { key: string; kind: 'accessible'; unit: string };

/**
 * "Tell us in words who sits with whom": the host's wishes read by the AI (POST …/seating/words) into
 * rules, shown as a list to tick — nothing is added until "Add". What it couldn't match is said back.
 */
export function WordsPanel({
  id,
  names,
  onApply,
}: {
  id: string;
  names: ReadonlyMap<string, string>;
  onApply(answer: Pick<WordsAnswer, 'rules' | 'zones' | 'accessible'>): void;
}) {
  const { t, fmt, plural, locale } = useUi();
  const a = t.seating.auto;
  const W = a.words;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<WordsAnswer | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string | null>(null);
  const join = (list: string[]) =>
    new Intl.ListFormat(locale === 'he' ? 'he' : 'en', { type: 'conjunction' }).format(list);
  const name = (u: string) => names.get(u) ?? '?';

  const items: WordItem[] = answer
    ? [
        ...answer.rules.map((rule, i) => ({ key: `r${i}`, kind: 'rule' as const, rule })),
        ...answer.zones.map((zone, i) => ({ key: `z${i}`, kind: 'zone' as const, zone })),
        ...answer.accessible.map((unit, i) => ({ key: `a${i}`, kind: 'accessible' as const, unit })),
      ]
    : [];

  const read = async () => {
    setBusy(true);
    setError(null);
    setAdded(null);
    const res = await hostApi<{ answer?: WordsAnswer; code?: string }>(
      `/api/invitations/${id}/seating/words`,
      { method: 'POST', body: { text, locale } },
    );
    setBusy(false);
    if (res.ok && res.body?.answer) {
      const next = res.body.answer;
      setAnswer(next);
      setPicked(
        new Set([
          ...next.rules.map((_, i) => `r${i}`),
          ...next.zones.map((_, i) => `z${i}`),
          ...next.accessible.map((_, i) => `a${i}`),
        ]),
      );
      return;
    }
    const code = res.body?.code;
    setAnswer(null);
    setError(
      code === 'not_understood' || code === 'refused'
        ? W.errors.not_understood
        : code === 'rate_limited'
          ? W.errors.rate_limited
          : code === 'no_guests'
            ? W.errors.no_guests
            : W.errors.failed,
    );
  };

  const apply = () => {
    if (!answer) return;
    const chosen = {
      rules: answer.rules.filter((_, i) => picked.has(`r${i}`)),
      zones: answer.zones.filter((_, i) => picked.has(`z${i}`)),
      accessible: answer.accessible.filter((_, i) => picked.has(`a${i}`)),
    };
    onApply(chosen);
    setAdded(plural(W.added, picked.size));
    setAnswer(null);
    setText('');
  };

  const label = (item: WordItem) => {
    if (item.kind === 'rule')
      return (
        <>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11.5px] font-bold',
              item.rule.kind === 'together' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
            )}
          >
            {item.rule.kind === 'together' ? W.together : W.apart}
          </span>
          <bdi className="min-w-0">{join(item.rule.units.map(name))}</bdi>
          <span className="text-[11.5px] text-muted">({item.rule.hard ? W.hard : W.soft})</span>
        </>
      );
    if (item.kind === 'zone')
      return (
        <>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand-deep">
            {fmt(item.zone.near ? W.near : W.far, { zone: a.issues.zones[item.zone.zone] })}
          </span>
          <bdi className="min-w-0">{join(item.zone.units.map(name))}</bdi>
        </>
      );
    return (
      <>
        <span className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[11.5px] font-bold">
          <Accessibility aria-hidden className="size-3.5" />
          {W.accessible}
        </span>
        <bdi className="min-w-0">{name(item.unit)}</bdi>
      </>
    );
  };

  return (
    <section
      className="flex flex-col gap-2 rounded-[14px] border border-brand-line bg-brand-soft/40 p-3"
      data-testid="seating-words"
    >
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          <MessageSquareText aria-hidden className="size-4 text-brand-deep" />
          {W.title}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={W.placeholder}
          rows={2}
          maxLength={800}
          className="w-full resize-y rounded-btn border border-line bg-surface px-3 py-2 text-[14px] outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
        <span className="text-[12px] leading-snug text-muted">{W.hint}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={busy ? <LoaderCircle className="motion-safe:animate-spin" /> : <Sparkles />}
          disabled={busy || text.trim().length < 3}
          onClick={read}
          data-testid="words-read"
        >
          {busy ? W.reading : W.read}
        </Button>
        {added ? (
          <span role="status" className="text-[12.5px] font-semibold text-success">
            {added}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="flex flex-col gap-2" data-testid="words-answer">
          {items.length ? (
            <>
              <p className="text-[12.5px] font-semibold">{plural(W.found, items.length)}</p>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-btn bg-surface px-2.5 py-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={picked.has(item.key)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(item.key);
                          else next.delete(item.key);
                          setPicked(next);
                        }}
                        className="size-4 accent-ink"
                      />
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">{label(item)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {answer.unclear.length ? (
            <p className="text-[12.5px] text-warning">
              {fmt(W.unclear, { list: join(answer.unclear.map((q) => `"${q}"`)) })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {items.length ? (
              <Button size="sm" onClick={apply} disabled={picked.size === 0} data-testid="words-add">
                {plural(W.add, picked.size)}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setAnswer(null)}>
              {W.discard}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
