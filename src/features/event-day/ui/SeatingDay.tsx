'use client';

import { History, Lock, Send } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer, Hint, Skeleton, useToast } from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import type { Plan } from '@/features/seating/model';
import { useUi } from '@/lib/i18n/client';
import { frozenChanges, staleUnits, type FrozenChange, type ToldMap } from '../freeze';
import type { SeatingChange, Told } from '../model';
import type { SeatingDayInfo } from '../server/pages';
import { FreezeDialog } from './FreezeDialog';
import { HistoryList } from './HistoryList';
import { dayApi } from './host-api';
import { NoticesDialog } from './NoticesDialog';
import { useNotifyOutcome } from './useNotifyOutcome';

type SaveStatus = 'saved' | 'pending' | 'saving' | 'failed' | 'over';

/**
 * What the event day adds to the seating screen: the freeze (a change that moves families already told
 * their table number is asked first — `guard` — and afterwards only they are told the new one, once
 * the change is saved), "send guests their table" with how many need an update, and the history of
 * changes with undo.
 */
export function useSeatingDay({
  id,
  day,
  plan,
  names,
  saveStatus,
  isStored,
  onServerChange,
}: {
  id: string;
  day: SeatingDayInfo | null;
  plan: Plan;
  names: ReadonlyMap<string, string>;
  saveStatus: SaveStatus;
  /** this plan is the one stored */
  isStored(plan: Plan): boolean;
  /** the seating changed on the server (an undo from the history): load it */
  onServerChange(): void;
}): {
  /** applies a change now — or, when it moves families already told their table, after the host confirms */
  guard(after: Plan | ((p: Plan) => Plan), apply: () => void): boolean;
  actions: ReactNode;
  dialogs: ReactNode;
} {
  const { t, fmt, plural, number } = useUi();
  const E = t.eventDay;
  const { toast } = useToast();
  const report = useNotifyOutcome();
  const guide = day?.features.seating_guide;
  const canNotify = !!guide?.on;
  const notifyReady = !!day?.notifyReady;

  const [told, setTold] = useState<ToldMap>(() => day?.told ?? {});
  const [freeze, setFreeze] = useState<{ changes: FrozenChange[]; apply(): void } | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const [notices, setNotices] = useState<{ only: string[] | null } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [changes, setChanges] = useState<SeatingChange[] | null>(null);

  const planRef = useRef(plan);
  planRef.current = plan;
  const toldRef = useRef(told);
  toldRef.current = told;

  const guard = useCallback((after: Plan | ((p: Plan) => Plan), apply: () => void) => {
    const next = typeof after === 'function' ? after(planRef.current) : after;
    const found = next === planRef.current ? [] : frozenChanges(planRef.current, next, toldRef.current);
    if (!found.length) {
      apply();
      return true;
    }
    setFreeze({ changes: found, apply });
    return false;
  }, []);

  /** what the families were told, again (after a message, a mark, an undo) */
  const refreshTold = useCallback(async () => {
    if (!canNotify) return;
    const res = await dayApi.notices(id);
    if (!res.ok || !res.body?.rows) return;
    const next: Record<string, Told> = {};
    for (const r of res.body.rows) if (r.told) next[r.unitId] = r.told;
    setTold(next);
  }, [canNotify, id]);

  const loadChanges = useCallback(async () => {
    const res = await dayApi.changes(id);
    if (res.status === 401) return window.location.assign(loginUrl());
    setChanges(res.ok && res.body?.changes ? res.body.changes : []);
  }, [id]);

  // the confirmed change is saved: now its families get their new table (never the old one)
  useEffect(() => {
    if (!pending || saveStatus !== 'saved' || !isStored(planRef.current)) return;
    const unitIds = pending;
    setPending(null);
    void (async () => {
      const res = await dayApi.sendNotices(id, unitIds);
      if (res.status === 401) return window.location.assign(loginUrl());
      const body = res.body;
      if (res.ok && body)
        toast({
          variant: 'success',
          title: plural(E.notified.sent, body.queued, { n: number(body.queued) }),
        });
      else if (body?.code === 'credits') {
        toast({ variant: 'danger', title: E.notified.credits });
        setNotices({ only: unitIds });
      } else {
        const code = body?.code;
        toast({
          variant: 'danger',
          title:
            code === 'not_published' || code === 'nobody' ? E.notices.errors[code] : E.notices.errors.failed,
        });
      }
      await refreshTold();
    })();
  }, [pending, saveStatus, isStored, id, toast, plural, number, E, refreshTold]);

  const stale = staleUnits(plan, told).length;

  const actions = (
    <>
      {canNotify ? (
        <Hint text={E.notices.buttonHint}>
          <Button
            variant="secondary"
            icon={<Send className="icon-dir" />}
            onClick={() => setNotices({ only: null })}
            data-testid="seating-notices"
          >
            {E.notices.button}
            {stale ? (
              <span
                className="ms-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-warning-bg px-1.5 text-[11.5px] font-bold text-warning"
                data-testid="notices-stale"
              >
                <span aria-hidden>{number(stale)}</span>
                <span className="sr-only">{plural(E.notices.badge, stale, { n: number(stale) })}</span>
              </span>
            ) : null}
          </Button>
        </Hint>
      ) : guide?.why === 'plan' ? (
        <Hint text={fmt(E.notices.lockedHint, { package: t.seating.packages[guide.package] })}>
          <Button variant="secondary" icon={<Lock />} asChild>
            <Link href={`/app/billing?plan=${guide.plan}`} data-testid="seating-notices-locked">
              {E.notices.button}
            </Link>
          </Button>
        </Hint>
      ) : null}
      {day ? (
        <Hint text={E.history.buttonHint}>
          <Button
            variant="secondary"
            icon={<History />}
            onClick={() => {
              setHistoryOpen(true);
              setChanges(null);
              void loadChanges();
            }}
            data-testid="seating-history-button"
          >
            {E.history.button}
          </Button>
        </Hint>
      ) : null}
    </>
  );

  const dialogs = (
    <>
      {freeze ? (
        <FreezeDialog
          changes={freeze.changes}
          names={names}
          canNotify={canNotify}
          notifyReady={notifyReady}
          onCancel={() => setFreeze(null)}
          onConfirm={(notify) => {
            const f = freeze;
            setFreeze(null);
            f.apply();
            const seated = f.changes.filter((c) => c.to !== null).map((c) => c.unitId);
            if (notify && seated.length) setPending(seated);
          }}
        />
      ) : null}
      {canNotify ? (
        <NoticesDialog
          id={id}
          open={!!notices}
          onOpenChange={(o) => !o && setNotices(null)}
          only={notices?.only ?? null}
          onChanged={() => void refreshTold()}
        />
      ) : null}
      {day ? (
        <Drawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          title={E.history.title}
          description={E.history.intro}
          closeLabel={t.common.close}
        >
          {changes === null ? (
            <div className="grid gap-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={56} radius={10} />
              ))}
            </div>
          ) : (
            <HistoryList
              id={id}
              changes={changes}
              told={told}
              canNotify={canNotify}
              notifyReady={notifyReady}
              onUndone={(change, notified) => {
                const manual = report(notified, change);
                if (manual) setNotices({ only: manual });
                onServerChange();
                void loadChanges();
                void refreshTold();
              }}
            />
          )}
        </Drawer>
      ) : null}
    </>
  );

  return { guard, actions, dialogs };
}
