'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button, Dialog, useToast } from '@/components/app';
import { track } from '@/features/analytics/track';
import { useUi } from '@/lib/i18n/client';
import type { ToolKey } from '../../lib/tools';
import { ToolsPicker, saveEventTools } from './ToolsPicker';

/**
 * Changing the event's tools (lib/tools) after it started: the same cards as the start, in a dialog —
 * from the event's home ("need something else?", `?tools=1` from the sidebar's "add tools") and its
 * settings. Nothing is deleted by taking a tool away: its screens are only hidden, and come back with it.
 */
export function ToolsDialog({
  id,
  open,
  onOpenChange,
  current,
  offered,
  locked = [],
  source,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: readonly ToolKey[];
  offered: readonly ToolKey[];
  locked?: readonly ToolKey[];
  source: 'home' | 'settings';
}) {
  const { t } = useUi();
  const T = t.eventHome.tools;
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<ToolKey[]>([...current]);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (open) setValue([...current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each opening starts from what the event shows
  }, [open]);

  async function save() {
    setBusy(true);
    const ok = await saveEventTools(id, value);
    setBusy(false);
    if (!ok) return void toast({ title: T.error, variant: 'danger' });
    track('tools_set', { invitationId: id, props: { tools: value.join(','), source } });
    toast({ title: T.saved, variant: 'success' });
    onOpenChange(false);
    startTransition(() => router.refresh());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={T.title}
      description={T.body}
      closeLabel={t.common.close}
      className="max-w-[720px]!"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {T.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !value.length} data-testid="tools-save">
            {T.save}
          </Button>
        </>
      }
    >
      <ToolsPicker value={value} onChange={setValue} offered={offered} locked={locked} />
      {value.length ? null : (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-danger">
          {T.pickOne}
        </p>
      )}
    </Dialog>
  );
}
