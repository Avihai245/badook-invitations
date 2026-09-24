'use client';

import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Button, Card } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { Product } from './plans';

/** The test payment page: pays or fails the purchase, then goes back to billing like PayPlus would. */
export function TestCheckout({ id, product, amount }: { id: string; product: Product; amount: number }) {
  const { t, locale } = useUi();
  const b = t.billing;
  const [busy, setBusy] = useState(false);
  const finish = async (outcome: 'paid' | 'failed') => {
    setBusy(true);
    await fetch('/api/billing/test-complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, outcome }),
    });
    window.location.assign(
      `/app/billing?status=${outcome === 'paid' ? 'success' : 'failure'}&checkout=${id}`,
    );
  };
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card padding="lg" className="flex flex-col gap-4 text-center">
        <FlaskConical aria-hidden className="mx-auto size-10 text-brand" />
        <h1 className="text-[22px] font-bold">{b.test.title}</h1>
        <p className="text-muted">{b.test.body}</p>
        <p className="text-[17px] font-semibold">{b.products[product]}</p>
        <p className="font-display text-[34px] font-bold">
          {new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
            style: 'currency',
            currency: 'ILS',
          }).format(amount)}
        </p>
        <div className="flex justify-center gap-2">
          <Button disabled={busy} onClick={() => void finish('paid')}>
            {b.test.pay}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void finish('failed')}>
            {b.test.fail}
          </Button>
        </div>
      </Card>
    </div>
  );
}
