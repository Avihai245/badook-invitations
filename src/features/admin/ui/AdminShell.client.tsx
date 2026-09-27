'use client';

import {
  Activity,
  ArrowLeftRight,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Menu as MenuIcon,
  MessageSquareText,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, BrandLogo, cn, Drawer, Hint } from '@/components/app';
import { UiLanguageToggle } from '@/app/(site)/UiLanguageToggle';
import { ADMIN_NAV, adminAreaOf, type AdminArea } from '../nav';
import { useAdminUi } from './AdminUi.client';

const ICONS: Record<AdminArea, LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
  invitations: Mail,
  messages: MessageSquareText,
  finance: Wallet,
  support: LifeBuoy,
  partners: Handshake,
  staff: ShieldCheck,
  audit: ScrollText,
  system: Activity,
};

/** Counts beside an area's name (e.g. the support tickets waiting for an answer). */
export type AdminNavBadges = Partial<Record<AdminArea, number>>;

/**
 * The console's frame: from 1024px a sidebar on the start side (the areas this role may open, the
 * live state, who is signed in, the UI language, back to the app); below that a top bar with a menu.
 */
export function AdminShell({ badges, children }: { badges: AdminNavBadges; children: ReactNode }) {
  const { t } = useAdminUi();
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t.skipToContent}
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex">
        <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4">
          <Link href="/app/admin" className="rounded-btn text-[17px]">
            <BrandLogo label={t.consoleName} />
          </Link>
        </div>
        <div className="px-5 pb-3">
          <LiveBadge />
        </div>
        <AdminNavList badges={badges} />
        <SidebarFooter />
      </aside>
      <MobileBar badges={badges} />
      <main id="admin-main" className="min-w-0 px-4 pt-4 pb-16 sm:px-6 lg:px-8 lg:pt-7 lg:rtl:pl-14">
        {children}
      </main>
    </div>
  );
}

function AdminNavList({ badges, onNavigate }: { badges: AdminNavBadges; onNavigate?: () => void }) {
  const { t, can } = useAdminUi();
  const current = adminAreaOf(usePathname());
  return (
    <nav aria-label={t.nav.label} className="flex flex-col gap-0.5 px-3">
      {ADMIN_NAV.filter((item) => can(item.perm)).map((item) => {
        const Icon = ICONS[item.key];
        const active = current === item.key;
        const count = badges[item.key] ?? 0;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            data-testid={`admin-nav-${item.key}`}
            className={cn(
              'relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors',
              active
                ? 'bg-brand-soft font-semibold text-brand-deep'
                : 'font-medium text-muted hover:bg-subtle hover:text-ink',
            )}
          >
            {active ? (
              <span aria-hidden className="absolute inset-y-2 -start-3 w-[3px] rounded-e-full bg-brand" />
            ) : null}
            <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{t.nav[item.key]}</span>
            {count > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-deep px-1.5 text-[11px] font-bold text-white tabular-nums">
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { t, staff } = useAdminUi();
  return (
    <div className="mt-auto flex flex-col gap-3 px-3 pb-4">
      <Hint text={t.nav.backToAppHelp}>
        <Link
          href="/app/invitations"
          className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <ArrowLeftRight aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          {t.nav.backToApp}
        </Link>
      </Hint>
      <div className="flex items-center justify-between gap-2 px-2">
        <UiLanguageToggle />
      </div>
      <div className="rounded-[12px] border border-line bg-canvas px-3 py-2.5">
        <span className="block text-[11px] text-muted">{t.signedInAs}</span>
        <span dir="ltr" className="block truncate text-start text-[13px] font-medium text-ink">
          {staff.email}
        </span>
        <Hint text={t.roleHelp[staff.role]}>
          <span className="mt-1.5 inline-flex" tabIndex={0}>
            <Badge variant="info">{t.roles[staff.role]}</Badge>
          </span>
        </Hint>
      </div>
    </div>
  );
}

/** "Live" / "connecting" / "updates every minute" — whether the screen follows the system by itself. */
export function LiveBadge({ className }: { className?: string }) {
  const { t, live } = useAdminUi();
  const label = live === 'live' ? t.live.live : live === 'connecting' ? t.live.connecting : t.live.polling;
  const help = live === 'polling' ? t.live.pollingHelp : t.live.liveHelp;
  return (
    <Hint text={help}>
      <span
        tabIndex={0}
        data-testid="admin-live"
        data-state={live}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium',
          live === 'live'
            ? 'border-success/30 bg-success-bg text-success'
            : 'border-line bg-subtle text-muted',
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            live === 'live'
              ? 'bg-success motion-safe:animate-pulse'
              : live === 'connecting'
                ? 'bg-warning'
                : 'bg-faint',
          )}
        />
        {label}
      </span>
    </Hint>
  );
}

function MobileBar({ badges }: { badges: AdminNavBadges }) {
  const { t, dir } = useAdminUi();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const total = Object.values(badges).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
      <Link href="/app/admin" className="rounded-btn text-[16px]">
        <BrandLogo label={t.consoleName} />
      </Link>
      <LiveBadge className="ms-auto" />
      <Drawer
        open={open}
        onOpenChange={setOpen}
        dir={dir}
        title={t.consoleName}
        closeLabel={t.common.close}
        trigger={
          <button
            type="button"
            aria-label={t.nav.menu}
            data-testid="admin-menu"
            className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-subtle"
          >
            <MenuIcon aria-hidden className="size-[22px]" />
            {total > 0 ? (
              <span
                aria-hidden
                className="absolute end-1.5 top-1.5 size-2.5 rounded-full bg-brand ring-2 ring-surface"
              />
            ) : null}
          </button>
        }
      >
        <div className="-mx-3 flex flex-col gap-4">
          <AdminNavList badges={badges} onNavigate={() => setOpen(false)} />
          <SidebarFooter />
        </div>
      </Drawer>
    </header>
  );
}

/** An area's heading: its title, one line about it, and its actions (buttons, filters) at the end. */
export function AdminPageHeader({
  title,
  intro,
  actions,
}: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold tracking-tight text-ink lg:text-[28px]">{title}</h1>
        {intro ? <p className="mt-1 max-w-[70ch] text-[14px] text-muted">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
