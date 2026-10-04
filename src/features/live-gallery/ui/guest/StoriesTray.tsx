'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage: nothing for the image optimizer to cache */

import { Heart, Plus, User } from 'lucide-react';
import { useGuestText } from '../guest-text';
import { isUnseen, type Story } from './stories';

/** A person's colour: soft, steady (the same name is always the same hue), readable initials on it. */
function hueOf(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

/**
 * A story's circle: the newest photo or video of that person (their cover), else their initial on a
 * colour of their own; the hosts a heart, an unnamed guest a person. With a ring when there is
 * something this phone has not watched yet, grey when it has, none in the viewer's header.
 */
export function StoryAvatar({
  story,
  size,
  ring = 'none',
}: {
  story: Story;
  /** px */
  size: number;
  ring?: 'new' | 'seen' | 'none';
}) {
  const cover = story.items[story.items.length - 1]?.thumb ?? null;
  const hue = hueOf(story.key);
  const initial = story.name ? (Array.from(story.name.trim())[0] ?? '').toLocaleUpperCase() : '';
  // the picture fills the circle by being laid over it (a percentage height would not resolve inside
  // these nested boxes, and a tall photo would stretch the circle into an oval)
  const inner = (
    <span
      aria-hidden
      className="relative block size-full overflow-hidden rounded-full bg-subtle"
      style={cover ? undefined : { background: `hsl(${hue} 55% 90%)`, color: `hsl(${hue} 45% 28%)` }}
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          {story.host ? (
            <Heart className="size-[42%] fill-current" />
          ) : initial ? (
            <span className="font-display font-bold" style={{ fontSize: size * 0.42 }}>
              {initial}
            </span>
          ) : (
            <User className="size-[46%]" />
          )}
        </span>
      )}
    </span>
  );
  if (ring === 'none')
    return (
      <span className="block shrink-0" style={{ width: size, height: size }}>
        {inner}
      </span>
    );
  return (
    <span
      aria-hidden
      className={`block shrink-0 rounded-full p-[3px] ${
        ring === 'new'
          ? 'bg-[linear-gradient(135deg,var(--gallery-accent),color-mix(in_oklab,var(--gallery-accent)_35%,white))]'
          : 'bg-line-strong'
      }`}
      style={{ width: size, height: size }}
    >
      <span className="block size-full rounded-full border-[3px] border-canvas bg-canvas">{inner}</span>
    </span>
  );
}

/**
 * The stories at the top of the guests' page: a "+" to add your own, then a circle for each person
 * who shared, newest first, scrolling sideways. A tap opens that person's story in the viewer.
 */
export function StoriesTray({
  stories,
  seen,
  nameOf,
  onOpen,
  onAdd,
}: {
  stories: readonly Story[];
  seen: Record<string, string>;
  nameOf(story: Story): string;
  onOpen(key: string): void;
  /** the way to pick photos (when the gallery takes uploads) */
  onAdd?: () => void;
}) {
  const { t, plural } = useGuestText();
  if (!stories.length && !onAdd) return null;
  return (
    <section className="mt-7" aria-labelledby="gallery-stories" data-testid="gallery-stories">
      <h2 id="gallery-stories" className="text-[18px] font-bold">
        {t.stories.title}
      </h2>
      <ul className="-mx-4 mt-3 flex snap-x gap-3.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {onAdd ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={onAdd}
              aria-label={t.stories.addLabel}
              className="group flex w-[76px] flex-col items-center gap-1.5 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span
                aria-hidden
                className="grid size-[72px] place-items-center rounded-full border-2 border-dashed border-[var(--gallery-accent)] text-[var(--gallery-accent)] transition-transform group-active:scale-95 motion-reduce:transition-none"
              >
                <Plus className="size-7" strokeWidth={2.25} />
              </span>
              <span className="w-full truncate text-center text-[12.5px] font-semibold text-muted">
                {t.stories.add}
              </span>
            </button>
          </li>
        ) : null}
        {stories.map((story) => {
          const name = nameOf(story);
          const unseen = isUnseen(story, seen);
          const label = `${plural(t.stories.open, story.items.length, { name })}${unseen ? `, ${t.stories.newLabel}` : ''}`;
          return (
            <li key={story.key} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onOpen(story.key)}
                aria-label={label}
                data-story={story.key}
                data-unseen={unseen ? '' : undefined}
                className="group flex w-[76px] flex-col items-center gap-1.5 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="block transition-transform group-active:scale-95 motion-reduce:transition-none">
                  <StoryAvatar story={story} size={72} ring={unseen ? 'new' : 'seen'} />
                </span>
                <span
                  dir="auto"
                  className={`w-full truncate text-center text-[12.5px] ${unseen ? 'font-bold text-ink' : 'font-medium text-muted'}`}
                >
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {stories.length ? <p className="mt-1 text-[12.5px] text-muted">{t.stories.hint}</p> : null}
    </section>
  );
}
