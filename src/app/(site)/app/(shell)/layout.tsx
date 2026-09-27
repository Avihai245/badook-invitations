import Link from 'next/link';
import type { ReactNode } from 'react';
import { mayOpenConsole } from '@/features/admin/server/gate';
import { LEGAL_PAGES } from '@/features/legal/links';
import { ticketsDb } from '@/features/support/tickets/server/db';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';
import { AppSidebar, MobileTabBar } from './ShellNav.client';

/**
 * The host app's frame for the list, gallery, an invitation's pages, billing and the account (the
 * editor is full-screen): from 1024px a sidebar on the start side and the page beside it; below that
 * a compact top bar and a bottom tab bar (the page keeps room for it).
 *
 * The legal pages (privacy, terms, cookies, the accessibility statement) are reachable from every page
 * — Israel's accessibility regulations (2013, reg. 35) ask for the statement to be, and the privacy
 * notice goes with it: in the sidebar's foot from 1024px, below that at the foot of the page itself
 * (the phones' top bar has no room, and a menu would hide them).
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const [{ t }, user] = await Promise.all([getUi(), getSessionUser()]);
  // the platform's staff: the way into the admin console; support tickets with an answer not seen yet
  const [admin, unread] = user
    ? await Promise.all([
        mayOpenConsole(user),
        ticketsDb.unread(user.id).catch((err) => (console.error('[support] unread', err), 0)),
      ])
    : [false, 0];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t.shell.skipToContent}
      </a>
      <AppSidebar email={user?.email ?? null} admin={admin} unread={unread} />
      {/* room for the floating buttons: the tab bar (phones) and the assistant (bottom corner), and on
          RTL wide screens the accessibility button on the left edge (content starts past it) */}
      <main id="main" className="min-w-0 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-24 lg:rtl:pl-12">
        {children}
        <nav
          aria-label={t.shell.legal}
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-6 pb-2 text-[12px] leading-6 text-muted lg:hidden"
        >
          {LEGAL_PAGES.map((key) => (
            <Link
              key={key}
              href={`/${key}`}
              className="rounded-[4px] underline-offset-2 hover:text-ink hover:underline"
            >
              {t.site.footer[key]}
            </Link>
          ))}
        </nav>
      </main>
      <MobileTabBar unread={unread} />
    </div>
  );
}
