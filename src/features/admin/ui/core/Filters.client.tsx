'use client';

import { Check, X } from 'lucide-react';
import { useId } from 'react';
import { Button, cn, Hint, Select } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';
import { useQueryUpdater } from './query';

/** A list filter as a native select, labelled; it writes its parameter into the address. */
export function FilterSelect({
  label,
  param,
  value,
  options,
  anyLabel,
  testId,
  className,
}: {
  label: string;
  param: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  /** the "all" choice (none: a value is always chosen) */
  anyLabel?: string;
  testId?: string;
  className?: string;
}) {
  const { set, pending } = useQueryUpdater();
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-[12px] font-semibold text-muted">
        {label}
      </label>
      <Select
        id={id}
        value={value ?? ''}
        disabled={pending}
        data-testid={testId}
        onChange={(e) => set({ [param]: e.target.value || null })}
        className="h-9 text-[13.5px]"
      >
        {anyLabel !== undefined ? <option value="">{anyLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** A yes/no filter as a toggle button (aria-pressed); on: the parameter is '1'. */
export function FilterToggle({
  label,
  help,
  param,
  on,
  testId,
}: {
  label: string;
  help: string;
  param: string;
  on: boolean;
  testId?: string;
}) {
  const { set, pending } = useQueryUpdater();
  return (
    <Hint text={help}>
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        data-testid={testId}
        onClick={() => set({ [param]: on ? null : '1' })}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
          on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:bg-subtle',
        )}
      >
        {on ? <Check aria-hidden className="size-3.5" /> : null}
        {label}
      </button>
    </Hint>
  );
}

/** Clears the list's filters (shown only when there are any). */
export function ClearFilters({ params, active }: { params: readonly string[]; active: boolean }) {
  const { t } = useAdminUi();
  const { set } = useQueryUpdater();
  if (!active) return null;
  return (
    <Hint text={t.kit.clearFiltersHelp}>
      <Button
        variant="ghost"
        size="sm"
        icon={<X />}
        onClick={() => set(Object.fromEntries(params.map((p) => [p, null])))}
      >
        {t.kit.clearFilters}
      </Button>
    </Hint>
  );
}
