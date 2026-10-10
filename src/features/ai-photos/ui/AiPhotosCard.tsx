'use client';

import { Crown, Settings2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, CardTitle, Hint, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import type { HostAiView } from '../types';

/**
 * The AI photos' card in the gallery tab (feature ai_photos): whether guests can make photos with the
 * people of honor, how many were made, and the way to the setup. Without the feature: the package that
 * has it, or the switch.
 */
export function AiPhotosCard({ initial }: { initial: HostAiView }) {
  const { t, fmt, number } = useUi();
  const P = t.aiPhotos;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const f = view.feature;
  const s = view.settings;

  const switchOn = async () => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${view.id}/features`, {
      method: 'PATCH',
      body: { feature: 'ai_photos', off: false },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    const fresh = res.ok
      ? await hostApi<{ view: HostAiView }>(`/api/invitations/${view.id}/ai-photos`)
      : null;
    setBusy(false);
    if (fresh?.ok && fresh.body?.view) setView(fresh.body.view);
    else toast({ title: P.failed, variant: 'danger' });
  };

  const ready = s.enabled && view.people.some((p) => p.photo);
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid="ai-photos-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle as="h2" className="mb-0">
              {P.card.title}
            </CardTitle>
            {f.on ? (
              <Badge variant={ready ? 'live' : view.people.length ? 'neutral' : 'draft'}>
                {ready ? P.card.on : view.people.length ? P.card.off : P.card.setup}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-muted">{P.card.body}</p>
        </div>
      </div>
      {!f.on && f.why === 'plan' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]">
          <Crown aria-hidden className="size-4 text-brand-deep" />
          <span>{fmt(P.plan.title, { plan: P.plans[f.plan] })}</span>
          <Link href={`/app/billing?plan=${f.plan}`} className="font-semibold text-brand-deep underline">
            {fmt(P.plan.cta, { plan: P.plans[f.plan] })}
          </Link>
        </div>
      ) : !f.on ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-muted">{P.off.title}</p>
          <Button size="sm" icon={<Sparkles />} loading={busy} onClick={() => void switchOn()}>
            {P.off.cta}
          </Button>
        </div>
      ) : (
        <>
          {view.counts.used ? (
            <p className="text-[13px] font-semibold">
              {fmt(P.card.counts, {
                done: number(view.counts.done),
                used: number(view.counts.used),
                limit: number(s.perEvent),
              })}
            </p>
          ) : null}
          {!view.gallery ? <p className="text-[12.5px] text-warning">{P.noGallery}</p> : null}
          <div>
            <Hint text={P.card.openHint}>
              <Button size="sm" icon={<Settings2 />} asChild>
                <Link href={`/app/invitations/${view.id}/gallery/ai`} data-testid="ai-photos-setup">
                  {P.card.open}
                </Link>
              </Button>
            </Hint>
          </div>
        </>
      )}
    </Card>
  );
}
