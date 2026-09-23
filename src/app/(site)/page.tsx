import { MessageCircle, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, cn } from '@/components/app';
import { posterColors } from '@/features/invitations/app/poster';
import { TemplatePoster } from '@/features/invitations/app/TemplatePoster';
import { requireTemplate } from '@/features/invitations/templates/registry';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { UiLanguageToggle } from './UiLanguageToggle';

/** A few designs on the home page, with the monogram their covers would show. */
const SHOWCASE = [
  ['sahar-bordeaux', 'נ&א', 'N&I'],
  ['papercut-gold', 'ש&ד', 'S&D'],
  ['rooftop-dusk', '30', '30'],
  ['honey-meadow', 'מ', 'M'],
] as const;

/**
 * The home page: what Badook is, and the way in (create an account / sign in / a sample invitation).
 * Signed-in hosts never see it — the middleware sends them to their invitations.
 */
export default async function HomePage() {
  const { locale, t } = await getUi();
  const h = t.home;
  if (!invitationsEnabled()) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-[26px] font-bold tracking-tight">{h.footer}</h1>
        <p className="text-muted">{h.soon}</p>
      </main>
    );
  }
  const features: { icon: ReactNode; title: string; body: string }[] = [
    { icon: <Sparkles />, ...h.features.opening },
    { icon: <Users />, ...h.features.rsvp },
    { icon: <MessageCircle />, ...h.features.share },
  ];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
        <span className="text-[18px] font-bold tracking-tight">{t.brand}</span>
        <div className="flex items-center gap-3">
          <UiLanguageToggle />
          <Link href="/login" className="rounded-[6px] text-[14px] font-semibold hover:underline">
            {h.login}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pt-10 pb-16 sm:pt-16">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-[34px] leading-[1.15] font-bold tracking-[-0.02em] text-balance sm:text-[44px]">
            {h.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-pretty text-muted sm:text-[17px]">
            {h.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">{h.start}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={`/i/noa-and-itay?lang=${locale}`}>{h.sample}</Link>
            </Button>
          </div>
        </section>
        <ul
          aria-hidden
          className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:mt-16 sm:grid-cols-4 sm:gap-5"
        >
          {SHOWCASE.map(([id, he, en], i) => (
            // phones: one row of two
            <li key={id} className={cn(i % 2 && 'sm:translate-y-6', i > 1 && 'max-sm:hidden')}>
              <TemplatePoster
                colors={posterColors(requireTemplate(id).manifest)}
                text={locale === 'he' ? he : en}
              />
            </li>
          ))}
        </ul>
        <ul className="mx-auto mt-14 grid max-w-4xl gap-4 sm:mt-20 sm:grid-cols-3">
          {features.map((f) => (
            <li key={f.title} className="rounded-card border border-line bg-surface p-5 shadow-sm">
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-full bg-subtle [&_svg]:size-5"
              >
                {f.icon}
              </span>
              <h2 className="mt-3 text-[15px] font-bold">{f.title}</h2>
              <p className="mt-1 text-[14px] text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="py-8 text-center text-[13px] text-muted">{h.footer}</footer>
    </div>
  );
}
