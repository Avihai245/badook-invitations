import { Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/app';
import type { PosterColors } from './poster';

/**
 * 9:16 template poster (§9B.3-B, app.html `.tposter`): radius 24, md shadow, the seal disc with the
 * monogram in the middle and a play badge at the bottom inline-end. With a real preview image it is
 * the background; a preview video (children) plays on top.
 */
export function TemplatePoster({
  colors,
  text,
  image,
  play = false,
  className,
  children,
}: {
  colors: PosterColors;
  /** monogram / ticket text on the seal */
  text: string;
  image?: string | null;
  play?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn('relative aspect-[9/16] overflow-hidden rounded-poster shadow-md', className)}
      style={{
        background: image
          ? `center / cover no-repeat url("${image}"), ${colors.background}`
          : colors.background,
      }}
    >
      {children}
      {image ? null : (
        <span
          aria-hidden
          className="absolute inset-0 m-auto grid aspect-square h-auto w-[26%] place-items-center rounded-full text-[13px] font-bold text-black/35 shadow-[0_4px_10px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.25)]"
          style={{ background: colors.seal }}
        >
          <bdi className="max-w-[86%] truncate">{text}</bdi>
        </span>
      )}
      {play ? (
        <span
          aria-hidden
          className="absolute end-3 bottom-3 grid size-8 place-items-center rounded-full bg-white/85 text-[#111]"
        >
          <Play size={14} />
        </span>
      ) : null}
    </div>
  );
}
