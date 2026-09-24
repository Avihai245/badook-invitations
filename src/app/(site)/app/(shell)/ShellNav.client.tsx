'use client';

import { CircleUserRound, CreditCard, LayoutGrid, LogOut, Mail, MessageCircleQuestion } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, IconButton, Menu } from '@/components/app';
import { openSupport } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { signOut } from '../../(auth)/actions';

/** The app header's links (wide screens) — the current one is marked. */
export function ShellLinks() {
  const { t } = useUi();
  const path = usePathname();
  const links = [
    { href: '/app/invitations', label: t.shell.nav.invitations },
    { href: '/app/billing', label: t.shell.nav.billing },
  ];
  return (
    <nav aria-label={t.shell.nav.label} className="flex items-center gap-1 text-[14px] max-md:hidden">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-btn px-3 py-1.5 font-semibold transition-colors',
              active ? 'bg-subtle text-ink' : 'text-muted hover:bg-subtle hover:text-ink',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The account menu: who is signed in, the account, billing, invitations (phones), help, sign out. */
export function UserMenu({ email }: { email: string | null }) {
  const { t } = useUi();
  const initial = (email ?? '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <Menu
      align="end"
      trigger={
        <IconButton label={t.shell.userMenu} className="rounded-full" data-testid="user-menu">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-brand text-[14px] font-bold text-white"
          >
            {initial}
          </span>
        </IconButton>
      }
      items={[
        ...(email
          ? [
              {
                label: (
                  <span dir="ltr" className="text-muted">
                    {email}
                  </span>
                ),
                disabled: true,
              },
            ]
          : []),
        { label: t.shell.nav.account, icon: <CircleUserRound />, href: '/app/account' },
        { label: t.shell.nav.billing, icon: <CreditCard />, href: '/app/billing' },
        { label: t.shell.nav.invitations, icon: <LayoutGrid />, href: '/app/invitations' },
        { label: t.shell.nav.assistant, icon: <MessageCircleQuestion />, onSelect: () => openSupport() },
        { label: t.shell.nav.contact, icon: <Mail />, href: '/contact' },
        { type: 'separator' as const },
        { label: t.shell.signOut, icon: <LogOut className="icon-dir" />, onSelect: () => void signOut() },
      ]}
    />
  );
}
