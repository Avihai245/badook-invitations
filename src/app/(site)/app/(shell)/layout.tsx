import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/app';
import { AccessibilityMenu } from '@/features/site/AccessibilityMenu.client';
import { SupportButton } from '@/features/support/SupportChat.client';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';
import { UiLanguageToggle } from '../../UiLanguageToggle';
import { ShellLinks, UserMenu } from './ShellNav.client';

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
          <ShellLinks />
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <UiLanguageToggle />
            <SupportButton />
            <AccessibilityMenu placement="header" />
            <UserMenu email={user?.email ?? null} />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
