'use client';

import { BookOpen, LayoutTemplate, PartyPopper, Play, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Dialog, IconButton } from '@/components/app';
import { imageSet } from '@/features/invitations/renderer/images';
import files from '@/features/site/site-video.generated.json';
import { openHelp } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';

/** The seating tutorial's files (video/src/seating, `npm run video:seating`): muted, captions in the picture. */
export const SEATING_VIDEO = {
  landscape: files.seating.landscape,
  portrait: files.seating.portrait,
  poster: files.seating.poster,
} as const;

/**
 * "Seat like the pros": the 30-second film of the whole flow — the hall (a picture from the venue, or
 * a ready-made one), tables, families, auto-seating with rules in words, printing and sending, and the
 * live map on the day — with three tips under it and the full guide a click away.
 */
export function SeatingTutorial({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useUi();
  const L = t.seating.learn;
  const tips = [
    { icon: <LayoutTemplate />, text: L.tips.start },
    { icon: <Users />, text: L.tips.families },
    { icon: <PartyPopper />, text: L.tips.day },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={L.title}
      description={L.body}
      closeLabel={t.common.close}
      className="max-w-[860px]"
      footer={
        <Button
          variant="secondary"
          icon={<BookOpen />}
          onClick={() => {
            onOpenChange(false);
            openHelp({ article: 'seating' });
          }}
        >
          {L.guide}
        </Button>
      }
    >
      {open ? (
        <video
          className="mt-1 max-h-[62dvh] w-full rounded-[14px] bg-subtle"
          poster={SEATING_VIDEO.poster}
          autoPlay
          muted
          controls
          playsInline
          preload="metadata"
          data-testid="seating-tutorial-video"
        >
          <source
            src={SEATING_VIDEO.portrait}
            type="video/mp4"
            media="(max-width: 640px) and (orientation: portrait)"
          />
          <source src={SEATING_VIDEO.landscape} type="video/mp4" />
        </video>
      ) : null}
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2.5 rounded-[14px] bg-subtle px-3 py-2.5 text-[13px] leading-snug">
            <span aria-hidden className="mt-0.5 shrink-0 text-brand-deep [&_svg]:size-4">
              {tip.icon}
            </span>
            {tip.text}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** Closed (or watched) once, the card stays closed — for every event, in this browser. */
const CARD_KEY = 'seating:learn-card';

/**
 * The first time a host opens the seating: the film as a card above the map — its picture with a play
 * button, what it shows, "watch" and "not now". Watched or closed, it doesn't come back (the header's
 * "video guide" stays). Nothing is drawn until the browser has said whether it was seen, so a host who
 * closed it never sees it flash.
 */
export function LearnCard({ onPlay }: { onPlay: () => void }) {
  const { t } = useUi();
  const L = t.seating.learn;
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(CARD_KEY) !== '0');
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  const seen = () => {
    setShow(false);
    try {
      window.localStorage.setItem(CARD_KEY, '0');
    } catch {
      /* closed for this visit */
    }
  };
  const play = () => {
    seen();
    onPlay();
  };
  const poster = imageSet(SEATING_VIDEO.poster, '(min-width: 640px) 208px, 120px', 75);
  return (
    <section
      aria-label={L.card.title}
      data-testid="seating-learn-card"
      className="relative mt-4 flex items-center gap-3 rounded-[20px] border border-brand-line bg-linear-to-br from-brand-soft/80 to-surface p-3 pe-11 shadow-sm sm:gap-5 sm:p-4 sm:pe-12"
    >
      <button
        type="button"
        onClick={play}
        aria-label={L.card.play}
        className="group relative block w-[120px] shrink-0 overflow-hidden rounded-[14px] bg-subtle shadow-sm sm:w-[208px]"
      >
        {/* a plain <img> over the optimizer's widths (renderer/images.ts), like the site's videos */}
        <img
          src={poster.src}
          srcSet={poster.srcSet}
          sizes={poster.sizes}
          alt=""
          width={1280}
          height={720}
          decoding="async"
          className="block aspect-video w-full object-cover"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/25">
          <span className="grid size-10 place-items-center rounded-full bg-brand-deep text-white shadow-lg ring-4 ring-white/70 transition-transform group-hover:scale-105 sm:size-12 dark:text-[#1c1917]">
            <Play aria-hidden className="size-5 translate-x-[1px] sm:size-6" fill="currentColor" />
          </span>
        </span>
        <span className="absolute start-1.5 bottom-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {L.card.length}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15.5px] font-bold sm:text-[17px]">{L.card.title}</h2>
        <p className="mt-1 text-[13px] leading-snug text-ink/80 max-sm:line-clamp-3 sm:text-[14px]">
          {L.card.body}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            icon={<Play fill="currentColor" />}
            onClick={play}
            data-testid="seating-learn-play"
          >
            {L.card.play}
          </Button>
          <Button size="sm" variant="ghost" onClick={seen} className="max-sm:hidden">
            {L.card.dismiss}
          </Button>
        </div>
      </div>
      <IconButton label={t.common.close} size="sm" onClick={seen} className="absolute end-2 top-2">
        <X />
      </IconButton>
    </section>
  );
}
