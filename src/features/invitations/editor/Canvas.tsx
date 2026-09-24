'use client';

import { ExternalLink, Eye, Play } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, Hint, PhoneFrame, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { useEditor } from './state/EditorProvider';

export type Device = 'mobile' | 'desktop';

const DESKTOP = { width: 1280, height: 800, bar: 28 } as const;

/** Scale that fits a w×h frame into the canvas (§9B.3-D: min(1, (canvasHeight − 120) / 844)). */
function useFitScale(ref: RefObject<HTMLElement | null>, w: number, h: number): number {
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.25, Math.min(1, (height - 120) / h, (width - 48) / w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, w, h]);
  return scale;
}

/** The live preview (§9B.3-D canvas): dot grid, "live" chip, the phone (or a desktop browser) iframe. */
export function Canvas({
  device,
  frame,
  onReplay,
  onOpenTab,
  className,
}: {
  device: Device;
  frame: RefObject<HTMLIFrameElement | null>;
  onReplay: () => void;
  /** full-page preview of the saved draft in a new tab */
  onOpenTab: () => void;
  className?: string;
}) {
  const { template } = useEditor();
  const { t } = useUi();
  const c = t.editor.canvas;
  const box = useRef<HTMLDivElement>(null);
  const phoneScale = useFitScale(box, 412, 866);
  const desktopScale = useFitScale(box, DESKTOP.width, DESKTOP.height + DESKTOP.bar);
  const src = `/app/preview-frame/${template.id}`;
  return (
    <div
      ref={box}
      className={cn(
        'relative flex flex-col items-center justify-center gap-3.5 overflow-hidden bg-canvas-editor bg-[radial-gradient(#D6D3D1_1px,transparent_1px)] [background-size:16px_16px]',
        className,
      )}
    >
      <span className="absolute start-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-sm">
        <Eye aria-hidden size={14} strokeWidth={1.75} />
        <span>
          {c.live} ·{' '}
          <span dir="ltr">{device === 'mobile' ? '390×844' : `${DESKTOP.width}×${DESKTOP.height}`}</span>
        </span>
      </span>
      {device === 'mobile' ? (
        <PhoneFrame src={src} title={c.frameTitle} iframeRef={frame} scale={phoneScale} />
      ) : (
        <div
          className="shrink-0 overflow-hidden rounded-[12px] border border-line bg-surface shadow-lg"
          style={{
            width: DESKTOP.width,
            height: DESKTOP.height + DESKTOP.bar,
            transform: `scale(${desktopScale})`,
            transformOrigin: 'center',
            marginBlock: (-(DESKTOP.height + DESKTOP.bar) * (1 - desktopScale)) / 2,
            marginInline: (-DESKTOP.width * (1 - desktopScale)) / 2,
          }}
        >
          <div
            aria-hidden
            className="flex h-7 items-center gap-1.5 border-b border-line bg-subtle px-3"
            dir="ltr"
          >
            <span className="size-2.5 rounded-full bg-[#F87171]" />
            <span className="size-2.5 rounded-full bg-[#FBBF24]" />
            <span className="size-2.5 rounded-full bg-[#34D399]" />
          </div>
          <iframe
            ref={frame}
            src={src}
            title={c.frameTitle}
            className="block border-0 bg-white"
            style={{ width: DESKTOP.width, height: DESKTOP.height }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Hint text={c.replayHint}>
          <Button variant="secondary" size="sm" icon={<Play />} onClick={onReplay}>
            {c.replay}
          </Button>
        </Hint>
        <Hint text={c.openTabHint}>
          <Button variant="ghost" size="sm" icon={<ExternalLink className="icon-dir" />} onClick={onOpenTab}>
            {c.openTab}
          </Button>
        </Hint>
      </div>
    </div>
  );
}
