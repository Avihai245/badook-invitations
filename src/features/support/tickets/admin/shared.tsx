'use client';

import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';
import { Badge, Button, Dialog, Field, Input, useToast, type BadgeVariant } from '@/components/app';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import { intlLocale, type UiLocale } from '@/lib/i18n/app';
import type { TicketPriority, TicketStatus } from '../config';

/** The console's support screens: status and priority in the team's words, and their actions' plumbing. */

const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open: 'warning',
  waiting: 'info',
  closed: 'neutral',
};

export function AdminStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useAdminUi();
  return (
    <Badge variant={STATUS_VARIANT[status]} data-status={status}>
      {t.support.status[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { t } = useAdminUi();
  if (priority !== 'high') return null;
  return (
    <Badge variant="danger" icon={<AlertTriangle />} data-priority="high">
      {t.support.priority.high}
    </Badge>
  );
}

/** "3 hours" / "יומיים": how long, in the largest whole unit. */
export function duration(locale: UiLocale, ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const [value, unit] =
    minutes < 60
      ? [minutes, 'minute']
      : minutes < 60 * 24
        ? [Math.round(minutes / 60), 'hour']
        : [Math.round(minutes / (60 * 24)), 'day'];
  return new Intl.NumberFormat(intlLocale(locale), { style: 'unit', unit, unitDisplay: 'long' }).format(
    value,
  );
}

export type ActionResult = { ok: true; body: Record<string, unknown> } | { ok: false };

/**
 * Calls one of the console's actions (JSON), then a toast — success, or the reason in words — and the
 * page refreshed (the server's data again). Signed out on the way: to the sign-in page.
 */
export function useAdminAction() {
  const { t } = useAdminUi();
  const { toast } = useToast();
  const router = useRouter();
  return useCallback(
    async (
      url: string,
      method: 'POST' | 'PATCH',
      body: unknown,
      done: string,
      { refresh = true }: { refresh?: boolean } = {},
    ): Promise<ActionResult> => {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (res?.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return { ok: false };
      }
      const json = ((await res?.json().catch(() => null)) ?? {}) as Record<string, unknown> & {
        code?: string;
      };
      if (res?.ok) {
        toast({ title: done, variant: 'success' });
        if (refresh) router.refresh();
        return { ok: true, body: json };
      }
      const code = json.code ?? (res ? 'server_error' : 'network');
      const specific = (t.support.errors as Record<string, string>)[code];
      const general = (t.errors as Record<string, string>)[
        code === 'invalid' ? 'invalid' : code in t.errors ? code : 'conflict'
      ];
      toast({ title: specific ?? general ?? t.errors.server_error, variant: 'danger' });
      if (code === 'not_found') router.refresh();
      return { ok: false };
    },
    [router, t, toast],
  );
}

/**
 * "Are you sure?" — what exactly will happen, then the action; with `reason`, a required reason (it
 * goes to the record of actions). Keeps itself open while the action runs.
 */
export function ConfirmDialog({
  title,
  body,
  confirm,
  danger = false,
  reason,
  onConfirm,
  onClose,
  testId,
}: {
  title: ReactNode;
  body: ReactNode;
  confirm: string;
  danger?: boolean;
  reason?: { label: string; placeholder: string; required: string };
  /** true: done (the dialog closes) */
  onConfirm: (reason: string) => Promise<boolean>;
  onClose: () => void;
  testId?: string;
}) {
  const { t, dir } = useAdminUi();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (reason && !text.trim()) {
      setError(reason.required);
      return;
    }
    setBusy(true);
    const done = await onConfirm(text.trim());
    setBusy(false);
    if (done) onClose();
  };
  return (
    <Dialog
      open
      dir={dir}
      onOpenChange={(open) => !open && !busy && onClose()}
      title={title}
      description={body}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={() => void run()}
            data-testid={testId ? `${testId}-confirm` : 'confirm'}
          >
            {confirm}
          </Button>
        </>
      }
    >
      {reason ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Field label={reason.label} error={error ?? undefined} required>
            <Input
              value={text}
              maxLength={300}
              placeholder={reason.placeholder}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              data-testid={testId ? `${testId}-reason` : undefined}
            />
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}
