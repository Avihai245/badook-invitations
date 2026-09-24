import type { ReactNode } from 'react';
import { Reveal } from '../Reveal.client';
import { Play } from './Play.client';
import { MomentScene, type MomentKey, type SceneText } from './scenes';

/**
 * "From the invitation to the big day": six moments along a path — each lights up as it scrolls in,
 * with a small live scene beside its text (the spreadsheet's columns found, a greeting by name, the
 * whole list sent at once, statuses going by, a question answered, a button explained). Wide screens:
 * a centered path with the moments on alternating sides; phones: the path runs down the side.
 */
export function Journey({
  items,
  s,
}: {
  items: { key: MomentKey; icon: ReactNode; title: string; body: string }[];
  s: SceneText;
}) {
  return (
    <ol className="hx hx-path mt-14 flex flex-col gap-14 lg:gap-24">
      {items.map((item, i) => (
        <Reveal as="li" key={item.key} delay={80} className="hx-moment">
          <span aria-hidden className="hx-node">
            {item.icon}
          </span>
          <div className="hx-moment-text">
            <p aria-hidden className="text-[13px] font-bold tracking-[0.2em] text-[#e7a977]">
              {String(i + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-1 text-[21px] font-bold sm:text-[23px]">{item.title}</h3>
            <p className="mt-2 text-[15.5px] text-pretty text-white/70">{item.body}</p>
          </div>
          <Play className="hx-glass">
            <MomentScene moment={item.key} s={s} />
          </Play>
        </Reveal>
      ))}
    </ol>
  );
}
