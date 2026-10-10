'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage: nothing for the image optimizer to cache */

import { Heart, Plus, User } from 'lucide-react';
import { useGuestText } from '../guest-text';
import { isUnseen, type Story } from './stories';

/** A person's colour: soft, steady (the same name is always the same hue), readable initials on it. */
export function hueOf(key: string): number {
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
      className={`block shrink-0 rounded-full p-[2.5px] ${
        ring === 'new' ? 'gallery-ring' : 'bg-line-strong'
      }`}
      style={{ width: size, height: size }}
    >
      <span className="block size-full rounded-full border-[2.5px] border-canvas bg-canvas">{inner}</span>
    </span>
  );
}

/**
 * The stories at the top of the guests' page, as in a social app: "your story" first (the guest's own
 * circle with a small "+", one tap to share to it), then a circle for each person who shared, newest
 * first, scrolling sideways. A tap opens that person's story in the viewer.
 */
export function StoriesTray({
  stories,
  seen,
  nameOf,
  onOpen,
  onAdd,
  me,
}: {
  stories: readonly Story[];
  seen: Record<string, string>;
  nameOf(story: Story): string;
  onOpen(key: string): void;
  /** sharing to the story (when the gallery takes uploads) */
  onAdd?: () => void;
  /** this guest's initial, for their own circle ('' without a name) */
  me?: string;
}) {
  const { t, plural } = useGuestText();
  if (!stories.length && !onAdd) return null;
  const tile =
    'group flex w-[74px] flex-col items-center gap-1.5 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
  return (
    <section
      className="mt-4"
      aria-labelledby="gallery-stories"
      data-testid="gallery-stories"
      title={t.stories.hint}
    >
      <h2 id="gallery-stories" className="sr-only">
        {t.stories.title}
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {onAdd ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={onAdd}
              aria-label={`${t.stories.yours}: ${t.stories.addLabel}`}
              data-testid="story-add"
              className={tile}
            >
              <span className="relative block transition-transform group-active:scale-95 motion-reduce:transition-none">
                <span
                  aria-hidden
                  className="grid size-[66px] place-items-center rounded-full border border-line bg-subtle font-display text-[24px] font-bold text-ink"
                >
                  {me || <User className="size-7 text-muted" />}
                </span>
                <span
                  aria-hidden
                  className="absolute -end-0.5 -bottom-0.5 grid size-[24px] place-items-center rounded-full border-[2.5px] border-canvas bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]"
                >
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[12px] text-muted">{t.stories.yours}</span>
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
                className={tile}
              >
                <span className="block transition-transform group-active:scale-95 motion-reduce:transition-none">
                  <StoryAvatar story={story} size={66} ring={unseen ? 'new' : 'seen'} />
                </span>
                <span
                  dir="auto"
                  className={`w-full truncate text-center text-[12px] ${unseen ? 'font-semibold text-ink' : 'text-muted'}`}
                >
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
