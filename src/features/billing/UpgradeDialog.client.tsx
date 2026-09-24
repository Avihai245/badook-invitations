'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button, Dialog } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

export type UpgradeReason =
  { code: 'plan_limit'; limit: number } | { code: 'premium_template' } | { code: 'guest_limit'; max: number };

/** The API's 402 answer → what to show (null for anything else). */
export function upgradeReason(status: number, body: unknown): UpgradeReason | null {
  if (status !== 402 || !body || typeof body !== 'object') return null;
  const b = body as { code?: unknown; limit?: unknown; max?: unknown };
  if (b.code === 'plan_limit') return { code: 'plan_limit', limit: Number(b.limit) || 1 };
  if (b.code === 'premium_template') return { code: 'premium_template' };
  if (b.code === 'guest_limit') return { code: 'guest_limit', max: Number(b.max) || 0 };
  return null;
}

/** "Your plan doesn't include this": what it allows, and the way to the plans. */
export function UpgradeDialog({ reason, onClose }: { reason: UpgradeReason; onClose: () => void }) {
  const { t, fmt, number } = useUi();
  const u = t.billing.upgrade;
  const title =
    reason.code === 'premium_template'
      ? u.premiumTitle
      : reason.code === 'guest_limit'
        ? u.guestsTitle
        : u.planLimitTitle;
  const body =
    reason.code === 'plan_limit'
      ? fmt(u.planLimitBody, { limit: number(reason.limit) })
      : reason.code === 'guest_limit'
        ? fmt(u.guestsBody, { max: number(reason.max) })
        : u.premiumBody;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={body}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {u.later}
          </Button>
          <Button icon={<Sparkles />} asChild>
            <Link href="/app/billing" data-testid="upgrade-link">
              {u.cta}
            </Link>
          </Button>
        </>
      }
    />
  );
}
