'use client';

import { Crown, Film } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardTitle, Hint } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/**
 * The highlights film in the gallery tab (feature auto_reel): what it is, and the way into its
 * studio — or the package that has it.
 */
export function FilmCard({
  id,
  feature,
}: {
  id: string;
  feature: {
    on: boolean;
    why: 'unavailable' | 'switched_off' | 'plan' | null;
    plan: 'free' | 'pro' | 'business';
  };
}) {
  const { t, fmt } = useUi();
  const F = t.film;
  const planName = t.liveGallery.plans[feature.plan];
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid="gallery-film">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <Film className="size-[18px]" />
        </span>
        <div>
          <CardTitle as="h2" className="mb-1">
            {F.card.title}
          </CardTitle>
          <p className="text-[13px] text-muted">{F.card.body}</p>
        </div>
      </div>
      {feature.why === 'plan' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]">
          <Crown aria-hidden className="size-4 text-brand-deep" />
          <span>{fmt(F.plan.title, { plan: planName })}</span>
          <Link
            href={`/app/billing?plan=${feature.plan}`}
            className="font-semibold text-brand-deep underline"
          >
            {fmt(F.plan.cta, { plan: planName })}
          </Link>
        </div>
      ) : (
        <Hint text={F.card.hint}>
          <Button size="sm" icon={<Film />} className="w-fit" asChild>
            <Link href={`/app/invitations/${id}/gallery/film`} data-testid="gallery-film-open">
              {F.card.cta}
            </Link>
          </Button>
        </Hint>
      )}
    </Card>
  );
}
