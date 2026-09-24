import type { ReactNode, Ref } from 'react';
import { cn } from './utils';

/** Viewport of the framed "phone" — the iframe gets exactly this size, like a real device (§7). */
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const BEZEL = 11;
const OUTER_W = PHONE_VIEWPORT.width + BEZEL * 2; // 412
const OUTER_H = PHONE_VIEWPORT.height + BEZEL * 2; // 866

type Common = {
  /**
   * Visual scale (transform from the center). Negative margins compensate so the layout box matches
   * the scaled size (app.html `.phone`: scale .72 + margin -118px). Default 1.
   */
  scale?: number;
  className?: string;
};

export type PhoneFrameProps = Common &
  (
    | {
        /** Renders an iframe (the editor preview frame). */
        src: string;
        /** Accessible title of the iframe. */
        title: string;
        iframeRef?: Ref<HTMLIFrameElement>;
        /** `lazy`: load only when scrolled near (a phone further down a page). */
        loading?: 'lazy' | 'eager';
        /** Permissions for the page inside (e.g. autoplay for its own embedded players). */
        allow?: string;
        children?: never;
      }
    | { children: ReactNode; src?: never; title?: never; iframeRef?: never; loading?: never; allow?: never }
  );

/** Phone mock-up (§9B.2): 390×844 screen, 11px #111 bezel, 52px outer / 42px inner radius, lg shadow. */
export function PhoneFrame({ scale = 1, className, ...rest }: PhoneFrameProps) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return (
    // the outer box carries the size, the scale and the shadow; the bezel inside is clipped to its
    // rounded shape (clip-path: with a scale transform, border-radius alone leaves the corners of the
    // page's own layers poking out in Chromium)
    <div
      className={cn('shrink-0 rounded-[52px] shadow-lg', className)}
      style={{
        width: OUTER_W,
        height: OUTER_H,
        ...(s !== 1 && {
          transform: `scale(${s})`,
          transformOrigin: 'center',
          marginBlock: (-OUTER_H * (1 - s)) / 2,
          marginInline: (-OUTER_W * (1 - s)) / 2,
        }),
      }}
    >
      <div className="size-full rounded-[52px] bg-[#111] p-[11px] [clip-path:inset(0_round_52px)]">
        {rest.src !== undefined ? (
          <iframe
            ref={rest.iframeRef}
            src={rest.src}
            title={rest.title}
            loading={rest.loading}
            allow={rest.allow}
            className="block size-full rounded-[42px] border-0 bg-white [clip-path:inset(0_round_42px)]"
          />
        ) : (
          <div className="relative size-full overflow-hidden rounded-[42px] bg-white">{rest.children}</div>
        )}
      </div>
    </div>
  );
}
