'use client';

import { CheckCircle2, CircleAlert, Coins, CreditCard, History, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AreaHelp, Badge, Button, Card, Dialog, Hint, KpiCard, useToast } from '@/components/app';
import { PlanCards } from '@/features/site/PlanCards';
import { useUi } from '@/lib/i18n/client';
import type { PlanId, Product } from './plans';
import type { BillingPageData } from './server/billing';

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { url?: string; code?: string } | null;
  return { ok: !!res?.ok, status: res?.status ?? 0, body: json };
};

/**
 * /app/billing: the plan in force and what it allows, the plans side by side (upgrade, switch, cancel),
 * message packs, and the history. Coming back from the payment page it says how the payment ended —
 * and while the provider's notice is still on its way, it checks again by itself. `start`: the plan
 * chosen on the home page (?plan=), on to its payment page right away.
 */
export function BillingScreen({
  data,
  status,
  start = null,
}: {
  data: BillingPageData;
  status: string | null;
  start?: 'pro' | 'business' | null;
}) {
  const { t, locale, fmt, number, date } = useUi();
  const b = t.billing;
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<Product | 'cancel' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const a = data.account;
  const off = data.mode === 'off';
  const money = (v: number, digits = 0) =>
    new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v);
  const renews = a.planRenewsAt
    ? date(a.planRenewsAt, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // back from the payment page while its notice hasn't arrived yet: look again in a moment
  const pending = data.returned?.status === 'pending' && status === 'success';
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [pending, router]);

  const buy = async (product: Product) => {
    setBusy(product);
    const res = await post('/api/billing/checkout', { product });
    if (res.status === 401)
      return window.location.assign(`/login?next=${encodeURIComponent('/app/billing')}`);
    if (res.ok && res.body?.url) return window.location.assign(res.body.url);
    setBusy(null);
    toast({
      title:
        res.body?.code === 'already'
          ? b.errors.already
          : res.body?.code === 'not_configured'
            ? b.errors.not_configured
            : b.errors.server,
      variant: 'danger',
    });
  };

  // once: the address drops ?plan= first, so coming back from the payment page doesn't start again
  const started = useRef(false);
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    window.history.replaceState(null, '', '/app/billing');
    if (off) return;
    if (a.effective === start && a.planStatus !== 'canceled') toast({ title: b.errors.already });
    else void buy(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const cancel = async () => {
    setBusy('cancel');
    const res = await post('/api/billing/cancel', {});
    setBusy(null);
    setConfirmCancel(false);
    if (!res.ok) return toast({ title: b.errors.server, variant: 'danger' });
    toast({ title: fmt(b.cancel.done, { date: renews }), variant: 'success' });
    router.refresh();
  };

  const statusLine = a.admin
    ? b.status.admin
    : a.plan === 'free'
      ? b.status.activeFree
      : a.planStatus === 'canceled'
        ? fmt(b.status.canceled, { date: renews })
        : a.planStatus === 'past_due'
          ? fmt(b.status.past_due, { date: renews })
          : fmt(b.status.active, { date: renews });

  const planAction = (plan: PlanId) => {
    if (plan === 'free')
      return a.plan !== 'free' && a.planStatus !== 'canceled' ? (
        <Hint text={b.help.cancel}>
          <Button fullWidth variant="secondary" onClick={() => setConfirmCancel(true)}>
            {b.toFree}
          </Button>
        </Hint>
      ) : null;
    const label =
      a.plan === 'free' || a.planStatus === 'canceled'
        ? b.choose[plan]
        : plan === 'pro'
          ? b.choose.switchPro
          : b.choose.switchBusiness;
    return (
      <Hint text={b.help.choose}>
        <Button
          fullWidth
          variant={plan === 'pro' ? 'primary' : 'secondary'}
          disabled={off || busy !== null}
          loading={busy === plan}
          onClick={() => void buy(plan)}
        >
          {busy === plan ? b.going : label}
        </Button>
      </Hint>
    );
  };

  // how the payment the visitor came back from ended: our record decides, not the address they came to
  const returned: keyof typeof b.returned | null =
    !status || !data.returned
      ? null
      : data.returned.status === 'paid'
        ? 'success'
        : data.returned.status === 'pending'
          ? status === 'success'
            ? 'pending'
            : status === 'cancel'
              ? 'cancel'
              : 'failure'
          : data.returned.status === 'canceled'
            ? 'cancel'
            : 'failure';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 sm:px-6">
      <div className="flex items-center gap-1">
        <h1 className="text-[26px] font-bold tracking-[-.01em]">{b.title}</h1>
        <AreaHelp
          label={t.common.helpLabel}
          title={t.common.helpTitle}
          items={[
            { icon: <CreditCard />, label: b.choose.pro, text: b.help.choose },
            { icon: <XCircle />, label: b.cancel.button, text: b.help.cancel },
            { icon: <Coins />, label: b.packs.buy, text: b.help.buy },
          ]}
        />
      </div>
      <p className="mt-1 text-muted">{b.subtitle}</p>

      {returned ? (
        <p
          role="status"
          data-testid="billing-returned"
          className={
            returned === 'success'
              ? 'mt-5 flex items-center gap-2 rounded-card border border-[#bbf7d0] bg-success-bg px-4 py-3 text-[14px] text-success'
              : returned === 'pending'
                ? 'mt-5 flex items-center gap-2 rounded-card border border-line bg-subtle px-4 py-3 text-[14px]'
                : 'mt-5 flex items-center gap-2 rounded-card border border-[#fecaca] bg-danger-bg px-4 py-3 text-[14px] text-danger'
          }
        >
          {returned === 'success' ? (
            <CheckCircle2 aria-hidden className="size-5" />
          ) : (
            <CircleAlert aria-hidden className="size-5" />
          )}
          {b.returned[returned]}
        </p>
      ) : null}

      {off ? (
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-[#fde68a] bg-warning-bg px-4 py-3 text-[14px] text-warning">
          {b.off}
          <Link href="/contact?topic=billing" className="font-semibold underline">
            {b.contact}
          </Link>
        </p>
      ) : null}

      <Card padding="lg" className="mt-6" data-testid="current-plan">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-muted">{b.current}</p>
            <p className="mt-1 flex items-center gap-2 text-[26px] font-bold">
              {t.site.plans.names[a.effective]}
              {a.planStatus === 'canceled' && a.plan !== 'free' ? (
                <Badge variant="warning">{b.history.statuses.canceled}</Badge>
              ) : null}
              {a.planStatus === 'past_due' ? (
                <Badge variant="danger">{b.history.statuses.failed}</Badge>
              ) : null}
            </p>
            <p className="mt-1 text-[14px] text-muted">{statusLine}</p>
          </div>
          {a.plan !== 'free' && a.planStatus !== 'canceled' && !a.admin ? (
            <Hint text={b.help.cancel}>
              <Button variant="ghost" icon={<XCircle />} onClick={() => setConfirmCancel(true)}>
                {b.cancel.button}
              </Button>
            </Hint>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <KpiCard
            label={b.usage.invitations}
            value={
              a.limits.activeInvitations === null
                ? fmt(b.usage.unlimited, { used: number(a.activeInvitations) })
                : fmt(b.usage.of, {
                    used: number(a.activeInvitations),
                    limit: number(a.limits.activeInvitations),
                  })
            }
          />
          <KpiCard label={b.usage.guests} value={number(a.limits.guestsPerInvitation)} />
          <KpiCard label={b.usage.credits} value={number(a.credits)} sub={b.usage.creditsHint} />
        </div>
      </Card>

      <h2 className="mt-10 text-[20px] font-bold">{b.plans}</h2>
      <div className="mt-4">
        <PlanCards t={t} locale={locale} prices={data.prices} current={a.effective} action={planAction} />
      </div>
      {!off ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <ShieldCheck aria-hidden className="size-4 text-success" />
          {b.secure} {t.site.plans.vat}
        </p>
      ) : null}

      <section id="credits" className="mt-12 scroll-mt-20">
        <h2 className="text-[20px] font-bold">{b.packs.title}</h2>
        <p className="mt-1 text-[14px] text-muted">{b.packs.subtitle}</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {data.packs.map((p) => (
            <li key={p.product}>
              <Card padding="lg" className="flex h-full flex-col gap-2" data-pack={p.count}>
                <p className="flex items-center gap-2 text-[17px] font-bold">
                  <Coins aria-hidden className="size-5 text-brand" />
                  {fmt(b.packs.count, { n: number(p.count) })}
                </p>
                <p className="font-display text-[30px] leading-none font-bold">{money(p.price)}</p>
                <p className="text-[13px] text-muted">
                  {fmt(b.packs.per, { price: money(data.messagePrice, 2) })}
                </p>
                <Hint text={b.help.buy}>
                  <Button
                    className="mt-auto"
                    variant="secondary"
                    disabled={off || busy !== null}
                    loading={busy === p.product}
                    onClick={() => void buy(p.product)}
                  >
                    {busy === p.product ? b.going : b.packs.buy}
                  </Button>
                </Hint>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-[20px] font-bold">
          <History aria-hidden className="size-5 text-muted" />
          {b.history.title}
        </h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <p className="border-b border-line px-4 py-3 text-[14px] font-semibold">{b.history.payments}</p>
            {data.history.checkouts.length ? (
              <ul className="divide-y divide-line text-[14px]" data-testid="payments">
                {data.history.checkouts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.products[c.product]}</p>
                      <p className="text-[12px] text-muted">
                        {date(c.completedAt ?? c.createdAt, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{money(Number(c.amount), 2)}</span>
                      <Badge
                        variant={c.status === 'paid' ? 'live' : c.status === 'failed' ? 'danger' : 'neutral'}
                      >
                        {b.history.statuses[c.status]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-[14px] text-muted">{b.history.none}</p>
            )}
          </Card>
          <Card className="overflow-hidden">
            <p className="border-b border-line px-4 py-3 text-[14px] font-semibold">{b.history.credits}</p>
            {data.history.credits.length ? (
              <ul className="divide-y divide-line text-[14px]">
                {data.history.credits.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate">
                        {b.history.reasons[c.reason as keyof typeof b.history.reasons] ?? c.reason}
                      </p>
                      <p className="text-[12px] text-muted">
                        {date(c.at, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className={
                        c.delta > 0 ? 'font-semibold text-success tabular-nums' : 'text-muted tabular-nums'
                      }
                      dir="ltr"
                    >
                      {c.delta > 0 ? `+${number(c.delta)}` : number(c.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-[14px] text-muted">{b.history.none}</p>
            )}
          </Card>
        </div>
      </section>

      {confirmCancel ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setConfirmCancel(false)}
          title={b.cancel.title}
          description={fmt(b.cancel.body, { date: renews })}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                {b.cancel.keep}
              </Button>
              <Button variant="danger" loading={busy === 'cancel'} onClick={() => void cancel()}>
                {b.cancel.confirm}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
