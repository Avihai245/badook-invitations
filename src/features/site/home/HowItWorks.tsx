import type { ReactNode } from 'react';
import { Reveal } from '../Reveal.client';
import { Play } from './Play.client';
import { DesignFan, DetailsTyping, RepliesChat, type SceneText } from './scenes';

/**
 * "How it works": three steps told as little live scenes — designs fanning out and one chosen, the
 * details typing themselves into the invitation, the WhatsApp message and its replies — joined by a
 * path a light travels along (wide screens).
 */
export function HowItWorks({
  steps,
  posters,
  s,
}: {
  steps: readonly { title: string; body: string }[];
  /** three design posters for the first step's fan */
  posters: ReactNode[];
  s: SceneText;
}) {
  const scenes = [
    <DesignFan key="fan" posters={posters} s={s} />,
    <DetailsTyping key="details" s={s} />,
    <RepliesChat key="replies" s={s} />,
  ];
  return (
    <div className="hx hx-how mt-12">
      <Play className="hx-how-line max-md:hidden">
        <span className="hx-how-spark" />
      </Play>
      <ol className="grid gap-14 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 160} className="text-center">
            <Play className="hx-stage">{scenes[i]}</Play>
            <span aria-hidden className="hx-step-num">
              {i + 1}
            </span>
            <h3 className="mt-4 text-[19px] font-bold">{step.title}</h3>
            <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-pretty text-muted">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
