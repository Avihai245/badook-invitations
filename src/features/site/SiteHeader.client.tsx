'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandLogo, Button, cn } from '@/components/app';
import { UiLanguageToggle } from '@/app/(site)/UiLanguageToggle';
import { useUi } from '@/lib/i18n/client';

const SECTIONS = ['sample', 'how', 'designs', 'pricing', 'faq'] as const;

/**
 * The public site's header: the brand, links to the home page's sections, the UI language, sign-in
 * and "create". Over the home page's video it starts transparent with light text and turns solid once
 * the page scrolls; elsewhere it is solid. On phones the links fold into a menu.
 */
export function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  const { t } = useUi();
  const s = t.site.nav;
  const [scrolled, setScrolled] = useState(!overHero);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const light = overHero && !scrolled && !open;
  const href = (id: (typeof SECTIONS)[number]) => (overHero ? `#${id}` : `/#${id}`);
  const label = { sample: s.sample, designs: s.designs, how: s.how, pricing: s.pricing, faq: s.faq };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow,color] duration-300',
        overHero && '-mb-16',
        light
          ? 'bg-transparent text-white'
          : 'border-b border-line/60 bg-canvas/90 text-ink shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur',
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-btn bg-ink px-3 py-2 text-[14px] font-semibold text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
      >
        {t.shell.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/" className="rounded-btn text-[19px]" onClick={() => setOpen(false)}>
          <BrandLogo label={t.brand} />
        </Link>
        <nav aria-label={s.label} className="max-lg:hidden">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a
                  href={href(id)}
                  className={cn(
                    'rounded-btn px-3 py-2 text-[14px] font-medium transition-colors',
                    light
                      ? 'text-white/85 hover:bg-white/10 hover:text-white'
                      : 'text-muted hover:bg-subtle hover:text-ink',
                  )}
                >
                  {label[id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <UiLanguageToggle />
          <Link
            href="/login"
            className={cn(
              'rounded-btn px-3 py-2 text-[14px] font-semibold max-sm:hidden',
              light ? 'hover:bg-white/10' : 'hover:bg-subtle',
            )}
          >
            {t.home.login}
          </Link>
          <Button asChild size="sm" className="max-sm:hidden">
            <Link href="/signup">{t.home.start}</Link>
          </Button>
          <button
            type="button"
            className={cn(
              'grid size-9 place-items-center rounded-btn lg:hidden [&_svg]:size-5',
              light ? 'hover:bg-white/10' : 'hover:bg-subtle',
            )}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? s.closeMenu : s.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <div id="site-menu" className="site-swap border-t border-line bg-canvas px-5 pt-3 pb-5 lg:hidden">
          <nav aria-label={s.label}>
            <ul className="flex flex-col">
              {SECTIONS.map((id) => (
                <li key={id}>
                  <a
                    href={href(id)}
                    onClick={() => setOpen(false)}
                    className="block rounded-btn px-2 py-3 text-[16px] font-semibold hover:bg-subtle"
                  >
                    {label[id]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild variant="secondary">
              <Link href="/login">{t.home.login}</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">{t.home.start}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
