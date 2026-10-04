import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HintProvider, ToastProvider } from '@/components/app';
import { BillingScreen } from '@/features/billing/BillingScreen.client';
import { PLAN_LIMITS, effectivePlan, type PlanId } from '@/features/billing/plans';
import type { BillingPageData } from '@/features/billing/server/billing';
import { UiProvider } from '@/lib/i18n/provider';

// The customer's billing screen (/app/billing) and what the Badook team gave them from the admin
// console: a plan as a gift (it shows as one, has nothing to cancel, and ends by itself), credits
// added or removed by the team, a discount from the team.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const NOW = Date.parse('2026-09-27T09:00:00Z');
// a gift through 31 October (Israel): it ends at midnight after it
const GIFT_ENDS = '2026-10-31T22:00:00.000Z';

function page(
  account: Partial<BillingPageData['account']>,
  more: Partial<BillingPageData> = {},
): BillingPageData {
  const base = {
    userId: '11111111-1111-4111-8111-111111111111',
    fullName: 'Dana',
    avatarUrl: null,
    phone: null,
    plan: 'free' as PlanId,
    planStatus: 'active' as const,
    planRenewsAt: null as string | null,
    billingProvider: null as string | null,
    hasSubscription: false,
    credits: 0,
    source: 'signup',
    createdAt: '2026-09-01T00:00:00Z',
    activeInvitations: 1,
    discount: null,
    planPrice: null,
    email: 'dana@example.com',
    admin: false,
    ...account,
  };
  const effective = effectivePlan(base, NOW);
  return {
    account: { ...base, effective, limits: PLAN_LIMITS[effective] },
    prices: { free: 0, pro: 49, business: 149 },
    discount: null,
    packs: [],
    messagePrice: 0.16,
    mode: 'test',
    history: { checkouts: [], renewals: [], credits: [] },
    returned: null,
    ...more,
  };
}

const render = (data: BillingPageData) =>
  renderToStaticMarkup(
    <UiProvider locale="en">
      <ToastProvider label="Notice" viewportLabel="Notices" closeLabel="Close">
        <HintProvider>
          <BillingScreen data={data} status={null} />
        </HintProvider>
      </ToastProvider>
    </UiProvider>,
  );

describe('a plan the Badook team gave as a gift', () => {
  const gift = {
    plan: 'business' as PlanId,
    planStatus: 'canceled' as const,
    planRenewsAt: GIFT_ENDS,
    billingProvider: 'gift',
    planPrice: 0,
  };

  it('shows as a gift until its last day — never as a canceled subscription, with nothing to cancel', () => {
    const html = render(page(gift));
    expect(html).toContain('data-testid="plan-gift"');
    expect(html).toContain('A gift from the Badook team until 31 October 2026 (inclusive), with no charge.');
    expect(html).not.toContain('Canceled: active until');
    expect(html).not.toContain('Cancel subscription');
    expect(html).not.toContain('Move to Free');
    // no "monthly price" of ₪0
    expect(html).not.toContain('data-testid="plan-price"');
    // (a subscription the customer canceled still says so, and one they pay for can be canceled)
    const canceled = render(page({ ...gift, billingProvider: 'payplus', planPrice: 149 }));
    expect(canceled).toContain('Canceled: active until');
    expect(
      render(page({ ...gift, planStatus: 'active', billingProvider: 'payplus', planPrice: 149 })),
    ).toContain('Cancel subscription');
  });

  it('ends by itself: after the date the account is on the free plan', () => {
    const state = {
      plan: 'business' as PlanId,
      planStatus: 'canceled' as const,
      planRenewsAt: GIFT_ENDS,
      billingProvider: 'gift',
    };
    expect(effectivePlan(state, Date.parse(GIFT_ENDS) - 1)).toBe('business');
    expect(effectivePlan(state, Date.parse(GIFT_ENDS) + 1)).toBe('free');
    // and the screen says Free: no gift, nothing "canceled", no monthly price of ₪0
    const html = render(page({ ...gift, planRenewsAt: '2026-09-20T21:00:00.000Z' }));
    expect(html).toContain('Free, with no time limit');
    expect(html).not.toContain('data-testid="plan-gift"');
    expect(html).not.toContain('Canceled');
    expect(html).not.toContain('data-testid="plan-price"');
    expect(html).not.toContain('Cancel subscription');
  });
});

describe('the team’s credits and discounts', () => {
  it('credits the team added or removed say so', () => {
    const html = render(
      page(
        { credits: 40 },
        {
          history: {
            checkouts: [],
            renewals: [],
            credits: [
              { delta: 50, reason: 'support', at: '2026-09-26T10:00:00Z' },
              { delta: -10, reason: 'support', at: '2026-09-25T10:00:00Z' },
            ],
          },
        },
      ),
    );
    expect(html).toContain('Added by the Badook team');
    expect(html).toContain('Removed by the Badook team');
  });

  it('a discount from the team is never credited to Badook Events', () => {
    const discount = { percent: 20, until: null, note: 'spring', source: 'admin' };
    const html = render(
      page(
        { discount },
        {
          discount: {
            percent: 20,
            until: null,
            source: 'admin',
            prices: { free: 0, pro: 39.2, business: 119.2 },
          },
        },
      ),
    );
    expect(html).toContain('20% off the plans');
    expect(html).toContain('From the Badook team');
    expect(html).not.toContain('Courtesy of Badook Events');
  });
});
