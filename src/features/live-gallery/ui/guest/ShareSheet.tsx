'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { Camera, CircleFadingPlus, ImagePlus, LayoutGrid, User, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Placement } from '../../types';
import { GALLERY } from '../../config';
import { useGuestText } from '../guest-text';

/**
 * Sharing, in one sheet (from the bottom on a phone): where to — the story (the circles at the top) or
 * a post in the feed — the name on it (kept on the phone, not required), then the phone's gallery or
 * its camera. Two taps from the page to the picker.
 */
export function ShareSheet({
  open,
  onOpenChange,
  placement,
  onPlacement,
  name,
  onName,
  approval,
  note,
  onPick,
  onCamera,
  disabled,
  style,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  placement: Placement;
  onPlacement(p: Placement): void;
  name: string;
  onName(value: string): void;
  /** the hosts approve what is shared before it shows */
  approval: boolean;
  /** the small print: files are kept on the phone, the limits */
  note: string;
  onPick(): void;
  onCamera(): void;
  disabled: boolean;
  /** the event's colours (the sheet is portalled out of the page that defines them) */
  style?: CSSProperties;
}) {
  const { t, dir } = useGuestText();
  const S = t.share;
  const options: { value: Placement; label: string; hint: string; Icon: typeof ImagePlus }[] = [
    { value: 'story', label: S.story, hint: S.storyHint, Icon: CircleFadingPlus },
    { value: 'feed', label: S.feed, hint: S.feedHint, Icon: LayoutGrid },
  ];
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          style={style}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-[2px] motion-safe:data-[state=open]:animate-app-fade-in sm:items-center sm:p-6"
        >
          <RadixDialog.Content
            data-testid="share-sheet"
            className="relative max-h-[92svh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl outline-none motion-safe:data-[state=open]:animate-app-dialog-in sm:rounded-[28px] sm:p-7"
          >
            <span
              aria-hidden
              className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line-strong sm:hidden"
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <RadixDialog.Title className="text-[21px] font-bold">{S.title}</RadixDialog.Title>
                <RadixDialog.Description className="mt-0.5 text-[13.5px] text-muted">
                  {approval ? t.upload.approvalBody : t.upload.body}
                </RadixDialog.Description>
              </div>
              <RadixDialog.Close
                aria-label={S.close}
                className="-me-1.5 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X aria-hidden className="size-5" />
              </RadixDialog.Close>
            </div>

            {/* where to: two big choices */}
            <div role="radiogroup" aria-label={S.where} className="mt-4 grid grid-cols-2 gap-2.5">
              {options.map(({ value, label, hint, Icon }) => {
                const on = placement === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onPlacement(value)}
                    data-placement={value}
                    className={`flex flex-col items-start gap-1.5 rounded-[18px] border-2 p-3.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      on
                        ? 'border-[var(--gallery-accent)] bg-[color-mix(in_oklab,var(--gallery-accent)_9%,transparent)]'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid size-10 place-items-center rounded-full ${
                        on
                          ? 'bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]'
                          : 'bg-subtle text-ink'
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="text-[15.5px] font-bold">{label}</span>
                    <span className="text-[12.5px] leading-snug text-muted">{hint}</span>
                  </button>
                );
              })}
            </div>

            {/* the name on the story and the posts (kept on this phone) */}
            <label
              htmlFor="gallery-name"
              className="mt-4 flex items-baseline gap-1.5 text-[13px] font-semibold"
            >
              {t.upload.name}
              <span className="text-[12px] font-normal text-muted">({t.upload.optional})</span>
            </label>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--gallery-accent)_16%,white)] font-display text-[18px] font-bold text-[var(--gallery-accent)]"
              >
                {(Array.from(name.trim())[0] ?? '').toLocaleUpperCase() || <User className="size-5" />}
              </span>
              <input
                id="gallery-name"
                value={name}
                maxLength={GALLERY.limits.nameLength}
                onChange={(e) => onName(e.target.value)}
                placeholder={t.upload.namePlaceholder}
                dir="auto"
                autoComplete="name"
                aria-describedby="gallery-name-help"
                className="h-12 min-w-0 flex-1 rounded-[14px] border border-line bg-surface px-3.5 text-[16px] focus:border-ink focus:shadow-ring focus:outline-hidden"
              />
            </div>
            <p id="gallery-name-help" className="mt-1.5 text-[12px] text-muted">
              {t.upload.nameHelp}
            </p>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={onPick}
                disabled={disabled}
                data-testid="share-pick"
                className="inline-flex h-14 items-center justify-center gap-2.5 rounded-[16px] bg-[linear-gradient(135deg,var(--gallery-accent),color-mix(in_oklab,var(--gallery-accent)_78%,black))] px-5 text-[17px] font-bold text-[var(--gallery-accent-ink)] shadow-[0_14px_28px_-14px_rgba(0,0,0,0.65)] transition-transform active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none"
              >
                <ImagePlus aria-hidden className="size-5" />
                {t.upload.pick}
              </button>
              <button
                type="button"
                onClick={onCamera}
                disabled={disabled}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[16px] border border-line bg-surface px-5 text-[15px] font-semibold text-ink shadow-sm disabled:opacity-60"
              >
                <Camera aria-hidden className="size-5" />
                {t.upload.camera}
              </button>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">{note}</p>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
