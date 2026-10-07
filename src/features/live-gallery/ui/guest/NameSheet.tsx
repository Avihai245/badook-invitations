'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { User, X } from 'lucide-react';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Switch } from '@/components/app/Switch';
import { GALLERY } from '../../config';
import { useGuestText } from '../guest-text';

/** an Instagram username: what the guest typed, without the @ (empty when it isn't one) */
export function cleanHandle(value: string): string {
  const v = value.trim().replace(/^@+/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(v) ? v : '';
}

/** The camera glyph of a photo app (a rounded square, a lens, a dot) — not anyone's logo. */
export function CameraGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The name on what a guest shares — asked once, at their first share (they may go on without one),
 * then changed from the small button at the top. With it, "want us to tag you?": a switch, and their
 * Instagram username when it's on.
 */
export function NameSheet({
  open,
  mode,
  name,
  instagram,
  onClose,
  onDone,
  style,
}: {
  open: boolean;
  /** 'first': before the first share (continue → the phone's picker); 'edit': from the top bar */
  mode: 'first' | 'edit';
  name: string;
  /** the username kept on this phone ('' for none) */
  instagram: string;
  onClose(): void;
  /** saved: the name ('' for none) and the username ('' for none) */
  onDone(value: { name: string; instagram: string }): void;
  /** the event's colours (the sheet is portalled out of the page that defines them) */
  style?: CSSProperties;
}) {
  const { t, dir } = useGuestText();
  const N = t.name;
  const [value, setValue] = useState(name);
  const [tag, setTag] = useState(!!instagram);
  const [handle, setHandle] = useState(instagram);
  const [invalid, setInvalid] = useState(false);
  const ids = useId();
  // each time it opens: what the phone has now
  useEffect(() => {
    if (!open) return;
    setValue(name);
    setTag(!!instagram);
    setHandle(instagram);
    setInvalid(false);
  }, [open, name, instagram]);

  const done = () => {
    const clean = tag ? cleanHandle(handle) : '';
    if (tag && handle.trim() && !clean) return setInvalid(true);
    onDone({ name: value.trim().slice(0, GALLERY.limits.nameLength), instagram: clean });
  };
  const initial = (Array.from(value.trim())[0] ?? '').toLocaleUpperCase();

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          style={style}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-[3px] motion-safe:data-[state=open]:animate-app-fade-in sm:items-center sm:p-6"
        >
          <RadixDialog.Content
            data-testid="name-sheet"
            className="relative max-h-[92svh] w-full max-w-[440px] overflow-y-auto rounded-t-[26px] bg-surface px-5 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl outline-none motion-safe:data-[state=open]:animate-app-dialog-in sm:rounded-[26px] sm:px-6 sm:pt-6"
          >
            <span aria-hidden className="mx-auto mb-4 block h-1 w-9 rounded-full bg-line-strong sm:hidden" />
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="gallery-ring grid size-14 shrink-0 place-items-center rounded-full p-[2.5px]"
              >
                <span className="grid size-full place-items-center rounded-full border-[2.5px] border-surface bg-subtle font-display text-[22px] font-bold text-ink">
                  {initial || <User className="size-6 text-muted" />}
                </span>
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <RadixDialog.Title className="text-[19px] leading-tight font-bold">
                  {N.title}
                </RadixDialog.Title>
                <RadixDialog.Description className="mt-1 text-[13.5px] leading-snug text-muted">
                  {N.body}
                </RadixDialog.Description>
              </div>
              <RadixDialog.Close
                aria-label={N.close}
                className="-me-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X aria-hidden className="size-5" />
              </RadixDialog.Close>
            </div>

            <label htmlFor={`${ids}-name`} className="sr-only">
              {t.upload.name}
            </label>
            <input
              id={`${ids}-name`}
              value={value}
              maxLength={GALLERY.limits.nameLength}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && done()}
              placeholder={t.upload.namePlaceholder}
              dir="auto"
              autoComplete="name"
              data-testid="name-input"
              className="mt-5 h-12 w-full rounded-[14px] border border-line bg-canvas px-4 text-[16px] transition-colors focus:border-ink focus:bg-surface focus:outline-hidden"
            />

            {/* want us to tag you? */}
            <div className="mt-4 rounded-[16px] border border-line p-3.5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(45deg,#f9a23b,#e6336b_55%,#8b3fd1)] text-white"
                >
                  <CameraGlyph className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p id={`${ids}-tag`} className="text-[14.5px] font-semibold">
                    {N.tag}
                  </p>
                  <p className="text-[12.5px] leading-snug text-muted">{N.tagHint}</p>
                </div>
                <Switch
                  checked={tag}
                  onCheckedChange={(on) => {
                    setTag(on);
                    setInvalid(false);
                  }}
                  label={N.tag}
                  aria-labelledby={`${ids}-tag`}
                  data-testid="tag-switch"
                />
              </div>
              {tag ? (
                <div className="mt-3">
                  <label
                    htmlFor={`${ids}-ig`}
                    className="mb-1.5 block text-[12.5px] font-semibold text-muted"
                  >
                    {N.instagram}
                  </label>
                  <div
                    dir="ltr"
                    className={`flex h-11 items-center rounded-[12px] border bg-canvas px-3 focus-within:border-ink focus-within:bg-surface ${
                      invalid ? 'border-danger' : 'border-line'
                    }`}
                  >
                    <span aria-hidden className="text-[16px] text-muted">
                      @
                    </span>
                    <input
                      id={`${ids}-ig`}
                      value={handle}
                      onChange={(e) => {
                        setHandle(e.target.value.replace(/^@+/, ''));
                        setInvalid(false);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && done()}
                      placeholder="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="url"
                      maxLength={31}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${ids}-ig-error` : undefined}
                      data-testid="instagram-input"
                      className="h-full min-w-0 flex-1 bg-transparent ps-0.5 text-[16px] outline-none"
                    />
                  </div>
                  {invalid ? (
                    <p id={`${ids}-ig-error`} role="alert" className="mt-1.5 text-[12.5px] text-danger">
                      {N.instagramInvalid}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={done}
              data-testid="name-continue"
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15.5px] font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none dark:text-[#1c1917]"
            >
              {mode === 'first' ? N.continue : N.save}
            </button>
            {mode === 'first' ? (
              <button
                type="button"
                onClick={() => onDone({ name: '', instagram: '' })}
                className="mt-1.5 h-11 w-full rounded-full text-[14px] font-semibold text-muted hover:text-ink"
              >
                {N.skip}
              </button>
            ) : null}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
