'use client';

import {
  ChevronsUpDown,
  CircleUserRound,
  CreditCard,
  FileText,
  LayoutGrid,
  LogOut,
  Mail,
  MessageCircleQuestion,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandLogo, cn, Menu, type MenuItem } from '@/components/app';
import { openSupport } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { signOut } from '../../(auth)/actions';
import { UiLanguageToggle } from '../../UiLanguageToggle';

type Section = 'invitations' | 'new' | 'billing' | 'account' | null;

/** Which part of the app a path belongs to (an invitation's own pages are part of "my invitations"). */
export function sectionOf(path: string): Section {
  if (path.startsWith('/app/invitations/new')) return 'new';
  if (path === '/app/invitations' || path.startsWith('/app/invitations/')) return 'invitations';
  if (path.startsWith('/app/billing')) return 'billing';
  if (path.startsWith('/app/account')) return 'account';
  return null;
}

const LEGAL = ['privacy', 'terms', 'cookies', 'accessibility'] as const;

/**
 * The app's frame, one element for every screen size (so the account menu exists once): on phones
 * and tablets a compact top bar (brand, language, account); from 1024px the sidebar on the start
 * side — brand, "new invitation", the main places, help (the assistant) and, at the bottom, the
 * language, the account and the legal pages. The sidebar's middle stays clear: the accessibility
 * button floats over the left edge halfway down.
 */
export function AppSidebar({ email }: { email: string | null }) {
  const { t } = useUi();
  const n = t.shell.nav;
  const current = sectionOf(usePathname());
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur',
        'lg:h-dvh lg:flex-col lg:items-stretch lg:gap-0 lg:border-e lg:border-b-0 lg:bg-surface lg:px-0 lg:backdrop-blur-none',
      )}
    >
      <Link
        href="/app/invitations"
        className="rounded-btn text-[18px] lg:mx-5 lg:mt-5 lg:mb-5 lg:self-start lg:text-[19px]"
      >
        <BrandLogo label={t.brand} />
      </Link>

      <div className="hidden px-4 lg:block">
        <Link
          href="/app/invitations/new"
          aria-current={current === 'new' ? 'page' : undefined}
          className="group flex h-11 items-center justify-center gap-2 rounded-[12px] bg-linear-to-br from-brand to-brand-deep px-4 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(122,82,48,0.9)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_14px_28px_-12px_rgba(122,82,48,0.95)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Plus
            aria-hidden
            className="size-[18px] transition-transform group-hover:rotate-90 motion-reduce:transition-none"
          />
          {n.newInvitation}
        </Link>
      </div>

      <nav aria-label={n.label} className="mt-5 hidden flex-col gap-1 px-3 lg:flex">
        <SideLink href="/app/invitations" icon={LayoutGrid} active={current === 'invitations'}>
          {n.invitations}
        </SideLink>
        <SideLink href="/app/billing" icon={CreditCard} active={current === 'billing'}>
          {n.billing}
        </SideLink>
        <SideLink href="/app/account" icon={CircleUserRound} active={current === 'account'}>
          {n.account}
        </SideLink>
        <button
          type="button"
          onClick={() => openSupport()}
          className="flex h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <MessageCircleQuestion aria-hidden className="size-[19px] shrink-0" strokeWidth={1.75} />
          {n.help}
        </button>
      </nav>

      <div className="ms-auto flex items-center gap-2 lg:ms-0 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-3 lg:px-3 lg:pb-4">
        <div className="flex items-center justify-between gap-2 lg:px-2">
          <span className="hidden text-[12px] text-muted lg:inline">{t.shell.uiLanguage}</span>
          <UiLanguageToggle />
        </div>
        <UserMenu email={email} />
        <nav
          aria-label={t.shell.legal}
          className="hidden flex-wrap gap-x-3 gap-y-1 px-2 text-[11.5px] leading-5 text-faint lg:flex"
        >
          {LEGAL.map((key) => (
            <Link key={key} href={`/${key}`} className="rounded-[4px] hover:text-ink hover:underline">
              {t.site.footer[key]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function SideLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: LucideIcon;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors',
        active
          ? 'bg-brand-soft font-semibold text-brand-deep'
          : 'font-medium text-muted hover:bg-subtle hover:text-ink',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-2.5 -start-3 w-[3px] rounded-e-full bg-brand" />
      ) : null}
      <Icon aria-hidden className="size-[19px] shrink-0" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

/**
 * Phones and tablets: the main places at the bottom, "new invitation" raised in the middle. The
 * bottom-end corner stays free for the assistant's floating button.
 */
export function MobileTabBar() {
  const { t } = useUi();
  const s = t.shell.tabs;
  const current = sectionOf(usePathname());
  return (
    <nav
      aria-label={s.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.25)] backdrop-blur lg:hidden"
    >
      <div className="flex h-16 items-stretch ps-1 pe-[76px]">
        <TabLink href="/app/invitations" icon={LayoutGrid} active={current === 'invitations'}>
          {s.invitations}
        </TabLink>
        <Link
          href="/app/invitations/new"
          aria-current={current === 'new' ? 'page' : undefined}
          className="flex flex-1 flex-col items-center justify-end gap-1 pb-2 text-[11px] font-semibold text-brand-deep"
        >
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full bg-linear-to-br from-brand to-brand-deep text-white shadow-[0_10px_22px_-8px_rgba(122,82,48,0.9)] ring-4 ring-surface"
          >
            <Plus className="size-6" />
          </span>
          {s.newInvitation}
        </Link>
        <TabLink href="/app/billing" icon={CreditCard} active={current === 'billing'}>
          {s.billing}
        </TabLink>
      </div>
    </nav>
  );
}

function TabLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: LucideIcon;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
        active ? 'text-brand-deep' : 'text-muted hover:text-ink',
      )}
    >
      {active ? <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" /> : null}
      <Icon aria-hidden className="size-[22px]" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

/**
 * The account menu: who is signed in, the account, billing, help, the legal pages and signing out.
 * A round avatar in the phones' top bar; a row with the avatar and the address in the sidebar.
 */
export function UserMenu({ email }: { email: string | null }) {
  const { t } = useUi();
  const initial = (email ?? '?').trim()[0]?.toUpperCase() ?? '?';
  const items: MenuItem[] = [
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
    { type: 'separator' },
    ...LEGAL.map((key) => ({ label: t.site.footer[key], icon: <FileText />, href: `/${key}` })),
    { type: 'separator' },
    { label: t.shell.signOut, icon: <LogOut className="icon-dir" />, onSelect: () => void signOut() },
  ];
  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          aria-label={t.shell.userMenu}
          data-testid="user-menu"
          className="grid size-9 place-items-center rounded-full transition-colors hover:bg-subtle lg:flex lg:size-auto lg:w-full lg:items-center lg:gap-2.5 lg:rounded-[12px] lg:border lg:border-line lg:bg-canvas lg:px-2.5 lg:py-2 lg:text-start"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand to-brand-deep text-[14px] font-bold text-white"
          >
            {initial}
          </span>
          <span aria-hidden className="hidden min-w-0 flex-1 lg:block">
            <span className="block text-[11px] text-muted">{t.shell.signedInAs}</span>
            <span dir="ltr" className="block truncate text-start text-[12.5px] font-semibold">
              {email ?? '—'}
            </span>
          </span>
          <ChevronsUpDown aria-hidden className="hidden size-4 shrink-0 text-muted lg:block" />
        </button>
      }
      items={items}
    />
  );
}
