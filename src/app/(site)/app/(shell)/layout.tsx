import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo, Button } from '@/components/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';
import { signOut } from '../../(auth)/actions';
import { UiLanguageToggle } from '../../UiLanguageToggle';

/** Host-app chrome for the list, gallery, responses and share pages (the editor is full-screen). */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const [{ t }, user] = await Promise.all([getUi(), getSessionUser()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t.shell.skipToContent}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/app/invitations" className="rounded-btn text-[18px]">
            <BrandLogo label={t.brand} />
          </Link>
          <nav aria-label={t.shell.account} className="flex items-center gap-1 text-[14px] max-sm:hidden">
            <Link
              href="/app/invitations"
              className="rounded-btn px-3 py-1.5 font-semibold text-ink hover:bg-subtle"
            >
              {t.shell.nav.invitations}
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-3">
            <UiLanguageToggle />
            {user?.email ? (
              <span className="hidden max-w-[220px] truncate text-[13px] text-muted md:inline" dir="ltr">
                {user.email}
              </span>
            ) : null}
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                icon={<LogOut className="icon-dir" />}
                aria-label={t.shell.signOut}
                title={t.shell.signOut}
              >
                <span className="max-sm:sr-only">{t.shell.signOut}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
