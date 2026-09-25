import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, cn } from '@/components/app';
import { PLAN_IDS, PLAN_LIMITS, type PlanId } from '@/features/billing/plans';
import { fmt, plural, type AppDict, type UiLocale } from '@/lib/i18n/app';

/** What a plan includes, in words, from PLAN_LIMITS (the same table every server check reads). */
export function planLines(t: AppDict, locale: UiLocale, plan: PlanId): string[] {
  const p = t.site.plans.limits;
  const l = PLAN_LIMITS[plan];
  const n = (v: number) => new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB').format(v);
  return [
    l.activeInvitations === null
      ? p.unlimited
      : plural(locale, p.invitations, l.activeInvitations, { n: n(l.activeInvitations) }),
    fmt(p.guests, { n: n(l.guestsPerInvitation) }),
    p.rsvp,
    l.monthlyCredits ? fmt(p.credits, { n: n(l.monthlyCredits) }) : p.noCredits,
    l.premiumTemplates ? p.premium : p.basic,
    ...(l.removeBranding ? [p.branding] : []),
    ...(l.prioritySupport ? [p.priority] : []),
  ];
}

/**
 * The three plans side by side (home page, billing screen): price a month, who it is for, what it
 * includes, and an action — `action(plan)` decides what the button does where the cards are shown.
 * `listPrices`: the prices before the account's discount, shown struck through where they differ.
 */
export function PlanCards({
  t,
  locale,
  prices,
  listPrices,
  current,
  action,
}: {
  t: AppDict;
  locale: UiLocale;
  prices: Record<PlanId, number>;
  listPrices?: Record<PlanId, number>;
  current?: PlanId;
  action?: (plan: PlanId) => ReactNode;
}) {
  const p = t.site.plans;
  // agorot only when there are any (a discounted price)
  const money = (v: number) =>
    new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  return (
    <ul className="grid gap-5 md:grid-cols-3">
      {PLAN_IDS.map((plan) => {
        const popular = plan === 'pro';
        return (
          <li
            key={plan}
            data-plan={plan}
            className={cn(
              'site-lift relative flex flex-col rounded-[22px] border bg-surface p-6',
              popular ? 'border-brand shadow-[0_24px_50px_-24px_rgba(122,82,48,0.5)]' : 'border-line',
            )}
          >
            {popular ? (
              <span className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[12px] font-bold text-white">
                <Sparkles aria-hidden className="size-3.5" />
                {p.popular}
              </span>
            ) : null}
            <h3 className="text-[18px] font-bold">{p.names[plan]}</h3>
            <p className="mt-1 text-[14px] text-muted">{p.blurbs[plan]}</p>
            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-[40px] leading-none font-bold tracking-tight">
                {prices[plan] ? money(prices[plan]) : p.freePrice}
              </span>
              {prices[plan] ? <span className="text-[14px] text-muted">{p.perMonth}</span> : null}
            </p>
            {listPrices && listPrices[plan] > prices[plan] ? (
              <p className="mt-1.5 text-[14px] text-muted" data-testid="list-price">
                <s aria-hidden>{money(listPrices[plan])}</s>
                <span className="sr-only">
                  {fmt(t.billing.discount.listPrice, { price: money(listPrices[plan]) })}
                </span>
              </p>
            ) : null}
            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {planLines(t, locale, plan).map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[14px]">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              {current === plan ? (
                <p className="rounded-btn bg-brand-soft py-2.5 text-center text-[14px] font-semibold text-brand-deep">
                  {p.current}
                </p>
              ) : action ? (
                action(plan)
              ) : (
                <Button asChild fullWidth variant={popular ? 'primary' : 'secondary'}>
                  <Link href={plan === 'free' ? '/signup' : `/signup?plan=${plan}`}>{p.cta[plan]}</Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
