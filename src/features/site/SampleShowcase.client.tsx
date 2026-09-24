'use client';

import { Check, ExternalLink, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, PHONE_VIEWPORT, PhoneFrame, Segmented } from '@/components/app';
import { saveConsent, useConsent } from './CookieConsent.client';

export type SampleKind = 'classic' | 'video';

/** The phone's outer width (PhoneFrame: the 390px screen + two 11px bezels). */
const PHONE_OUTER = PHONE_VIEWPORT.width + 22;

/**
 * The home page's live sample (#sample): a real published invitation inside a phone — exactly the
 * layout guests get on theirs, whatever the visitor's screen — with a switch between the plain opening
 * and the same invitation with a YouTube video behind it. The phone scales to its column.
 */
export function SampleShowcase({
  samples,
  labels,
}: {
  samples: Record<SampleKind, string>;
  labels: {
    toggle: string;
    classic: string;
    video: string;
    frameTitle: string;
    replay: string;
    open: string;
    points: Record<SampleKind, readonly string[]>;
    /** the video sample before external content is allowed */
    blocked: string;
    allow: string;
  };
}) {
  const consent = useConsent();
  const [kind, setKind] = useState<SampleKind>('classic');
  const [run, setRun] = useState(0);
  const column = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.82);

  useEffect(() => {
    const el = column.current;
    if (!el) return;
    const fit = () => setScale(Math.min(0.86, el.clientWidth / PHONE_OUTER));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const name = kind === 'video' ? labels.video : labels.classic;
  return (
    // phones: the switch, the phone, then the details; wide screens: switch and details beside the phone
    <div className="grid items-center gap-x-16 gap-y-8 [grid-template-areas:'toggle'_'phone'_'details'] lg:grid-cols-[1fr_minmax(0,400px)] lg:[grid-template-areas:'toggle_phone'_'details_phone']">
      <div className="self-end [grid-area:toggle] max-lg:mx-auto">
        <Segmented<SampleKind>
          label={labels.toggle}
          value={kind}
          onValueChange={(value) => {
            setKind(value);
            setRun((n) => n + 1);
          }}
          options={[
            { value: 'classic', label: labels.classic },
            { value: 'video', label: labels.video },
          ]}
        />
      </div>
      <div className="self-start [grid-area:details]">
        <ul key={kind} className="site-swap flex flex-col gap-3" data-testid="sample-points">
          {labels.points[kind].map((point) => (
            <li key={point} className="flex items-start gap-3 text-[16px] text-pretty">
              <span
                aria-hidden
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand text-white"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-2">
          <Button variant="secondary" icon={<RotateCcw />} onClick={() => setRun((n) => n + 1)}>
            {labels.replay}
          </Button>
          <Button variant="ghost" icon={<ExternalLink className="icon-dir" />} asChild>
            <a href={samples[kind]} target="_blank" rel="noopener">
              {labels.open}
            </a>
          </Button>
        </div>
      </div>

      {/* narrower on phones: room at the sides to scroll the page past it */}
      <div ref={column} className="relative mx-auto w-full max-w-[300px] [grid-area:phone] sm:max-w-[380px]">
        <div aria-hidden className="site-glow absolute inset-[-12%] -z-10 rounded-full" />
        <div className="flex justify-center">
          {kind === 'video' && !consent?.media ? (
            // YouTube only after the visitor allows external content (cookie consent)
            <PhoneFrame scale={scale} className="shadow-[0_40px_80px_-30px_rgba(60,35,15,0.55)]">
              <div className="flex size-full flex-col items-center justify-center gap-5 bg-[linear-gradient(160deg,#3a2a1e,#15110d)] p-10 text-center text-white">
                <span aria-hidden className="grid size-16 place-items-center rounded-full bg-white/15">
                  <Play className="size-7" />
                </span>
                <p className="text-[19px] leading-snug text-pretty">{labels.blocked}</p>
                <Button size="lg" variant="secondary" onClick={() => saveConsent(true)}>
                  {labels.allow}
                </Button>
              </div>
            </PhoneFrame>
          ) : (
            <PhoneFrame
              key={`${kind}-${run}`}
              src={samples[kind]}
              title={labels.frameTitle.replace('{kind}', name)}
              scale={scale}
              loading="lazy"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              className="shadow-[0_40px_80px_-30px_rgba(60,35,15,0.55)]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
