'use client';

import { createContext, useContext, useId, useMemo, type ReactNode } from 'react';
import { cn } from './utils';

export type FieldContextValue = {
  /** id of the control — the `<label htmlFor>` target. */
  controlId: string;
  /** id of the label, for custom controls that need `aria-labelledby` (Segmented, …). */
  labelId: string;
  /** Space-separated ids of error, help and counter. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** The surrounding `<Field>` wiring, or `null`. Input/Select/Textarea/Segmented consume it automatically. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** Merges a control's own a11y props with the surrounding Field's (own props win). */
export function useFieldControl(
  props: { id?: string; 'aria-describedby'?: string; required?: boolean },
  invalid: boolean | undefined,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return {
    invalid: isInvalid,
    controlProps: {
      id: props.id ?? field?.controlId,
      'aria-describedby': cn(props['aria-describedby'], field?.describedBy) || undefined,
      'aria-invalid': isInvalid || undefined,
      required: props.required ?? (field?.required || undefined),
    },
  };
}

export type FieldProps = {
  label: ReactNode;
  /** The control: Input, Select, Textarea, Segmented… (wired through context). */
  children: ReactNode;
  /** Slot on the other side of the label row — e.g. `<L10nTabs>`. */
  labelAside?: ReactNode;
  /** Help line, 12px muted. */
  help?: ReactNode;
  /** Error message, 12px danger; also marks the control `aria-invalid`. */
  error?: ReactNode;
  /** Live counter under the control, end-aligned (`14/40`); turns danger above `max`. */
  counter?: { value: number; max: number };
  /** Marks the control required and shows a danger `*` after the label. */
  required?: boolean;
  /** Control id (defaults to a generated one). */
  id?: string;
  className?: string;
};

/** app.html `.fld`: label row (13px/600, space-between) → control → error/help (start) + counter (end). */
export function Field({
  label,
  children,
  labelAside,
  help,
  error,
  counter,
  required = false,
  id,
  className,
}: FieldProps) {
  const auto = useId();
  const controlId = id ?? `${auto}control`;
  const labelId = `${auto}label`;
  const helpId = `${auto}help`;
  const errorId = `${auto}error`;
  const counterId = `${auto}counter`;
  const invalid = error != null && error !== false && error !== '';
  const hasHelp = help != null && help !== false && help !== '';
  const over = counter ? counter.value > counter.max : false;
  const describedBy = cn(invalid && errorId, hasHelp && helpId, counter && counterId) || undefined;

  const context = useMemo<FieldContextValue>(
    () => ({ controlId, labelId, describedBy, invalid, required }),
    [controlId, labelId, describedBy, invalid, required],
  );

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label id={labelId} htmlFor={controlId} className="text-[13px] font-semibold">
          {label}
          {required && (
            <span aria-hidden className="text-danger">
              {' *'}
            </span>
          )}
        </label>
        {labelAside}
      </div>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {(invalid || hasHelp || counter) && (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {invalid && (
              <p id={errorId} className="mt-1.5 text-[12px] text-danger">
                {error}
              </p>
            )}
            {hasHelp && (
              <p id={helpId} className="mt-1.5 text-[12px] text-muted">
                {help}
              </p>
            )}
          </div>
          {counter && (
            <p
              id={counterId}
              className={cn('mt-1 shrink-0 text-[11px] tabular-nums', over ? 'text-danger' : 'text-faint')}
            >
              <span dir="ltr">
                {counter.value}/{counter.max}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
