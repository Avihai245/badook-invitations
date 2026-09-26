'use client';

import { hostApi } from '@/features/invitations/app/api';
import type { NoticeRow, Party, SeatingChange, Totals } from '../model';
import type { DayView, NotifyOutcome } from '../server/host-api';

/** The host's event-day calls (JSON; the routes check the session, the owner and the feature). */

type Answer<T> = T & { ok?: boolean; code?: string };
const post = <T>(url: string, body: unknown) => hostApi<Answer<T>>(url, { method: 'POST', body });

export interface NoticesState {
  rows: NoticeRow[];
  ready: boolean;
  credits: number;
  unlimited: boolean;
  slug: string;
  /** the wa.me message's values, in the invitation's own language */
  own: { locale: 'he' | 'en'; hosts: string };
  base: string;
}

export type ReseatAnswer = { change: SeatingChange; notified: NotifyOutcome | null } & {
  table?: number;
  capacity?: number;
  load?: number;
  need?: number;
};

export const dayApi = {
  view: (id: string) => hostApi<Answer<{ view: DayView }>>(`/api/invitations/${id}/event-day`),
  rotate: (id: string) =>
    post<{ view: DayView }>(`/api/invitations/${id}/event-day/station`, { rotate: true }),
  arrive: (id: string, unitId: string, count: number) =>
    post<{ checkinId: string; party: Party; totals: Totals }>(`/api/invitations/${id}/event-day/checkin`, {
      id: crypto.randomUUID(),
      unitId,
      count,
    }),
  undoArrival: (id: string, checkinId: string) =>
    post<{ party: Party; totals: Totals }>(`/api/invitations/${id}/event-day/undo`, { id: checkinId }),
  move: (
    id: string,
    body: { unitId: string; tableId: string; reason?: string; force?: boolean; notify?: boolean },
  ) => post<ReseatAnswer>(`/api/invitations/${id}/seating/live`, { action: 'move', ...body }),
  merge: (
    id: string,
    body: { from: string; into: string; reason?: string; force?: boolean; notify?: boolean },
  ) => post<ReseatAnswer>(`/api/invitations/${id}/seating/live`, { action: 'merge', ...body }),
  undoChange: (id: string, changeId: string, opts: { force?: boolean; notify?: boolean } = {}) =>
    post<ReseatAnswer>(`/api/invitations/${id}/seating/changes/undo`, { changeId, ...opts }),
  changes: (id: string) =>
    hostApi<Answer<{ changes: SeatingChange[] }>>(`/api/invitations/${id}/seating/changes`),
  notices: (id: string) => hostApi<Answer<NoticesState>>(`/api/invitations/${id}/seating/notices`),
  sendNotices: (id: string, unitIds: string[]) =>
    post<{ queued: number; sent: number; failed: number; pending: number; skipped?: Record<string, number> }>(
      `/api/invitations/${id}/seating/notices`,
      { action: 'send', unitIds },
    ),
  markNotices: (id: string, unitIds: string[]) =>
    post<{ marked: number }>(`/api/invitations/${id}/seating/notices`, { action: 'mark', unitIds }),
  continueNotices: (id: string) =>
    post<{ sent: number; failed: number; pending: number }>(`/api/invitations/${id}/seating/notices`, {
      action: 'continue',
    }),
};
