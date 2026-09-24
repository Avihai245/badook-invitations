import { describe, expect, it } from 'vitest';
import {
  effectivePlan,
  messagePriceIls,
  packOf,
  packPriceIls,
  PLAN_LIMITS,
  RENEWAL_GRACE_DAYS,
  VAT_RATE,
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
  it('a message costs Meta’s rate in shekels plus VAT, rounded up to the agora; packs multiply it', () => {
    // 0.0353 × 3.7 × 1.18 = 0.1541… → 0.16 (net of VAT 0.1356, above Meta's 0.1306)
    expect(VAT_RATE).toBe(0.18);
    expect(messagePriceIls(0.0353, 3.7)).toBe(0.16);
    expect(messagePriceIls(0.0353, 3.7) / (1 + VAT_RATE)).toBeGreaterThanOrEqual(0.0353 * 3.7);
    expect(packPriceIls(100, 0.0353, 3.7)).toBe(16);
    expect(packPriceIls(1000, 0.0353, 3.7)).toBe(160);
    // an exact agora stays as it is; anything above goes up to the next one
    expect(messagePriceIls(0.5, 1)).toBe(0.59);
    expect(messagePriceIls(0.05, 2.5)).toBe(0.15);
    // the configuration still moves it
    expect(messagePriceIls(0.04, 3.6)).toBe(0.17);
  });

  it('products: plans and message packs', () => {
    expect(packOf('credits_300')).toBe(300);
    expect(packOf('pro')).toBeNull();
    expect(PLAN_LIMITS.free.activeInvitations).toBe(1);
    expect(PLAN_LIMITS.business.activeInvitations).toBeNull();
  });
});
