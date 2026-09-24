import Link from 'next/link';
import { BrandLogo } from '@/components/app';
import { fmt, type AppDict } from '@/lib/i18n/app';
import { CookieConsent, CookieSettingsButton } from './CookieConsent.client';

/** The public site's footer: the brand, the home page's sections, the policies and contact — and the
 * cookie notice, which the public pages show until the visitor chooses. */
export function SiteFooter({ t, onHome = false }: { t: AppDict; onHome?: boolean }) {
  const f = t.site.footer;
  const n = t.site.nav;
  const at = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const link = 'rounded-btn text-muted transition-colors hover:text-ink';
  return (
    <footer className="border-t border-line bg-surface">
      {/* the public site's pages ask for consent; the app itself sets essential cookies only */}
      <CookieConsent />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <BrandLogo label={t.brand} className="text-[18px]" />
          <p className="mt-3 max-w-[32ch] text-[14px] text-muted">{f.tagline}</p>
        </div>
        <nav aria-label={f.product}>
          <p className="text-[13px] font-bold tracking-wide text-ink uppercase">{f.product}</p>
          <ul className="mt-3 flex flex-col gap-2 text-[14px]">
            <li>
              <a className={link} href={at('sample')}>
                {n.sample}
              </a>
            </li>
            <li>
              <a className={link} href={at('designs')}>
                {n.designs}
              </a>
            </li>
            <li>
              <a className={link} href={at('pricing')}>
                {n.pricing}
              </a>
            </li>
            <li>
              <a className={link} href={at('faq')}>
                {n.faq}
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label={f.legal}>
          <p className="text-[13px] font-bold tracking-wide text-ink uppercase">{f.legal}</p>
          <ul className="mt-3 flex flex-col gap-2 text-[14px]">
            <li>
              <Link className={link} href="/privacy">
                {f.privacy}
              </Link>
            </li>
            <li>
              <Link className={link} href="/terms">
                {f.terms}
              </Link>
            </li>
            <li>
              <Link className={link} href="/cookies">
                {f.cookies}
              </Link>
            </li>
            <li>
              <Link className={link} href="/accessibility">
                {f.accessibility}
              </Link>
            </li>
            <li>
              <CookieSettingsButton className={link} label={f.cookieSettings} />
            </li>
          </ul>
        </nav>
        <nav aria-label={f.contact}>
          <p className="text-[13px] font-bold tracking-wide text-ink uppercase">{f.contact}</p>
          <ul className="mt-3 flex flex-col gap-2 text-[14px]">
            <li>
              <Link className={link} href="/contact">
                {f.contact}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1200px] px-5 py-5 text-[13px] text-muted sm:px-6">
          {fmt(f.rights, { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
