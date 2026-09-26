'use client';

import { Check, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Badge, Button, Hint, PhoneFrame, cn } from '@/components/app';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { usePreviewChannel } from '@/features/invitations/editor/preview/usePreviewChannel';
import { findFontPair } from '@/features/invitations/fonts/library';
import { getTemplate } from '@/features/invitations/templates/registry';
import { isPremiumTemplate } from '@/features/invitations/templates/tier';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { Concept } from '../model';
import type { ConceptsResult } from './useStudio';

/**
 * The three concepts, each live in a phone through the invitation's own renderer (the editor's
 * preview frame, sent the document the concept would make): side by side on a computer, one at a time
 * on a phone — swiped, or with the arrows. Each says what it is and why, and can be chosen.
 */
export function ConceptsView({
  result,
  docFor,
  locale,
  cinematic,
  photosIn,
  using,
  onUse,
}: {
  result: ConceptsResult;
  /** the document a concept makes (its preview) */
  docFor: (concept: Concept) => InvitationDocument | null;
  locale: Locale;
  cinematic: boolean;
  /** how many of the photos a concept puts on the invitation */
  photosIn: (concept: Concept) => number;
  /** the concept being applied */
  using: string | null;
  onUse: (concept: Concept) => void;
}) {
  const { t } = useUi();
  const a = t.studio.art;
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const total = result.concepts.length;

  // which one is in view on a phone (the track scrolls sideways there)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting && e.intersectionRatio > 0.6) setAt(cards.indexOf(e.target as HTMLElement));
      },
      { root: el, threshold: [0.6] },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [result]);

  const go = (i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="studio-concepts" data-source={result.source}>
      <p className="flex items-start gap-2 rounded-input bg-subtle px-3 py-2 text-[12.5px] text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {result.source === 'ai' ? a.sourceAi : a.sourceComposer}
          {result.reason ? ` · ${a.fallback[result.reason]}` : ''}
        </span>
      </p>
      <div
        ref={track}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {result.concepts.map((c, i) => (
          <ConceptCard
            key={`${c.id}-${c.templateId}-${c.fontPairId}`}
            concept={c}
            n={i + 1}
            total={total}
            doc={docFor(c)}
            locale={locale}
            cinematic={cinematic}
            photos={photosIn(c)}
            using={using}
            onUse={() => onUse(c)}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronLeft className="icon-dir" />}
          onClick={() => go(Math.max(0, at - 1))}
          disabled={at === 0}
        >
          {a.prev}
        </Button>
        <span className="text-[12.5px] text-muted" aria-live="polite">
          {fmt(a.conceptOf, { n: at + 1, total })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronRight className="icon-dir" />}
          onClick={() => go(Math.min(total - 1, at + 1))}
          disabled={at >= total - 1}
        >
          {a.next}
        </Button>
      </div>
    </div>
  );
}

function ConceptCard({
  concept,
  n,
  total,
  doc,
  locale,
  cinematic,
  photos,
  using,
  onUse,
}: {
  concept: Concept;
  n: number;
  total: number;
  doc: InvitationDocument | null;
  locale: Locale;
  cinematic: boolean;
  photos: number;
  using: string | null;
  onUse: () => void;
}) {
  const { t, locale: ui, plural } = useUi();
  const a = t.studio.art;
  const frame = useRef<HTMLIFrameElement>(null);
  const titleId = useId();
  usePreviewChannel(frame, { doc, locale, cinematic });
  const entry = getTemplate(concept.templateId);
  const m = entry?.manifest;
  const pair = m ? findFontPair(m, concept.fontPairId) : undefined;
  const templateName = m ? (m.name[ui] ?? m.name.en ?? m.id) : concept.templateId;
  const busy = using === concept.id;
  return (
    <article
      aria-labelledby={titleId}
      aria-roledescription={fmt(a.conceptOf, { n, total })}
      className="flex w-[min(320px,80vw)] shrink-0 snap-center flex-col items-center gap-3 rounded-card border border-line bg-surface p-3 lg:w-auto"
      data-testid="studio-concept"
      data-template={concept.templateId}
    >
      <PhoneFrame
        src={`/app/preview-frame/${concept.templateId}`}
        title={fmt(a.previewTitle, { n, name: concept.name })}
        iframeRef={frame}
        scale={0.66}
      />
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">{fmt(a.concept, { n })}</span>
          {m && isPremiumTemplate(m) ? <Badge variant="warning">{a.premium}</Badge> : null}
        </div>
        <h3 id={titleId} className="text-[15px] leading-snug font-bold">
          <bdi>{concept.name}</bdi>
        </h3>
        <p className="text-[13px] leading-relaxed text-muted">
          <bdi>{concept.rationale}</bdi>
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          <dt className="text-muted">{a.details.template}</dt>
          <dd className="truncate">{templateName}</dd>
          <dt className="text-muted">{a.details.fonts}</dt>
          <dd className="truncate" dir="ltr" style={{ textAlign: 'start' }}>
            {pair ? `${pair.display.latin} · ${pair.display.hebrew}` : concept.fontPairId}
          </dd>
          {cinematic ? (
            <>
              <dt className="text-muted">{a.details.opening}</dt>
              <dd>{a.openings[concept.opening]}</dd>
              <dt className="text-muted">{a.details.motion}</dt>
              <dd>{a.motions[concept.motion]}</dd>
            </>
          ) : null}
          <dt className="text-muted">{a.details.photos}</dt>
          <dd>{plural(a.details.photosValue, photos)}</dd>
        </dl>
        <span aria-hidden className="flex gap-1.5 pt-1">
          {[concept.palette.bg, concept.palette.surface, concept.palette.accent, concept.palette.ink].map(
            (c, i) => (
              <span
                key={i}
                className="size-5 rounded-full border border-black/10"
                style={{ background: c }}
              />
            ),
          )}
        </span>
        <Hint text={a.useHint}>
          <Button
            icon={<Check />}
            loading={busy}
            disabled={!!using && !busy}
            onClick={onUse}
            className={cn('mt-1 w-full')}
            data-testid="studio-use"
          >
            {busy ? a.using : a.use}
          </Button>
        </Hint>
      </div>
    </article>
  );
}
