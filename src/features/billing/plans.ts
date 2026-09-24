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

/**
 * The plan in force now: a canceled subscription keeps its plan until the end of the paid period;
 * the platform's admins always have the top plan.
 */
export function effectivePlan(state: AccountPlanState, now: number, admin = false): PlanId {
  if (admin) return 'business';
  if (state.plan === 'free') return 'free';
  if (state.planStatus !== 'canceled') return state.plan;
  return state.planRenewsAt && Date.parse(state.planRenewsAt) > now ? state.plan : 'free';
}

/** The price of one WhatsApp message in shekels (Meta's marketing rate, converted, up to the agora). */
export function messagePriceIls(priceUsd: number, usdToIls: number): number {
  return Math.ceil(priceUsd * usdToIls * 100) / 100;
}

/** A credit pack's price in shekels: messages × the per-message price, to the agora. */
export function packPriceIls(count: number, priceUsd: number, usdToIls: number): number {
  return Math.round(count * messagePriceIls(priceUsd, usdToIls) * 100) / 100;
}
