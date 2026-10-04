'use client';
/* eslint-disable @next/next/no-img-element -- the pictures are the host's own, from short-lived signed URLs of private storage, and a link's picture is a third party's: nothing for the image optimizer to cache */

import {
  ChevronDown,
  Ellipsis,
  ExternalLink,
  ImageOff,
  ListChecks,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
  Store,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { cn, Menu, Skeleton, type MenuItem } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { IDEA_COLORS, type IdeaColor } from '../../model/categories';
import type { PlanIdea } from '../../model/plan';
import type { ConvertKind } from '../../model/schemas-ideas';
import { CARD_COLOR } from './colors';
import { hostnameOf, shortUrl, webHref } from './model';

export interface CardLink {
  kind: ConvertKind;
  id: string;
  /** resolved from the plan (undefined until it is read again) */
  name?: string;
  href: string;
}

const LINK_ICON: Record<ConvertKind, LucideIcon> = { task: ListChecks, vendor: Store, item: Wallet };
/** a checklist card shows this many lines; the rest are in its editor */
const VISIBLE_LINES = 12;

/** A 44px touch target with the app's icon button look (the kit's is 36px). */
function IconAction({ label, className, children, ...props }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:bg-subtle hover:text-ink motion-reduce:transition-none sm:size-9',
        'aria-pressed:text-brand-deep [&_svg]:size-[18px]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ColorDot({ color }: { color: IdeaColor }) {
  return <span className={cn('size-3.5 rounded-full border', CARD_COLOR[color])} />;
}

/** A card's own picture: a skeleton until its signed address is read, a note when it cannot be shown. */
function IdeaImage({
  src,
  alt,
  failed,
  onError,
}: {
  src?: string;
  alt: string;
  failed: string;
  onError(): void;
}) {
  const [broken, setBroken] = useState(false);
  if (!src) return <Skeleton width="100%" height={160} radius={0} />;
  if (broken)
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 text-[13px] text-muted">
        <ImageOff aria-hidden className="size-6" />
        {failed}
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        setBroken(true);
        onError();
      }}
      className="max-h-[420px] w-full object-cover"
    />
  );
}

/** A link's picture: gone (not an empty box) when it does not load. */
function PreviewImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setOk(false)}
      className="aspect-[1.91/1] w-full bg-subtle object-cover"
    />
  );
}

/**
 * One card of the board: a note, a link with its preview, a picture or a checklist you can tick, with
 * its tags, what it became (links to the task / vendor / budget line), and its actions.
 */
export function IdeaCard({
  idea,
  imageUrl,
  previewing,
  links,
  canMakeItem,
  onEdit,
  onTick,
  onPin,
  onColor,
  onDelete,
  onConvert,
  onSummarize,
  onImageError,
}: {
  idea: PlanIdea;
  imageUrl?: string;
  previewing: boolean;
  links: CardLink[];
  /** the event has budget categories to put a line in */
  canMakeItem: boolean;
  onEdit(): void;
  onTick(index: number): void;
  onPin(): void;
  onColor(color: IdeaColor): void;
  onDelete(): void;
  onConvert(kind: ConvertKind): void;
  onSummarize(): void;
  onImageError(path: string): void;
}) {
  const { t, fmt, plural, number } = useUi();
  const T = t.planning.ideas;
  const preview = idea.ogPreview;
  const href = idea.type === 'link' ? webHref(idea.url) : undefined;
  const pictureSrc = webHref(preview?.image, true);
  const host = href ? hostnameOf(href) : '';
  const hasText = !!(idea.title || idea.body);
  const done = idea.items.filter((l) => l.done).length;
  const lines = idea.items.slice(0, VISIBLE_LINES);

  const convertItems: MenuItem[] = [];
  if (!idea.linkedTaskId)
    convertItems.push({ label: T.makeInto.task, icon: <ListChecks />, onSelect: () => onConvert('task') });
  if (!idea.linkedVendorId)
    convertItems.push({ label: T.makeInto.vendor, icon: <Store />, onSelect: () => onConvert('vendor') });
  if (!idea.linkedBudgetItemId && canMakeItem)
    convertItems.push({ label: T.makeInto.item, icon: <Wallet />, onSelect: () => onConvert('item') });

  const menu: MenuItem[] = [
    { label: T.card.edit, icon: <Pencil />, onSelect: onEdit },
    { label: T.ai.action, icon: <Sparkles />, onSelect: onSummarize },
    {
      label: idea.pinned ? T.card.unpin : T.card.pin,
      icon: idea.pinned ? <PinOff /> : <Pin />,
      onSelect: onPin,
    },
    {
      type: 'radio',
      label: T.card.color,
      value: idea.color,
      options: IDEA_COLORS.map((c) => ({ value: c, label: T.card.colors[c], icon: <ColorDot color={c} /> })),
      onValueChange: (v) => onColor(v as IdeaColor),
    },
    { type: 'separator' },
    { label: T.card.delete, icon: <Trash2 />, danger: true, onSelect: onDelete },
  ];

  const chip = (l: CardLink): ReactNode => {
    const Icon = LINK_ICON[l.kind];
    const label = l.name
      ? fmt(T.linked[l.kind], { name: l.name })
      : T.linked[`${l.kind}Bare` as 'taskBare' | 'vendorBare' | 'itemBare'];
    return (
      <li key={`${l.kind}-${l.id}`} className="min-w-0 max-w-full">
        <Link
          href={l.href}
          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-brand-deep hover:bg-subtle sm:min-h-8"
        >
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <article
      className={cn('mb-3 break-inside-avoid rounded-card border p-4 shadow-sm', CARD_COLOR[idea.color])}
    >
      {idea.type === 'image' && idea.imagePath ? (
        <div className="-mx-1 mb-3 overflow-hidden rounded-input bg-subtle">
          <IdeaImage
            key={imageUrl}
            src={imageUrl}
            alt={idea.title ?? T.card.imageAlt}
            failed={T.card.imageFailed}
            onError={() => idea.imagePath && onImageError(idea.imagePath)}
          />
        </div>
      ) : null}

      {hasText ? (
        <button
          type="button"
          onClick={onEdit}
          className="block w-full rounded-input text-start"
          aria-label={`${T.card.edit}: ${idea.title ?? idea.body?.slice(0, 40) ?? ''}`}
        >
          {idea.title ? (
            <span className="block text-[15px] leading-snug font-bold break-words">{idea.title}</span>
          ) : null}
          {idea.body ? (
            <span
              className={cn(
                'line-clamp-8 block text-[14px] leading-[1.55] break-words whitespace-pre-wrap text-ink/85',
                idea.title && 'mt-1',
              )}
            >
              {idea.body}
            </span>
          ) : null}
        </button>
      ) : null}

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${T.card.open}: ${preview?.title ?? host}`}
          className={cn(
            'block overflow-hidden rounded-input border border-line bg-surface hover:bg-subtle',
            hasText && 'mt-3',
          )}
        >
          {pictureSrc ? <PreviewImage src={pictureSrc} /> : null}
          <span className="block p-3">
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <ExternalLink aria-hidden className="icon-dir size-3.5 shrink-0" />
              <span dir="ltr" className="min-w-0 truncate">
                {preview?.site ?? host}
              </span>
            </span>
            {previewing && !preview ? (
              <span className="mt-2 block" role="status">
                <Skeleton shape="line" width="80%" />
                <Skeleton shape="line" width="55%" className="mt-2" />
                <span className="sr-only">{T.card.loadingPreview}</span>
              </span>
            ) : (
              <>
                {preview?.title || shortUrl(href) !== host ? (
                  <span className="mt-1 block text-[14px] leading-snug font-semibold break-words line-clamp-2">
                    {preview?.title ?? <span dir="ltr">{shortUrl(href)}</span>}
                  </span>
                ) : null}
                {preview?.description ? (
                  <span className="mt-1 block text-[13px] leading-[1.5] break-words text-muted line-clamp-3">
                    {preview.description}
                  </span>
                ) : null}
              </>
            )}
          </span>
        </a>
      ) : null}

      {idea.items.length > 0 ? (
        <div className={cn(hasText && 'mt-2')}>
          <p className="text-[12px] text-muted">
            {fmt(T.card.progress, { done: number(done), total: number(idea.items.length) })}
          </p>
          <ul className="mt-1">
            {lines.map((line, i) => (
              <li key={i}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5 sm:min-h-8 sm:py-1">
                  <input
                    type="checkbox"
                    checked={line.done}
                    onChange={() => onTick(i)}
                    className="mt-px size-5 shrink-0 accent-ink sm:size-4"
                  />
                  <span
                    className={cn(
                      'min-w-0 text-[14px] leading-snug break-words',
                      line.done && 'text-muted line-through',
                    )}
                  >
                    {line.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {idea.items.length > VISIBLE_LINES ? (
            <p className="text-[12.5px] text-muted">
              {plural(T.card.moreLines, idea.items.length - VISIBLE_LINES, {
                n: number(idea.items.length - VISIBLE_LINES),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {idea.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {idea.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12px] text-ink/80"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {links.length > 0 ? <ul className="mt-3 flex flex-wrap gap-1.5">{links.map(chip)}</ul> : null}

      <div className="mt-2 -mb-1.5 -ms-2 -me-2 flex items-center justify-between gap-1">
        {convertItems.length > 0 ? (
          <Menu
            align="start"
            items={convertItems}
            trigger={
              <button
                type="button"
                aria-label={T.makeInto.label}
                className="inline-flex min-h-11 items-center gap-1 rounded-btn px-2.5 text-[13px] font-semibold text-brand-deep hover:bg-subtle motion-reduce:transition-none sm:min-h-9"
              >
                {T.makeInto.button}
                <ChevronDown aria-hidden className="size-3.5" />
              </button>
            }
          />
        ) : (
          <span />
        )}
        <div className="flex items-center">
          <IconAction
            label={idea.pinned ? T.card.unpin : T.card.pin}
            aria-pressed={idea.pinned}
            onClick={onPin}
          >
            <Pin className={cn(idea.pinned && 'fill-current')} />
          </IconAction>
          <Menu
            items={menu}
            trigger={
              <IconAction label={T.card.actions}>
                <Ellipsis />
              </IconAction>
            }
          />
        </div>
      </div>
    </article>
  );
}
