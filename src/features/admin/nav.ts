import type { Permission } from './permissions';

/** The console's areas, in the sidebar's order, each shown to the roles with its permission. */
export const ADMIN_NAV = [
  { key: 'overview', href: '/app/admin', perm: 'dashboard.view' },
  { key: 'users', href: '/app/admin/users', perm: 'users.view' },
  { key: 'invitations', href: '/app/admin/invitations', perm: 'invitations.view' },
  { key: 'messages', href: '/app/admin/messages', perm: 'messages.view' },
  { key: 'finance', href: '/app/admin/finance', perm: 'finance.view' },
  { key: 'support', href: '/app/admin/support', perm: 'support.view' },
  { key: 'partners', href: '/app/admin/partners', perm: 'partners.view' },
  { key: 'staff', href: '/app/admin/staff', perm: 'staff.view' },
  { key: 'audit', href: '/app/admin/audit', perm: 'audit.view' },
  { key: 'system', href: '/app/admin/system', perm: 'system.view' },
] as const satisfies readonly { key: string; href: string; perm: Permission }[];

export type AdminArea = (typeof ADMIN_NAV)[number]['key'];

/** The area a path belongs to (the overview only for itself). */
export function adminAreaOf(path: string): AdminArea | null {
  let best: (typeof ADMIN_NAV)[number] | null = null;
  for (const item of ADMIN_NAV) {
    const match =
      item.href === '/app/admin'
        ? path === item.href
        : path === item.href || path.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.key ?? null;
}
