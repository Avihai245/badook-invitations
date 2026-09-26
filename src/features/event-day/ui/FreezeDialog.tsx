'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button, Checkbox, Dialog } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { FrozenChange } from '../freeze';

/**
 * The freeze: a change to the seating moves families who were already told their table number (to
 * another table, or their table gets another number, or none). Asked first; the change is kept in the
 * history, and — when the system's number can send table numbers — only those families get the new one.
 */
export function FreezeDialog({
  changes,
  names,
  canNotify,
  notifyReady,
  onConfirm,
  onCancel,
}: {
  changes: readonly FrozenChange[];
  names: ReadonlyMap<string, string>;
  /** the event can tell guests their table (seating_guide) */
  canNotify: boolean;
  /** …from the system's number */
  notifyReady: boolean;
  onConfirm(notify: boolean): void;
  onCancel(): void;
}) {
  const { t, fmt, plural, number } = useUi();
  const F = t.eventDay.freeze;
  const [notify, setNotify] = useState(true);
  const sendable = changes.some((c) => c.to !== null);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={plural(F.title, changes.length, { n: number(changes.length) })}
      description={F.body}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-testid="freeze-cancel">
            {F.cancel}
          </Button>
          <Button
            icon={<Lock />}
            onClick={() => onConfirm(canNotify && notifyReady && sendable && notify)}
            data-testid="freeze-confirm"
          >
            {F.confirm}
          </Button>
        </>
      }
    >
      <ul className="grid max-h-[40dvh] gap-1.5 overflow-y-auto text-[13.5px]" data-testid="freeze-list">
        {changes.map((c) => (
          <li key={c.unitId} className="rounded-input bg-subtle px-3 py-2">
            {fmt(F[c.kind], { name: names.get(c.unitId) ?? '', told: c.told, to: c.to ?? '' })}
          </li>
        ))}
      </ul>
      {canNotify && sendable ? (
        notifyReady ? (
          <div className="mt-4">
            <Checkbox checked={notify} onCheckedChange={setNotify} label={F.notify} />
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted">{F.notifyOwn}</p>
        )
      ) : null}
      <p className="mt-3 text-[12px] text-muted">{F.recorded}</p>
    </Dialog>
  );
}
