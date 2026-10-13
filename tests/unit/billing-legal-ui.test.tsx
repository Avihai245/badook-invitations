// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupForm } from '@/app/(site)/(auth)/AuthForms';
import { HintProvider, ToastProvider } from '@/components/app';
import { BillingScreen } from '@/features/billing/BillingScreen.client';
import { PLAN_LIMITS, effectivePlan, type PlanId } from '@/features/billing/plans';
import type { BillingPageData } from '@/features/billing/server/billing';
import { UiProvider } from '@/lib/i18n/provider';

// The sign-up form and the billing screen with version 2 of the legal documents in force: an unticked box
// to accept the terms (sign-up), and the disclosure and box before a paid plan or a pack is paid for.
// Not in force: neither is there.

const signUp = vi.fn(async (_prev: unknown, _form: FormData) => null as unknown);
vi.mock('@/app/(site)/(auth)/actions', () => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUp: (prev: unknown, form: FormData) => signUp(prev, form),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  continueWithLink: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => signUp.mockClear());

const inUi = (locale: 'he' | 'en', node: React.ReactNode) => (
  <UiProvider locale={locale}>
    <ToastProvider label="Notice" viewportLabel="Notices" closeLabel="Close">
      <HintProvider>{node}</HintProvider>
    </ToastProvider>
  </UiProvider>
);

describe('sign-up form', () => {
  it('not in force: the passive line, no box', () => {
    render(inUi('en', <SignupForm next="/app/invitations" />));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('signup-terms').textContent).toContain('By signing up you agree');
  });

  it('in force: an unticked, required box with the documents linked, and no passive line', () => {
    render(inUi('en', <SignupForm next="/app/invitations" legal />));
    const box = screen.getByRole('checkbox', {
      name: /I have read and accept the Terms of use.*and the Privacy policy/,
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.required).toBe(true);
    expect(box.name).toBe('accept');
    expect(screen.queryByTestId('signup-terms')).toBeNull();
    const terms = screen.getByRole('link', { name: /Terms of use/ });
    expect(terms.getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: /Privacy policy/ }).getAttribute('href')).toBe('/privacy');
    expect(terms.getAttribute('target')).toBe('_blank');
  });

  it('in Hebrew too', () => {
    render(inUi('he', <SignupForm next="/app/invitations" legal />));
    expect(screen.getByRole('checkbox', { name: /קראתי ואני מאשר\/ת את תנאי השימוש/ })).toBeTruthy();
  });

  it('submitted unticked: nothing is sent, the error is tied to the box and the box has the focus', async () => {
    render(inUi('en', <SignupForm next="/app/invitations" legal />));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'dana@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'correct horse' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign up|create account/i }));
    });
    expect(signUp).not.toHaveBeenCalled();
    const box = screen.getByRole('checkbox');
    const alert = screen.getByText(/please accept the Terms of use and the Privacy policy/);
    expect(alert.getAttribute('role')).toBe('alert');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe(alert.id);
    expect(document.activeElement).toBe(box);
    // what was typed stays
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe('dana@example.com');
    // ticking clears the error
    fireEvent.click(box);
    expect(screen.queryByText(/please accept the Terms of use/)).toBeNull();
    expect(box.getAttribute('aria-invalid')).toBeNull();
  });

  it('ticked: the form is sent with the box', async () => {
    render(inUi('en', <SignupForm next="/app/invitations" legal />));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'dana@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign up|create account/i }));
    });
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp.mock.calls[0]![1].get('accept')).toBe('yes');
  });

  it('the server’s refusal (no box) is shown at the box, which takes the focus', async () => {
    signUp.mockResolvedValueOnce({ error: 'terms_required', email: 'dana@example.com' });
    render(inUi('en', <SignupForm next="/app/invitations" legal />));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'dana@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'correct horse' } });
    // the box ticked in the page, refused by the server all the same (a stale page)
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign up|create account/i }));
    });
    const alert = await screen.findByText(/please accept the Terms of use/);
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe(alert.id);
    expect(document.activeElement).toBe(screen.getByRole('checkbox'));
    // said once: the form's generic error line stays empty
    expect(screen.getAllByText(/please accept/)).toHaveLength(1);
  });
});

// ─── the billing screen ──────────────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-10-20T09:00:00Z');

function page(
  account: Partial<BillingPageData['account']> = {},
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
    packs: [{ count: 100, product: 'credits_100', price: 15.84 }],
    messagePrice: 0.1584,
    mode: 'tranzila',
    history: { checkouts: [], renewals: [], credits: [] },
    returned: null,
    ...more,
  };
}

function answerCheckout(body: Record<string, unknown>, status = 200) {
  const fetchMock = vi.fn(
    async (_url: string, _init: RequestInit) =>
      ({ ok: status < 400, status, json: async () => body }) as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const sent = (f: ReturnType<typeof answerCheckout>) =>
  f.mock.calls.map(([url, init]) => [url, JSON.parse(String(init.body))]);

describe('billing screen: before paying', () => {
  it('not in force: the button goes straight to the payment, as before', async () => {
    const f = answerCheckout({ ok: true, iframe: 'https://tz.test/form', amount: 49 });
    render(inUi('en', <BillingScreen data={page()} status={null} />));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(sent(f)).toEqual([['/api/billing/checkout', { product: 'pro' }]]);
    expect(screen.queryByTestId('purchase-review')).toBeNull();
    // the terms line links the cancellation section of the terms
    expect(screen.getByTestId('billing-terms').querySelector('a[href="/terms#cancel"]')).not.toBeNull();
  });

  it('in force, a plan: the disclosure is shown and nothing is sent until the box is ticked', async () => {
    const f = answerCheckout({ ok: true, iframe: 'https://tz.test/form', amount: 49 });
    render(inUi('en', <BillingScreen data={page()} status={null} legal />));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    const review = await screen.findByTestId('purchase-review');
    const dialog = screen.getByRole('dialog');
    // the price as the card shows it, with VAT; renewal; where to cancel; what cancelling does
    expect(dialog.textContent).toContain('Pro plan (monthly): ₪49 per month, VAT included.');
    expect(review.textContent).toContain(
      'renews automatically every month on the same date until you cancel',
    );
    expect(review.textContent).toContain('Plan & billing → Cancel subscription');
    expect(review.textContent).toContain('takes effect immediately');
    expect(review.textContent).toContain('stays active until the end of the period you paid for');
    for (const href of ['/terms', '/refunds', '/privacy'])
      expect(review.querySelector(`a[href="${href}"]`)).not.toBeNull();
    const box = screen.getByRole('checkbox', {
      name: 'I have read and accept the Terms, the Refund and cancellation policy and the Privacy policy.',
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    // continue without the box: refused, error tied to the box, focus on it, nothing sent
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    const alert = screen.getByRole('alert');
    expect(box.getAttribute('aria-describedby')).toBe(alert.id);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(box);
    expect(f).not.toHaveBeenCalled();
    // tick, continue: the request carries the acceptance, and the card form opens
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    await waitFor(() => expect(screen.getByTestId('payment-frame')).toBeTruthy());
    expect(sent(f)).toEqual([['/api/billing/checkout', { product: 'pro', accepted: true }]]);
    expect(screen.queryByTestId('purchase-review')).toBeNull();
  });

  it('in force, a pack: one-time purchase, credits do not expire, no renewal text', async () => {
    const f = answerCheckout({ ok: true, url: 'https://pay.test' });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(inUi('en', <BillingScreen data={page()} status={null} legal />));
    // the pack’s price as it is charged, not rounded to whole shekels
    expect(screen.getByText('₪15.84')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    const review = await screen.findByTestId('purchase-review');
    expect(screen.getByRole('dialog').textContent).toContain(
      '100 WhatsApp messages: ₪15.84, VAT included. A one-time purchase; credits do not expire.',
    );
    expect(review.textContent).not.toContain('renews automatically');
    expect(review.textContent).not.toContain('Cancel subscription');
    fireEvent.click(screen.getByTestId('purchase-accept'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://pay.test'));
    expect(sent(f)).toEqual([['/api/billing/checkout', { product: 'credits_100', accepted: true }]]);
  });

  it('in force, with a partner’s discount: the discounted price that is shown', async () => {
    answerCheckout({ ok: true, iframe: 'https://tz.test/form', amount: 39.2 });
    const discount = {
      percent: 20,
      until: null,
      source: 'admin',
      prices: { free: 0, pro: 39.2, business: 119.2 } as Record<PlanId, number>,
    };
    render(inUi('en', <BillingScreen data={page({}, { discount })} status={null} legal />));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Business' }));
    expect((await screen.findByRole('dialog')).textContent).toContain('₪119.20 per month, VAT included');
  });

  it('in force: the plan chosen on the home page (?plan=) opens the disclosure instead of paying', async () => {
    const f = answerCheckout({ ok: true, iframe: 'https://tz.test/form', amount: 49 });
    render(inUi('en', <BillingScreen data={page()} status={null} start="pro" legal />));
    expect(await screen.findByTestId('purchase-review')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('in force: the server’s refusal is told to the buyer', async () => {
    answerCheckout({ ok: false, code: 'terms_not_accepted', error: 'terms_not_accepted' }, 400);
    render(inUi('en', <BillingScreen data={page()} status={null} legal />));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    await screen.findByTestId('purchase-review');
    fireEvent.click(screen.getByTestId('purchase-accept'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(
      await screen.findByText('To pay, please accept the terms. Tick the box and try again.'),
    ).toBeTruthy();
  });

  it('in force: the wording under the plans links the refund and cancellation policy, and keeps /terms#plans', () => {
    render(inUi('en', <BillingScreen data={page()} status={null} legal />));
    const terms = screen.getByTestId('billing-terms');
    expect(terms.querySelector('a[href="/terms#plans"]')).not.toBeNull();
    expect(terms.querySelector('a[href="/refunds"]')).not.toBeNull();
    expect(terms.querySelector('a[href="/terms#cancel"]')).toBeNull();
  });
});
