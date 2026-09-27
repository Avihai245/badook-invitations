'use client';

import { CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { Button, Dialog, Field, Hint, Textarea, useToast, type ButtonVariant } from '@/components/app';
import { useAdminUi } from '../AdminUi.client';
import type { ActionAnswer } from './post';

/** The reason every action on money, credits or access asks for (the database checks it again). */
export const REASON = { min: 3, max: 200 } as const;
export const reasonValid = (reason: string) =>
  reason.trim().length >= REASON.min && reason.trim().length <= REASON.max;

/**
 * An action's confirmation: what exactly will happen (`description`, and `summary` as the fields
 * change), its fields, a required reason, and one button that does it. Done: a toast, the dialog
 * closes and the page reads again. Refused: the reason in words, the dialog stays. Focus stays inside
 * while it is open (Radix Dialog).
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  summary,
  children,
  confirmLabel,
  confirmHelp,
  confirmVariant = 'primary',
  reason: askReason = true,
  valid = true,
  errors = {},
  success,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: ReactNode;
  description: ReactNode;
  /** the effect in one line, as the fields say now ("Dana will have 90 credits") */
  summary?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  confirmHelp: string;
  confirmVariant?: ButtonVariant;
  /** asks for the reason (default) */
  reason?: boolean;
  /** the other fields are complete */
  valid?: boolean;
  /** messages for the refusals this action may meet (by code) */
  errors?: Record<string, string>;
  /** the toast when it's done */
  success: string | ((body: Record<string, unknown>) => string);
  onConfirm(reason: string): Promise<ActionAnswer>;
  testId?: string;
}) {
  const { t } = useAdminUi();
  const { toast } = useToast();
  const router = useRouter();
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const ready = valid && (!askReason || reasonValid(reasonText)) && !busy;

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setReasonText('');
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const answer = await onConfirm(reasonText.trim());
    setBusy(false);
    if (answer.ok) {
      toast({
        title: typeof success === 'function' ? success(answer.body) : success,
        variant: 'success',
      });
      setReasonText('');
      onOpenChange(false);
      router.refresh();
      return;
    }
    const known = errors[answer.code] ?? (t.errors as Record<string, string>)[answer.code];
    setError(known ?? t.errors.conflict);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      closeLabel={t.common.close}
      footer={
        <>
          <Hint text={t.kit.cancelHelp}>
            <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
              {t.common.cancel}
            </Button>
          </Hint>
          <Hint text={confirmHelp}>
            <Button
              variant={confirmVariant}
              loading={busy}
              disabled={!ready}
              onClick={() => void submit()}
              data-testid={testId ? `${testId}-confirm` : undefined}
              aria-describedby={error ? errorId : undefined}
            >
              {confirmLabel}
            </Button>
          </Hint>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        data-testid={testId}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {children}
        {askReason ? (
          <Field
            label={t.common.reason}
            required
            help={t.kit.reasonHelp}
            counter={{ value: reasonText.trim().length, max: REASON.max }}
          >
            <Textarea
              name="reason"
              value={reasonText}
              maxLength={REASON.max + 20}
              placeholder={t.kit.reasonPlaceholder}
              onChange={(e) => setReasonText(e.target.value)}
              className="min-h-[72px]"
            />
          </Field>
        ) : null}
        {summary ? (
          <p className="rounded-[10px] bg-subtle px-3 py-2.5 text-[13.5px] text-ink" aria-live="polite">
            {summary}
          </p>
        ) : null}
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-[10px] border border-danger/30 bg-danger-bg px-3 py-2.5 text-[13.5px] text-danger"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
