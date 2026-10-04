'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { hostApi, loginUrl, type ApiResponse } from '@/features/invitations/app/api';
import type { PlanView } from '../model/plan';

export type SaveStatus = 'saved' | 'saving' | 'failed';

export interface PlanApi {
  id: string;
  view: PlanView;
  setView: Dispatch<SetStateAction<PlanView>>;
  /** change the view locally (an optimistic update) */
  patch(change: (view: PlanView) => PlanView): void;
  /**
   * POST to one of the plan's routes (`/tasks`, `/budget`, …; '' is the root): tracked for the "all
   * changes saved" line, a signed-out host goes to sign in. A network failure answers status 0.
   */
  call<T = Record<string, unknown>>(path: string, body: unknown): Promise<ApiResponse<T>>;
  /** read the plan again (the totals and the system tasks are the server's to work out) */
  refresh(): Promise<boolean>;
  status: SaveStatus;
  /** tries the last failed call again */
  retry(): void;
}

const Ctx = createContext<PlanApi | null>(null);

export function usePlan(): PlanApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlan outside <PlanProvider>');
  return ctx;
}

/**
 * Holds the plan a planning screen was loaded with and the calls that change it: optimistic updates
 * by the screens (patch, then call, then roll back on failure), a count of calls in flight for the
 * "all changes saved" line, and `refresh` for what only the server can work out.
 */
export function PlanProvider({
  id,
  initial,
  children,
}: {
  id: string;
  initial: PlanView;
  children: ReactNode;
}) {
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const lastFailed = useRef<(() => Promise<unknown>) | null>(null);
  // what the server sends after a navigation replaces what this screen was loaded with
  useEffect(() => setView(initial), [initial]);

  const call = useCallback(
    async <T,>(path: string, body: unknown): Promise<ApiResponse<T>> => {
      const url = `/api/invitations/${id}/planning${path}`;
      const run = async () => {
        const res = await hostApi<T>(url, { method: 'POST', body });
        if (res.status === 401) window.location.assign(loginUrl());
        return res;
      };
      setPending((n) => n + 1);
      try {
        const res = await run();
        const broken = res.status === 0 || res.status >= 500;
        if (broken) {
          lastFailed.current = async () => {
            setFailed(false);
            const again = await run();
            if (again.status === 0 || again.status >= 500) setFailed(true);
            return again;
          };
        }
        setFailed(broken);
        return res;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [id],
  );

  const refresh = useCallback(async () => {
    const res = await hostApi<{ view?: PlanView }>(`/api/invitations/${id}/planning`);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return false;
    }
    if (!res.ok || !res.body?.view) return false;
    setView(res.body.view);
    return true;
  }, [id]);

  const retry = useCallback(() => {
    void lastFailed.current?.();
  }, []);

  // closing the page while a change is still on its way would lose it: the browser asks first
  useEffect(() => {
    if (pending === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const value = useMemo<PlanApi>(
    () => ({
      id,
      view,
      setView,
      patch: (change) => setView((v) => change(v)),
      call,
      refresh,
      status: pending > 0 ? 'saving' : failed ? 'failed' : 'saved',
      retry,
    }),
    [id, view, call, refresh, pending, failed, retry],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
