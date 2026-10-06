'use client';

import { BookOpen, LayoutTemplate, PartyPopper, Users } from 'lucide-react';
import { Button, Dialog } from '@/components/app';
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
