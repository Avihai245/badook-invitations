import { isTicketCategory, TICKET_PRIORITIES, type TicketPriority } from '../config';
import type { InboxQuery, InboxScope, InboxStatus } from '../types';

/** The console's inbox in its address: /app/admin/support?status=&scope=&category=&priority=&q=&page= */

const STATUSES: readonly InboxStatus[] = ['open', 'waiting', 'closed', 'all'];
const SCOPES: readonly InboxScope[] = ['all', 'mine', 'unassigned'];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The query from the address (anything unknown → the default: the tickets waiting for the team). */
export function parseInboxQuery(params: Record<string, string | string[] | undefined>): InboxQuery {
  const status = one(params.status);
  const scope = one(params.scope);
  const category = one(params.category);
  const priority = one(params.priority);
  const page = Number(one(params.page));
  return {
    status: STATUSES.includes(status as InboxStatus) ? (status as InboxStatus) : 'open',
    scope: SCOPES.includes(scope as InboxScope) ? (scope as InboxScope) : 'all',
    category: isTicketCategory(category) ? category : null,
    priority: (TICKET_PRIORITIES as readonly string[]).includes(priority ?? '')
      ? (priority as TicketPriority)
      : null,
    q: (one(params.q) ?? '').trim().slice(0, 100),
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

/** The address of the inbox with `patch` applied (a new filter starts from the first page). */
export function inboxHref(q: InboxQuery, patch: Partial<InboxQuery> = {}): string {
  const next: InboxQuery = { ...q, page: 1, ...patch };
  const p = new URLSearchParams();
  if (next.status !== 'open') p.set('status', next.status);
  if (next.scope !== 'all') p.set('scope', next.scope);
  if (next.category) p.set('category', next.category);
  if (next.priority) p.set('priority', next.priority);
  if (next.q) p.set('q', next.q);
  if (next.page > 1) p.set('page', String(next.page));
  const s = p.toString();
  return `/app/admin/support${s ? `?${s}` : ''}`;
}
