'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { SeatingChange } from '../model';
import type { NotifyOutcome } from '../server/host-api';

/** The families a change moved to another table (the server tells the same ones: movedUnits). */
export const movedIds = (change: SeatingChange): string[] =>
  change.units.filter((u) => u.to && u.from?.number !== u.to.number).map((u) => u.id);

/**
 * Tells the host what became of the message a re-seat (or its undo) asked for: sent from the system's
 * number, or why not. Returns the families the host should tell from their own WhatsApp (the caller
 * opens the notices dialog on them): the system's number can't send table numbers yet, or the credits
 * ran out.
 */
export function useNotifyOutcome(): (
  outcome: NotifyOutcome | null | undefined,
  change: SeatingChange,
) => string[] | null {
  const { t, plural, number } = useUi();
  const { toast } = useToast();
  const n = t.eventDay.notified;
  const notPublished = t.eventDay.notices.errors.not_published;
  return useCallback(
    (outcome, change) => {
      if (!outcome) return null;
      if (outcome.via === 'manual') return outcome.unitIds.length ? outcome.unitIds : null;
      if ('error' in outcome) {
        if (outcome.error === 'credits') {
          toast({ variant: 'danger', title: n.credits });
          const ids = movedIds(change);
          return ids.length ? ids : null;
        }
        toast({ variant: 'danger', title: outcome.error === 'nobody' ? n.none : notPublished });
        return null;
      }
      toast({ variant: 'success', title: plural(n.sent, outcome.queued, { n: number(outcome.queued) }) });
      return null;
    },
    [n, notPublished, number, plural, toast],
  );
}
