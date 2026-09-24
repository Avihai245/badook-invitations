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
import { FeatureSpotlight } from '@/features/site/home/FeatureSpotlight.client';
import { HowItWorks } from '@/features/site/home/HowItWorks';
import { Journey } from '@/features/site/home/Journey';
import type { FeatureKey, MomentKey } from '@/features/site/home/scenes';
import { Petals } from '@/features/site/Petals';
import { PlanCards } from '@/features/site/PlanCards';
import { Reveal } from '@/features/site/Reveal.client';
import { SampleShowcase } from '@/features/site/SampleShowcase.client';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { invitationsEnabled } from '@/lib/feature';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import '@/styles/site-home.css';

/** The designs fanned out in "how it works" (the last one is in front). */
const FAN = ['kalanit', 'midnight-bloom', 'sahar-bordeaux'] as const;
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
  reveal = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  /** false: inside a block that reveals itself */
  reveal?: boolean;
}) {
  const Wrap = reveal ? Reveal : 'div';
  return (
    <Wrap className={className}>
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
    </Wrap>
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
  const features: { key: FeatureKey; icon: ReactNode; title: string; body: string }[] = [
    { key: 'opening', icon: <Sparkles />, ...h.features.opening },
    { key: 'rsvp', icon: <ListChecks />, ...h.features.rsvp },
    { key: 'share', icon: <MessageCircle />, ...h.features.share },
    { key: 'video', icon: <Clapperboard />, ...h.features.video },
    { key: 'languages', icon: <Languages />, ...h.features.languages },
    { key: 'saveTheDate', icon: <CalendarHeart />, ...h.features.saveTheDate },
  ];
  const more: { key: MomentKey; icon: ReactNode; title: string; body: string }[] = [
    { key: 'guests', icon: <FileSpreadsheet />, ...s.more.items.guests },
    { key: 'personal', icon: <UserRound />, ...s.more.items.personal },
    { key: 'whatsapp', icon: <Send />, ...s.more.items.whatsapp },
    { key: 'statuses', icon: <Users />, ...s.more.items.statuses },
    { key: 'assistant', icon: <Bot />, ...s.more.items.assistant },
    { key: 'help', icon: <CircleHelp />, ...s.more.items.help },
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
            <Reveal>
              <SampleShowcase
                intro={
                  <SectionTitle
                    eyebrow={s.showcase.eyebrow}
                    title={s.showcase.title}
                    subtitle={s.showcase.subtitle}
                    className="max-w-2xl"
                    reveal={false}
                  />
                }
                samples={{ classic: sample(SAMPLES.classic), video: `${sample(SAMPLES.video)}&open=1` }}
                labels={{ ...s.showcase, blocked: s.cookies.blocked, allow: s.cookies.allow }}
              />
            </Reveal>
          </div>
        </section>

        {/* ── how it works: three live scenes along a path ──────────────────────────────────── */}
        <section
          id="how"
          className="relative isolate scroll-mt-16 overflow-hidden border-y border-line bg-surface"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(40% 55% at 12% 20%, #FBF3EA 0%, transparent 70%), radial-gradient(38% 50% at 90% 85%, #F8EBE4 0%, transparent 70%)',
            }}
          />
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-24">
            <SectionTitle title={h.how.title} className="text-center" />
            <HowItWorks
              steps={h.how.steps}
              s={s.scenes}
              posters={FAN.map((id) => (
                <TemplatePoster
                  key={id}
                  template={requireTemplate(id).manifest}
                  locale={locale}
                  text={posterSample(id, locale)}
                  frameless
                />
              ))}
            />
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
                {/* each design opens its live demo, as guests would get it */}
                <a
                  href={`/i/demo-${manifest.id}?lang=${locale}`}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${manifest.name[locale] ?? manifest.name.en} · ${t.gallery.preview.liveDemo}`}
                  className="group relative block rounded-[var(--radius-poster)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                >
                  <span className="site-lift block rounded-[var(--radius-poster)]">
                    <TemplatePoster
                      template={manifest}
                      locale={locale}
                      text={posterSample(manifest.id, locale)}
                      className="shadow-[0_18px_36px_-18px_rgba(60,35,15,0.45)]"
                    />
                  </span>
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12.5px] font-semibold text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-3.5"
                  >
                    <Play fill="currentColor" />
                    {h.sample}
                  </span>
                </a>
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

        {/* ── everything an invitation needs: a phone that shows each feature live ──────────── */}
        <section className="relative isolate overflow-hidden bg-blush/70">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:py-24">
            <SectionTitle title={h.features.title} className="text-center" />
            <Reveal className="mt-12" delay={100}>
              <FeatureSpotlight items={features} s={s.scenes} label={h.features.title} />
            </Reveal>
          </div>
        </section>

        {/* ── from the invitation to the big day: a lit path through six moments (dark band) ── */}
        <section className="relative isolate overflow-hidden bg-[#1c1510] text-white">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(50% 40% at 15% 0%, rgba(160,112,63,.45), transparent 70%), radial-gradient(45% 35% at 100% 100%, rgba(181,82,59,.35), transparent 70%)',
            }}
          />
          <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-6 lg:py-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-[32px] leading-tight font-bold text-balance sm:text-[42px]">
                {s.more.title}
              </h2>
              <p className="mt-3 text-[17px] text-pretty text-white/75">{s.more.subtitle}</p>
            </Reveal>
            <Journey items={more} s={s.scenes} />
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
