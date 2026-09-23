import {
  ArrowRight,
  CalendarHeart,
  Check,
  Clapperboard,
  Languages,
  MessageCircle,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo, Button, cn } from '@/components/app';
import { posterSample } from '@/features/invitations/app/poster';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { TemplatePoster } from '@/features/invitations/app/TemplatePoster';
import type { Locale } from '@/features/invitations/contracts/types';
import { requireTemplate, TEMPLATES } from '@/features/invitations/templates/registry';
import { invitationsEnabled } from '@/lib/feature';
import { getUi } from '@/lib/i18n/server';
import { UiLanguageToggle } from './UiLanguageToggle';

/** The three phones of the first screen: [left, center, right]. */
const PHONES = ['papercut-gold', 'sahar-bordeaux', 'rooftop-dusk'] as const;

/** A template's first screen in a phone (the home page's mock-ups). */
function Phone({ id, locale, className }: { id: string; locale: Locale; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[2.1rem] bg-[#161412] p-[3.2%] shadow-[0_34px_60px_-24px_rgba(60,35,15,0.55)] ring-1 ring-black/10',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.75rem]">
        <TemplatePoster
          template={requireTemplate(id).manifest}
          locale={locale}
          text={posterSample(id, locale)}
          frameless
        />
        <span className="absolute top-[1.6%] left-1/2 h-[2.6%] w-[30%] -translate-x-1/2 rounded-full bg-[#161412]" />
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-display text-[30px] leading-tight font-bold tracking-[-0.01em] text-balance sm:text-[38px]">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-[16px] text-pretty text-muted">{subtitle}</p> : null}
    </div>
  );
}

/**
 * The home page: what Badook is, and the way in (create an account / sign in / a sample invitation).
 * Signed-in hosts never see it — the middleware sends them to their invitations. The designs are
 * shown as their invitations' first screens (TemplatePoster), in the page's language.
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
    { icon: <Clapperboard />, ...h.features.video },
    { icon: <Languages />, ...h.features.languages },
    { icon: <CalendarHeart />, ...h.features.saveTheDate },
  ];
  const designs = [...TEMPLATES.values()].map(({ manifest }) => manifest);
  const cta = (
    <>
      {h.start}
      <ArrowRight className="icon-dir" aria-hidden />
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* the posters write the names in their designs' fonts */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-6">
          <Link href="/" className="rounded-btn text-[19px]">
            <BrandLogo label={t.brand} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <UiLanguageToggle />
            <Link href="/login" className="rounded-btn px-3 py-2 text-[14px] font-semibold hover:bg-subtle">
              {h.login}
            </Link>
            <Button asChild size="sm" className="max-sm:hidden">
              <Link href="/signup">{h.start}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(55% 60% at 85% 10%, #F8E3D6 0%, transparent 62%),' +
                'radial-gradient(45% 50% at 8% 30%, #F4EADB 0%, transparent 65%),' +
                'radial-gradient(60% 45% at 50% 100%, #F1E7DA 0%, transparent 70%)',
            }}
          />
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pt-16 lg:pb-24">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-surface/70 px-3.5 py-1.5 text-[13px] font-medium text-brand-deep">
                <Sparkles aria-hidden className="size-3.5" />
                {h.badge}
              </span>
              <h1 className="mt-5 font-display text-[42px] leading-[1.08] font-bold tracking-[-0.015em] text-balance sm:text-[58px]">
                {h.title} <br />
                <span className="text-brand">{h.titleAccent}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-[17px] text-pretty text-muted sm:text-[18px] lg:mx-0">
                {h.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button asChild size="lg">
                  <Link href="/signup">{cta}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href={`/i/noa-and-itay?lang=${locale}`}>
                    <Play aria-hidden />
                    {h.sample}
                  </Link>
                </Button>
              </div>
              <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-muted lg:justify-start">
                {h.trust.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check aria-hidden className="size-4 text-brand" strokeWidth={2.5} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden className="relative mx-auto aspect-[10/9] w-full max-w-[540px]">
              <Phone
                id={PHONES[0]}
                locale={locale}
                className="absolute top-[13%] left-[3%] w-[38%] -rotate-[7deg]"
              />
              <Phone
                id={PHONES[2]}
                locale={locale}
                className="absolute top-[13%] right-[3%] w-[38%] rotate-[7deg]"
              />
              <Phone
                id={PHONES[1]}
                locale={locale}
                className="absolute top-0 left-1/2 z-10 w-[45%] -translate-x-1/2"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-20">
            <SectionTitle title={h.how.title} className="text-center" />
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {h.how.steps.map((step, i) => (
                <li key={step.title} className="rounded-[18px] border border-line bg-canvas p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-brand font-display text-[18px] font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] text-pretty text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle title={h.designs.title} subtitle={h.designs.subtitle} />
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-btn text-[15px] font-semibold text-brand-deep hover:underline"
            >
              {h.designs.cta}
              <ArrowRight aria-hidden className="icon-dir size-4" />
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:gap-x-6">
            {designs.map((manifest) => (
              <li key={manifest.id}>
                <TemplatePoster
                  template={manifest}
                  locale={locale}
                  text={posterSample(manifest.id, locale)}
                  className="shadow-[0_18px_36px_-18px_rgba(60,35,15,0.45)]"
                />
                <p className="mt-2.5 text-[15px] font-semibold">
                  {manifest.name[locale] ?? manifest.name.en}
                </p>
                <p className="text-[13px] text-muted">
                  {manifest.categories
                    .filter((c) => c !== 'save_the_date')
                    .map((c) => t.eventTypes[c])
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-blush/70">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-20">
            <SectionTitle title={h.features.title} className="text-center" />
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f.title} className="rounded-[18px] bg-surface p-6 shadow-sm ring-1 ring-line">
                  <span
                    aria-hidden
                    className="grid size-11 place-items-center rounded-[12px] bg-brand-soft text-brand [&_svg]:size-5"
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-[16px] font-bold">{f.title}</h3>
                  <p className="mt-1 text-[14px] text-pretty text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 lg:py-20">
          <div className="relative isolate mx-auto max-w-[1100px] overflow-hidden rounded-[28px] bg-ink px-6 py-14 text-center text-white sm:py-16">
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(50% 90% at 50% 0%, rgba(160,112,63,0.55), transparent 70%),' +
                  'radial-gradient(40% 60% at 100% 100%, rgba(181,82,59,0.35), transparent 70%)',
              }}
            />
            <h2 className="font-display text-[30px] leading-tight font-bold text-balance sm:text-[42px]">
              {h.final.title}
            </h2>
            <p className="mt-3 text-[16px] text-white/75">{h.final.body}</p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link href="/signup">{cta}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-7 text-[13px] text-muted sm:px-6">
          <BrandLogo label={t.brand} className="text-[15px] text-ink" />
          <span>{h.footer}</span>
        </div>
      </footer>
    </div>
  );
}
