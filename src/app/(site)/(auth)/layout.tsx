import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/app';
import { posterSample } from '@/features/invitations/app/poster';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { TemplatePoster } from '@/features/invitations/app/TemplatePoster';
import { requireTemplate } from '@/features/invitations/templates/registry';
import { assertInvitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { UiLanguageToggle } from '../UiLanguageToggle';

/** The designs on the side panel: [back, front]. */
const PANEL = ['caesarea-shore', 'sahar-bordeaux'] as const;

/** The policies, in small print under the form. */
const LEGAL = [
  ['/privacy', 'privacy'],
  ['/terms', 'terms'],
  ['/cookies', 'cookies'],
  ['/accessibility', 'accessibility'],
] as const;

/**
 * Sign in / sign up / password pages: the form on the warm canvas and, on wide screens, a panel of
 * invitations (their first screens, TemplatePoster) with what Badook is; the policies in small print.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  assertInvitationsEnabled();
  const { t, locale } = await getUi();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="relative isolate flex flex-col">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 45% at 90% 0%, #F8E6DA 0%, transparent 65%),' +
              'radial-gradient(50% 40% at 0% 100%, #F3EADD 0%, transparent 65%)',
          }}
        />
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Link href="/" className="rounded-btn text-[19px]">
            <BrandLogo label={t.brand} />
          </Link>
          <UiLanguageToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-10 sm:pt-[10vh]">
          {children}
        </main>
        <footer className="px-5 pb-6 sm:px-8">
          <nav
            aria-label={t.site.footer.legal}
            className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted"
          >
            {LEGAL.map(([href, key]) => (
              <Link key={href} href={href} className="underline-offset-2 hover:text-ink hover:underline">
                {t.site.footer[key]}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
      <aside
        aria-hidden
        className="relative isolate hidden overflow-hidden bg-[#2A1D1A] text-white lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-10 lg:px-10"
      >
        <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(160,112,63,0.55), transparent 70%),' +
              'radial-gradient(50% 45% at 100% 100%, rgba(181,82,59,0.4), transparent 70%)',
          }}
        />
        <div className="relative h-[430px] w-[340px]">
          {PANEL.map((id, i) => (
            <div
              key={id}
              className={
                i === 0
                  ? 'absolute top-6 left-0 w-[190px] -rotate-6 opacity-90'
                  : 'absolute top-0 right-0 w-[210px] rotate-3'
              }
            >
              <div className="rounded-[1.9rem] bg-[#141210] p-[7px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                <div className="overflow-hidden rounded-[1.55rem]">
                  <TemplatePoster
                    template={requireTemplate(id).manifest}
                    locale={locale}
                    text={posterSample(id, locale)}
                    frameless
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="max-w-sm text-center">
          <p className="font-display text-[30px] leading-tight font-bold text-balance">{t.auth.panelTitle}</p>
          <p className="mt-3 text-[15px] text-white/70">{t.auth.panelBody}</p>
        </div>
      </aside>
    </div>
  );
}
