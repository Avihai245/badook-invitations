'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { Download, Eye, MapPin, ScanFace, ShieldAlert } from 'lucide-react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useGuestText } from '../guest-text';
import { legalPage } from '../legal';

/**
 * "Before you share" — the notice a device sees once, before its first upload to a gallery (version 2
 * of the legal documents): who can see what is shared, what not to share, what happens to location
 * data, that copies can't be called back, and — only where face search is on — that faces in the
 * uploaded photos are detected on the phone. Acknowledging it records that the notice was shown; it
 * says so itself, and is not the consent of anyone in a photo. A modal dialog: focus moves in, stays
 * in, Esc or "Cancel" closes it without uploading, and focus goes back to what opened it.
 */
export function UploadNotice({
  open,
  faces,
  onAcknowledge,
  onCancel,
  style,
}: {
  open: boolean;
  /** face search is on in this gallery */
  faces: boolean;
  onAcknowledge(): void;
  onCancel(): void;
  /** the event's colours (the dialog is portalled out of the page that defines them) */
  style?: CSSProperties;
}) {
  const { t, dir, locale } = useGuestText();
  const N = t.legal.notice;
  const content = useRef<HTMLDivElement>(null);
  // after "I understand" the next step (the name sheet, the phone's picker) takes the focus
  const continuing = useRef(false);

  const points: { key: string; icon: ReactNode; text: string }[] = [
    { key: 'seen', icon: <Eye />, text: N.seen },
    { key: 'own', icon: <ShieldAlert />, text: N.own },
    { key: 'location', icon: <MapPin />, text: N.location },
    { key: 'copies', icon: <Download />, text: N.copies },
    ...(faces ? [{ key: 'faces', icon: <ScanFace />, text: N.faces }] : []),
  ];
  const link =
    'font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          dir={dir}
          style={style}
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 backdrop-blur-[3px] motion-safe:data-[state=open]:animate-app-fade-in sm:items-center sm:p-6"
        >
          <RadixDialog.Content
            ref={content}
            data-testid="upload-notice"
            // the dialog itself takes the focus: the title is read first and nothing is acknowledged by a stray Enter
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              content.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              if (continuing.current) {
                e.preventDefault();
                continuing.current = false;
              }
            }}
            className="relative max-h-[92svh] w-full max-w-[460px] overflow-y-auto rounded-t-[26px] bg-surface px-5 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))] text-ink shadow-2xl outline-none motion-safe:data-[state=open]:animate-app-dialog-in sm:rounded-[26px] sm:px-6 sm:pt-6"
          >
            <span aria-hidden className="mx-auto mb-4 block h-1 w-9 rounded-full bg-line-strong sm:hidden" />
            <RadixDialog.Title className="text-[20px] leading-tight font-bold text-balance">
              {N.title}
            </RadixDialog.Title>
            <RadixDialog.Description className="mt-1.5 text-[13.5px] leading-snug text-muted">
              {N.intro}
            </RadixDialog.Description>

            <ul className="mt-4 grid gap-3 text-[14px] leading-relaxed" data-testid="upload-notice-points">
              {points.map((p) => (
                <li key={p.key} data-point={p.key} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 shrink-0 text-muted [&_svg]:size-4">
                    {p.icon}
                  </span>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
              <a href={legalPage('/gallery-rules', locale)} target="_blank" rel="noopener" className={link}>
                {N.rules}
                <span className="sr-only"> ({N.newTab})</span>
              </a>
              <a href={legalPage('/privacy', locale)} target="_blank" rel="noopener" className={link}>
                {N.privacy}
                <span className="sr-only"> ({N.newTab})</span>
              </a>
            </p>

            <p className="mt-3 text-[12.5px] leading-snug text-muted">{N.ackOnly}</p>

            <div className="mt-5 grid gap-1.5">
              <button
                type="button"
                onClick={() => {
                  continuing.current = true;
                  onAcknowledge();
                }}
                data-testid="upload-notice-ok"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 py-2 text-center text-[15.5px] font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none dark:text-[#1c1917]"
              >
                {N.understand}
              </button>
              <button
                type="button"
                onClick={onCancel}
                data-testid="upload-notice-cancel"
                className="min-h-11 w-full rounded-full px-4 py-2 text-[14px] font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {N.cancel}
              </button>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
