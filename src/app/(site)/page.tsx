import {
  ArrowRight,
  Bot,
  CalendarHeart,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  FileSpreadsheet,
  Languages,
  ListChecks,
  MessageCircle,
  Play,
  Plus,
  Send,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Button, cn } from '@/components/app';
import { planPrices } from '@/features/billing/server/account';
import { posterSample } from '@/features/invitations/app/poster';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { TemplatePoster } from '@/features/invitations/app/TemplatePoster';
import type { EventType, Locale } from '@/features/invitations/contracts/types';
import { parseVideoLink } from '@/features/invitations/lib/video-links';
import { SAMPLES } from '@/features/invitations/templates/demo';
import { requireTemplate, TEMPLATES } from '@/features/invitations/templates/registry';
import { BackgroundVideo } from '@/features/site/BackgroundVideo.client';
import { Petals } from '@/features/site/Petals';
import { PlanCards } from '@/features/site/PlanCards';
import { Reveal } from '@/features/site/Reveal.client';
import { SampleShowcase } from '@/features/site/SampleShowcase.client';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { invitationsEnabled } from '@/lib/feature';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';

/** The three phones of the first screen: [left, center, right]. */
const PHONES = ['papercut-gold', 'sahar-bordeaux', 'rooftop-dusk'] as const;
/** The event types the band under the first screen names. */
const EVENTS: EventType[] = [
  'wedding',
  'engagement',
  'henna',
  'bar_mitzvah',
  'bat_mitzvah',
  'brit',
  'baby_shower',
  'birthday',
  'corporate',
  'save_the_date',
];
/** The first screen's background: this video, from 3:27. */
const HERO_VIDEO = parseVideoLink('https://youtu.be/5GvcO2lufGU?t=207')!;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  const title = `${t.brand} — ${t.home.title} ${t.home.titleAccent}`;
  return {
    title: { absolute: title },
    description: t.home.subtitle,
    // the public site is meant to be found (the app and the invitations stay hidden)
    robots: { index: true, follow: true },
    openGraph: { title, description: t.home.subtitle, type: 'website' },
  };
}

/** A template's first screen in a phone (the first screen's mock-ups). */
function Phone({
  id,
  locale,
  className,
  style,
}: {
  id: string;
  locale: Locale;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        'rounded-[2.1rem] bg-[#161412] p-[3.2%] shadow-[0_34px_60px_-24px_rgba(0,0,0,0.65)] ring-1 ring-white/10',
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
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      {eyebrow ? (
        <p className="mb-3 inline-flex items-center gap-2 text-[13px] font-bold tracking-wide text-brand uppercase">
          <Sparkles aria-hidden className="size-3.5" />
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-[32px] leading-tight font-bold tracking-[-0.01em] text-balance sm:text-[42px]">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-[17px] text-pretty text-muted">{subtitle}</p> : null}
    </Reveal>
  );
}

/**
 * The home page: a first screen over a looping video, a live sample invitation in a phone (with and
 * without a background video), how it works, the designs, what else it does, pricing and questions.
 * Signed-in hosts never see it — the middleware sends them to their invitations.
 */
export default async function HomePage() {
  const { locale, t } = await getUi();
  const h = t.home;
  const s = t.site;
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
    { icon: <ListChecks />, ...h.features.rsvp },
    { icon: <MessageCircle />, ...h.features.share },
    { icon: <Clapperboard />, ...h.features.video },
    { icon: <Languages />, ...h.features.languages },
    { icon: <CalendarHeart />, ...h.features.saveTheDate },
  ];
  const more: { icon: ReactNode; title: string; body: string }[] = [
    { icon: <FileSpreadsheet />, ...s.more.items.guests },
    { icon: <UserRound />, ...s.more.items.personal },
    { icon: <Send />, ...s.more.items.whatsapp },
    { icon: <Users />, ...s.more.items.statuses },
    { icon: <Bot />, ...s.more.items.assistant },
    { icon: <CircleHelp />, ...s.more.items.help },
  ];
  const designs = [...TEMPLATES.values()].map(({ manifest }) => manifest);
  const number = (v: number) => new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB').format(v);
  // the video sample skips the envelope: its first screen is the point
  const sample = (slug: string) => `/i/${slug}?lang=${locale}`;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* the posters write the names in their designs' fonts */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <SiteHeader overHero />

      <main id="main" className="flex-1">
        {/* ── first screen: over a looping video ─────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#1a130e] text-white">
          <BackgroundVideo
            link={HERO_VIDEO}
            labels={{ pause: s.hero.pauseVideo, play: s.hero.playVideo }}
            className="-z-20"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'linear-gradient(180deg, rgba(22,15,10,.72) 0%, rgba(22,15,10,.38) 38%, rgba(22,15,10,.55) 70%, rgba(22,15,10,.92) 100%),' +
                'radial-gradient(60% 55% at 80% 20%, rgba(181,110,59,.35), transparent 70%)',
            }}
          />
          <Petals />
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-5 pt-28 pb-24 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:gap-8 lg:pt-32">
            <div className="text-center lg:text-start">
              <span
                className="site-rise inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur"
                style={{ '--rise-delay': '80ms' } as CSSProperties}
              >
                <Sparkles aria-hidden className="size-3.5 text-[#f3c9a0]" />
                {h.badge}
              </span>
              <h1
                className="site-rise mt-6 font-display text-[40px] leading-[1.05] font-bold tracking-[-0.015em] text-balance drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)] sm:text-[64px]"
                style={{ '--rise-delay': '180ms' } as CSSProperties}
              >
                {h.title} <br />
                <span className="site-title-accent">{h.titleAccent}</span>
              </h1>
              <p
                className="site-rise mx-auto mt-6 max-w-xl text-[17px] text-pretty text-white/85 sm:text-[19px] lg:mx-0"
                style={{ '--rise-delay': '300ms' } as CSSProperties}
              >
                {h.subtitle}
              </p>
              <div
                className="site-rise mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
                style={{ '--rise-delay': '420ms' } as CSSProperties}
              >
                <Button asChild size="lg" variant="secondary">
                  <Link href="/signup">
                    {s.hero.startFree}
                    <ArrowRight className="icon-dir" aria-hidden />
                  </Link>
                </Button>
                <a
                  href="#sample"
                  className="inline-flex h-12 items-center gap-2 rounded-btn border border-white/40 px-5 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 [&_svg]:size-[18px]"
                >
                  <Play aria-hidden />
                  {h.sample}
                </a>
              </div>
              <ul
                className="site-rise mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-white/80 lg:justify-start"
                style={{ '--rise-delay': '540ms' } as CSSProperties}
              >
                {[
                  fmt(s.hero.stats.designs, { n: number(designs.length) }),
                  fmt(s.hero.stats.events, { n: number(EVENTS.length) }),
                  s.hero.stats.languages,
                ].map((item) => (
                  <li key={item} className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-1.5 rounded-full bg-[#f3c9a0]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden className="relative mx-auto aspect-[10/9] w-full max-w-[540px] max-lg:hidden">
              <div className="absolute top-[13%] left-[3%] w-[38%]">
                <Phone
                  id={PHONES[0]}
                  locale={locale}
                  className="site-float -rotate-[7deg]"
                  style={{ '--float-delay': '-2s' } as CSSProperties}
                />
              </div>
              <div className="absolute top-[13%] right-[3%] w-[38%]">
                <Phone
                  id={PHONES[2]}
                  locale={locale}
                  className="site-float rotate-[7deg]"
                  style={{ '--float-delay': '-4.5s' } as CSSProperties}
                />
              </div>
              <div className="absolute top-0 left-1/2 z-10 w-[45%] -translate-x-1/2">
                <Phone id={PHONES[1]} locale={locale} className="site-float" />
              </div>
            </div>
          </div>
          <a
            href="#sample"
            aria-label={s.hero.scroll}
            className="site-scroll-cue absolute bottom-6 left-1/2 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-white/30 text-white/85 hover:bg-white/10"
          >
            <ChevronDown aria-hidden className="size-5" />
          </a>
        </section>

        {/* ── every kind of event, drifting by ──────────────────────────────────────────────── */}
        <section
          aria-label={s.eventsLabel}
          className="site-marquee overflow-hidden border-b border-line bg-ink py-4 text-white/85"
        >
          <div className="site-marquee-track">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
                {EVENTS.map((type) => (
                  <li
                    key={type}
                    className="flex items-center gap-6 px-3 text-[17px] font-medium whitespace-nowrap"
                  >
                    <span>{t.eventTypes[type]}</span>
                    <span aria-hidden className="text-[#e7a977]">
                      ✦
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* ── the live sample, in a phone ───────────────────────────────────────────────────── */}
        <section id="sample" className="relative scroll-mt-16 overflow-hidden bg-canvas">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(45% 50% at 85% 30%, #F8E3D6 0%, transparent 65%), radial-gradient(40% 45% at 10% 80%, #F4EADB 0%, transparent 65%)',
            }}
          />
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-28">
            <SectionTitle
              eyebrow={s.showcase.eyebrow}
              title={s.showcase.title}
              subtitle={s.showcase.subtitle}
              className="max-w-2xl"
            />
            <Reveal className="mt-10" delay={120}>
              <SampleShowcase
                samples={{ classic: sample(SAMPLES.classic), video: `${sample(SAMPLES.video)}&open=1` }}
                labels={{ ...s.showcase, blocked: s.cookies.blocked, allow: s.cookies.allow }}
              />
            </Reveal>
          </div>
        </section>

        {/* ── how it works ──────────────────────────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-16 border-y border-line bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-24">
            <SectionTitle title={h.how.title} className="text-center" />
            <ol className="relative mt-12 grid gap-5 md:grid-cols-3">
              <span
                aria-hidden
                className="absolute inset-x-[16%] top-[52px] h-px bg-[linear-gradient(90deg,transparent,var(--color-brand-line)_15%,var(--color-brand-line)_85%,transparent)] max-md:hidden"
              />
              {h.how.steps.map((step, i) => (
                <Reveal
                  as="li"
                  key={step.title}
                  delay={i * 140}
                  className="site-lift relative rounded-[20px] border border-line bg-canvas p-7"
                >
                  <span className="relative grid size-12 place-items-center rounded-full bg-brand font-display text-[20px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(122,82,48,0.8)]">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-[18px] font-bold">{step.title}</h3>
                  <p className="mt-2 text-[15px] text-pretty text-muted">{step.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── the designs ───────────────────────────────────────────────────────────────────── */}
        <section id="designs" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-20 sm:px-6 lg:py-24">
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
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {designs.map((manifest, i) => (
              <Reveal as="li" key={manifest.id} delay={(i % 4) * 90}>
                <div className="site-lift rounded-[var(--radius-poster)]">
                  <TemplatePoster
                    template={manifest}
                    locale={locale}
                    text={posterSample(manifest.id, locale)}
                    className="shadow-[0_18px_36px_-18px_rgba(60,35,15,0.45)]"
                  />
                </div>
                <p className="mt-3 text-[15px] font-semibold">{manifest.name[locale] ?? manifest.name.en}</p>
                <p className="text-[13px] text-muted">
                  {manifest.categories
                    .filter((c) => c !== 'save_the_date')
                    .map((c) => t.eventTypes[c])
                    .join(' · ')}
                </p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* ── what it does ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-blush/70">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-24">
            <SectionTitle title={h.features.title} className="text-center" />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Reveal
                  as="li"
                  key={f.title}
                  delay={(i % 3) * 110}
                  className="site-lift rounded-[20px] bg-surface p-6 shadow-sm ring-1 ring-line"
                >
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand [&_svg]:size-[22px]"
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-[14.5px] text-pretty text-muted">{f.body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ── from the invitation to the big day (dark band) ────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-[#1c1510] text-white">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(50% 60% at 15% 0%, rgba(160,112,63,.45), transparent 70%), radial-gradient(45% 55% at 100% 100%, rgba(181,82,59,.35), transparent 70%)',
            }}
          />
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-24">
            <Reveal className="max-w-2xl">
              <h2 className="font-display text-[32px] leading-tight font-bold text-balance sm:text-[42px]">
                {s.more.title}
              </h2>
              <p className="mt-3 text-[17px] text-pretty text-white/75">{s.more.subtitle}</p>
            </Reveal>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((f, i) => (
                <Reveal
                  as="li"
                  key={f.title}
                  delay={(i % 3) * 110}
                  className="rounded-[20px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur transition-colors hover:bg-white/[0.1]"
                >
                  <span
                    aria-hidden
                    className="grid size-11 place-items-center rounded-[12px] bg-[#e7a977]/20 text-[#f3c9a0] [&_svg]:size-5"
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-[14.5px] text-pretty text-white/70">{f.body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ── pricing ───────────────────────────────────────────────────────────────────────── */}
        <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-20 sm:px-6 lg:py-24">
          <SectionTitle
            title={s.plans.title}
            subtitle={s.plans.subtitle}
            className="mx-auto max-w-2xl text-center"
          />
          <Reveal className="mt-12" delay={100}>
            <PlanCards t={t} locale={locale} prices={planPrices()} />
          </Reveal>
          <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] text-muted">
            {s.plans.extra} {s.plans.vat}
          </p>
        </section>

        {/* ── questions ─────────────────────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-[860px] px-5 py-20 sm:px-6 lg:py-24">
            <SectionTitle title={s.faq.title} className="text-center" />
            <div className="mt-10 flex flex-col gap-3">
              {s.faq.items.map((item, i) => (
                <Reveal key={item.q} delay={Math.min(i, 4) * 70}>
                  <details className="site-faq group rounded-[16px] border border-line bg-canvas px-5 open:bg-surface open:shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold">
                      {item.q}
                      <Plus
                        aria-hidden
                        className="site-faq-icon size-5 shrink-0 text-brand transition-transform duration-300"
                      />
                    </summary>
                    <p className="pb-5 text-[15px] text-pretty text-muted">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── last call ─────────────────────────────────────────────────────────────────────── */}
        <section className="px-5 py-20 sm:px-6">
          <Reveal className="relative isolate mx-auto max-w-[1100px] overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center text-white sm:py-20">
            <div
              aria-hidden
              className="site-glow absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(50% 90% at 50% 0%, rgba(160,112,63,0.6), transparent 70%),' +
                  'radial-gradient(40% 60% at 100% 100%, rgba(181,82,59,0.4), transparent 70%)',
              }}
            />
            <h2 className="font-display text-[32px] leading-tight font-bold text-balance sm:text-[46px]">
              {h.final.title}
            </h2>
            <p className="mt-3 text-[17px] text-white/75">{h.final.body}</p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link href="/signup">
                {h.start}
                <ArrowRight className="icon-dir" aria-hidden />
              </Link>
            </Button>
          </Reveal>
        </section>
      </main>

      <SiteFooter t={t} onHome />
    </div>
  );
}
