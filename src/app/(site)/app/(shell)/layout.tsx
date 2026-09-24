import type { ReactNode } from 'react';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';
import { AppSidebar, MobileTabBar } from './ShellNav.client';

/**
 * The host app's frame for the list, gallery, an invitation's pages, billing and the account (the
 * editor is full-screen): from 1024px a sidebar on the start side and the page beside it; below that
 * a compact top bar and a bottom tab bar (the page keeps room for it).
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const [{ t }, user] = await Promise.all([getUi(), getSessionUser()]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t.shell.skipToContent}
      </a>
      <AppSidebar email={user?.email ?? null} />
      {/* room for the floating buttons: the tab bar (phones) and the assistant (bottom corner), and on
          RTL wide screens the accessibility button on the left edge (content starts past it) */}
      <main id="main" className="min-w-0 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-24 lg:rtl:pl-12">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
