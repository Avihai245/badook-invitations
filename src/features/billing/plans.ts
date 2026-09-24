/**
 * The three plans (SaaS): what each allows. Prices come from the server's configuration
 * (INVITES_PRICE_PRO / INVITES_PRICE_BUSINESS, shekels a month incl. VAT); limits live here.
 * Isomorphic — the pricing page, the billing screen and every server check read the same table.
 */
export const PLAN_IDS = ['free', 'pro', 'business'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** invitations not archived at the same time; null = unlimited */
  activeInvitations: number | null;
  /** rows in one invitation's guest list */
  guestsPerInvitation: number;
  /** templates marked premium can be published */
  premiumTemplates: boolean;
  /** the "made with Badook" line can be turned off */
  removeBranding: boolean;
  /** WhatsApp messages included each month (credits) */
  monthlyCredits: number;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    activeInvitations: 1,
    guestsPerInvitation: 150,
    premiumTemplates: false,
    removeBranding: false,
    monthlyCredits: 0,
    prioritySupport: false,
  },
  pro: {
    activeInvitations: 5,
    guestsPerInvitation: 1000,
    premiumTemplates: true,
    removeBranding: true,
    monthlyCredits: 50,
    prioritySupport: false,
  },
  business: {
    activeInvitations: null,
    guestsPerInvitation: 5000,
    premiumTemplates: true,
    removeBranding: true,
    monthlyCredits: 300,
    prioritySupport: true,
  },
};

export const planRank = (p: PlanId) => PLAN_IDS.indexOf(p);
export const isPlanId = (v: unknown): v is PlanId => PLAN_IDS.includes(v as PlanId);

/** WhatsApp message packs (credits) sold one-off, besides a plan's monthly credits. */
export const CREDIT_PACKS = [100, 300, 1000] as const;
export type CreditPack = (typeof CREDIT_PACKS)[number];

export interface AccountPlanState {
  plan: PlanId;
  planStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  planRenewsAt: string | null;
}

const DAY = 86_400_000;
/** How long a paid plan stays after a renewal that never came (a failed charge, a lost notice). */
export const RENEWAL_GRACE_DAYS = 14;

/**
 * The plan in force now: a canceled subscription keeps its plan until the end of the paid period; a
 * renewal that never came keeps it for a two-week grace; the platform's admins always have the top plan.
 */
export function effectivePlan(state: AccountPlanState, now: number, admin = false): PlanId {
  if (admin) return 'business';
  if (state.plan === 'free') return 'free';
  const renews = state.planRenewsAt ? Date.parse(state.planRenewsAt) : null;
  if (state.planStatus === 'canceled') return renews && renews > now ? state.plan : 'free';
  if (renews && renews + RENEWAL_GRACE_DAYS * DAY < now) return 'free';
  return state.plan;
}

/** The products sold: the two paid plans (monthly) and the message packs (once). */
export const PRODUCTS = ['pro', 'business', 'credits_100', 'credits_300', 'credits_1000'] as const;
export type Product = (typeof PRODUCTS)[number];
export const isProduct = (v: unknown): v is Product => PRODUCTS.includes(v as Product);
export const packOf = (p: Product): CreditPack | null =>
  p.startsWith('credits_') ? (Number(p.slice(8)) as CreditPack) : null;

/** Israeli VAT (מע״מ), 18% since 2025-01-01: every price shown and charged includes it. */
export const VAT_RATE = 0.18;

/**
 * The price of one WhatsApp message in shekels, VAT included: what Meta charges us for it (its
 * marketing-message rate in USD) × the dollar rate × (1 + VAT), rounded up to the agora — so what is
 * left after VAT still covers Meta's charge.
 *
 * The rate (INVITES_WHATSAPP_PRICE_USD, default 0.0353): Meta's rate card for the WhatsApp Business
 * Platform, a marketing message to an Israeli number, per delivered message — US$0.0353 since the
 * per-message pricing of 2025-07-01, unchanged as of 2026-09
 * (developers.facebook.com/documentation/business-messaging/whatsapp/pricing). Check it again when
 * Meta publishes a new rate card; the dollar rate is INVITES_USD_TO_ILS.
 */
export function messagePriceIls(priceUsd: number, usdToIls: number): number {
  // toFixed: 15.000000000000002 agorot is 15, not 16
  return Math.ceil(Number((priceUsd * usdToIls * (1 + VAT_RATE) * 100).toFixed(6))) / 100;
}

/** A credit pack's price in shekels (VAT included): messages × the per-message price, to the agora. */
export function packPriceIls(count: number, priceUsd: number, usdToIls: number): number {
  return Math.round(count * messagePriceIls(priceUsd, usdToIls) * 100) / 100;
}
