'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import type { Plan, SeatingState } from '../model';
import { mergePlans } from '../plan';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'failed' | 'over';

/** How long after the last change the plan is saved, and how often replies are looked up. */
const DEBOUNCE_MS = 800;
const REFRESH_MS = 60_000;

/**
 * Autosave for the seating plan: 800 ms after the last change the whole plan is saved on top of the
 * version it was loaded at. Another window (or the other host) saved first → the stored plan is read,
 * this window's changes since its version are applied on top (mergePlans) and saved again. While the
 * screen is open, replies are looked up every minute and when the window comes back into focus (a
 * family that confirmed shows up; the plan follows another window's saves when this one has none).
 */
export function useSeatingSave({
  id,
  initial,
  plan,
  onServerPlan,
  onUnits,
}: {
  id: string;
  initial: SeatingState;
  plan: Plan;
  /** the plan to show now (a merge, or another window's save), with the undo history reset */
  onServerPlan(plan: Plan, merged: boolean): void;
  /** fresh units and venue from the server */
  onUnits(state: SeatingState): void;
}) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [overTable, setOverTable] = useState<number | null>(null);
  const version = useRef(initial.version);
  /** the plan as stored at `version` */
  const base = useRef<Plan>(initial.plan);
  const latest = useRef(plan);
  latest.current = plan;
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | null>(null);

  const fetchState = useCallback(async (): Promise<SeatingState | null> => {
    const res = await hostApi<{ ok: boolean; state: SeatingState }>(`/api/invitations/${id}/seating`);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return null;
    }
    return res.ok && res.body?.ok ? res.body.state : null;
  }, [id]);

  const flush = useCallback(async (): Promise<void> => {
    if (busy.current) {
      again.current = true;
      return;
    }
    const sent = latest.current;
    if (sent === base.current) {
      setStatus('saved');
      return;
    }
    busy.current = true;
    setStatus('saving');
    const res = await hostApi<{ ok: boolean; version?: number; table?: number; code?: string }>(
      `/api/invitations/${id}/seating`,
      { method: 'POST', body: { version: version.current, plan: sent } },
    );
    busy.current = false;
    if (res.ok && res.body?.ok && typeof res.body.version === 'number') {
      version.current = res.body.version;
      base.current = sent;
      setOverTable(null);
      if (latest.current !== sent || again.current) {
        again.current = false;
        void flush();
      } else setStatus('saved');
      return;
    }
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return;
    }
    if (res.status === 409) {
      // another window saved first: its plan, with this window's changes on top
      const server = await fetchState();
      if (!server) {
        setStatus('failed');
        return;
      }
      const merged = mergePlans(base.current, latest.current, server.plan);
      version.current = server.version;
      base.current = server.plan;
      onUnits(server);
      onServerPlan(merged, true);
      latest.current = merged;
      void flush();
      return;
    }
    if (res.status === 422 && res.body?.code === 'over_capacity') {
      // replies grew since the screen loaded: the fresh numbers, and the table to fix
      setOverTable(res.body.table ?? null);
      setStatus('over');
      const server = await fetchState();
      if (server) onUnits(server);
      return;
    }
    setStatus('failed');
  }, [id, fetchState, onServerPlan, onUnits]);

  // a change: saved a moment after the last one
  useEffect(() => {
    if (plan === base.current) return;
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [plan, flush]);

  // replies (and other windows' saves) while the screen is open
  const refresh = useCallback(async () => {
    if (document.visibilityState !== 'visible' || busy.current) return;
    const server = await fetchState();
    if (!server) return;
    onUnits(server);
    if (server.version !== version.current && latest.current === base.current) {
      version.current = server.version;
      base.current = server.plan;
      latest.current = server.plan;
      onServerPlan(server.plan, false);
    }
  }, [fetchState, onServerPlan, onUnits]);
  useEffect(() => {
    const every = window.setInterval(() => void refresh(), REFRESH_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(every);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  // leaving with unsaved changes: the browser asks first
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (latest.current !== base.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  // (the event day's freeze: a confirmed change's families are told their new table once it is stored)
  const isStored = useCallback((p: Plan) => p === base.current, []);
  return {
    status,
    overTable,
    retry: () => void flush(),
    /** the plan changed on the server (an undo in the history): show it now (after a save in flight) */
    reload: () =>
      void (async () => {
        for (let i = 0; i < 20 && busy.current; i++) await new Promise((r) => setTimeout(r, 250));
        await refresh();
      })(),
    isStored,
  };
}
