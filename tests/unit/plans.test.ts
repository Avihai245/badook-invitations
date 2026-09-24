import { describe, expect, it } from 'vitest';
import {
  effectivePlan,
  messagePriceIls,
  packOf,
  packPriceIls,
  PLAN_LIMITS,
  RENEWAL_GRACE_DAYS,
} from '@/features/billing/plans';

const NOW = Date.parse('2026-09-24T10:00:00Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

describe('the plan in force', () => {
  it('free is free; admins always get the top plan', () => {
    expect(effectivePlan({ plan: 'free', planStatus: 'active', planRenewsAt: null }, NOW)).toBe('free');
    expect(effectivePlan({ plan: 'free', planStatus: 'active', planRenewsAt: null }, NOW, true)).toBe(
      'business',
    );
  });

  it('a canceled plan lasts until the end of the paid period', () => {
    expect(effectivePlan({ plan: 'pro', planStatus: 'canceled', planRenewsAt: at(3) }, NOW)).toBe('pro');
    expect(effectivePlan({ plan: 'pro', planStatus: 'canceled', planRenewsAt: at(-1) }, NOW)).toBe('free');
    expect(effectivePlan({ plan: 'pro', planStatus: 'canceled', planRenewsAt: null }, NOW)).toBe('free');
  });

  it('a renewal that never came keeps the plan for the grace period only', () => {
    expect(effectivePlan({ plan: 'business', planStatus: 'active', planRenewsAt: at(20) }, NOW)).toBe(
      'business',
    );
    expect(effectivePlan({ plan: 'business', planStatus: 'past_due', planRenewsAt: at(-3) }, NOW)).toBe(
      'business',
    );
    expect(
      effectivePlan(
        { plan: 'business', planStatus: 'active', planRenewsAt: at(-RENEWAL_GRACE_DAYS - 1) },
        NOW,
      ),
    ).toBe('free');
  });
});

describe('prices', () => {
  it('a message costs Meta’s rate in shekels, rounded up to the agora; packs multiply it', () => {
    expect(messagePriceIls(0.0353, 3.7)).toBe(0.14);
    expect(packPriceIls(100, 0.0353, 3.7)).toBe(14);
    expect(packPriceIls(1000, 0.0353, 3.7)).toBe(140);
  });

  it('products: plans and message packs', () => {
    expect(packOf('credits_300')).toBe(300);
    expect(packOf('pro')).toBeNull();
    expect(PLAN_LIMITS.free.activeInvitations).toBe(1);
    expect(PLAN_LIMITS.business.activeInvitations).toBeNull();
  });
});
