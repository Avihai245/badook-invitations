import Link from 'next/link';
import type { ReactNode } from 'react';
import { assertInvitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { UiLanguageToggle } from '../UiLanguageToggle';

/** Sign in / sign up / password pages: a centered card on the app canvas. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  assertInvitationsEnabled();
  const { t } = await getUi();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="text-[18px] font-bold tracking-tight">
          {t.brand}
        </Link>
        <UiLanguageToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16">{children}</main>
    </div>
  );
}
