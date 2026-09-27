'use client';

import { Crown, ExternalLink, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { Button, Hint } from '@/components/app';
import { packageFor } from '@/features/flags/features';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { StudioWizard } from './StudioWizard';

/**
 * The gallery's "design it from my photos" (feature `art_direction`): a card above the designs that
 * opens the studio's wizard — or, when the host's plan doesn't include it, says which package does.
 */
export function StudioEntry({
  access,
  cinematic,
  moreLanguages = true,
}: {
  access: 'on' | 'plan';
  cinematic: boolean;
  /** languages beyond Hebrew and English (feature `languages`) */
  moreLanguages?: boolean;
}) {
  const { t } = useUi();
  const a = t.studio.art;
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-labelledby="studio-entry-title"
      className="mt-5 flex flex-col gap-3 rounded-card border border-brand-line bg-[linear-gradient(135deg,#fffaf3,#fdf2f8)] dark:bg-[linear-gradient(135deg,#1d1812,#1a1519)] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
      data-testid="studio-entry"
    >
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[#2b2118] text-[#f3d98b]"
      >
        {access === 'plan' ? <Crown className="size-5" /> : <WandSparkles className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="studio-entry-title" className="text-[16px] font-bold">
          {access === 'plan'
            ? fmt(a.offTitle, { package: t.seating.packages[packageFor('art_direction')] })
            : a.galleryTitle}
        </h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          {access === 'plan' ? a.offBody : a.galleryBody}
        </p>
      </div>
      {access === 'plan' ? (
        <Button variant="secondary" icon={<ExternalLink className="icon-dir" />} asChild>
          <a href="/app/billing">{a.offCta}</a>
        </Button>
      ) : (
        <Hint text={a.galleryCtaHint}>
          <Button icon={<WandSparkles />} onClick={() => setOpen(true)} data-testid="studio-start">
            {a.galleryCta}
          </Button>
        </Hint>
      )}
      {open ? (
        <StudioWizard cinematic={cinematic} moreLanguages={moreLanguages} onClose={() => setOpen(false)} />
      ) : null}
    </section>
  );
}
