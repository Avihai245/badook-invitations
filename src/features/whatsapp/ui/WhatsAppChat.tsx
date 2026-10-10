import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCheck,
  ExternalLink,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Smile,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { cn } from '@/components/app';
import type { RenderedMessage } from '../catalog';

/**
 * A message as it will look on the guest's phone, in WhatsApp: the business chat's header, the
 * wallpaper, the day, the template's bubble (its text with WhatsApp's own formatting, its footer, the
 * time) and its button under it — only what the template really has (a link button, or none: no
 * quick replies or media the approved templates don't carry). Laid out in the message's language
 * (right to left for Hebrew and Arabic). The colors are WhatsApp's light theme on purpose: it is the
 * guest's screen, not the app's.
 */

/** WhatsApp's light wallpaper: its beige with a faint doodle. */
const WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23d9d0c5' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M14 20c4-6 12-6 12 2s-12 12-12 12-12-4-12-12 8-8 12-2z'/%3E%3Ccircle cx='82' cy='22' r='7'/%3E%3Cpath d='M60 64l8 8m0-8l-8 8'/%3E%3Cpath d='M18 84h18M27 75v18'/%3E%3Cpath d='M92 82c6 0 10 4 10 10s-4 10-10 10'/%3E%3Cpath d='M48 104c3-4 9-4 12 0'/%3E%3Cpath d='M100 52l6-6 6 6'/%3E%3C/g%3E%3C/svg%3E\")";

/** WhatsApp's formatting: *bold*, _italic_, ~strike~, ```monospace``` — and links. */
export function whatsappRich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```|https?:\/\/[^\s]+)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const token = m[0];
    const key = `f${i++}`;
    if (token.startsWith('```'))
      out.push(
        <code key={key} className="font-mono text-[13px]">
          {token.slice(3, -3)}
        </code>,
      );
    else if (token.startsWith('*')) out.push(<strong key={key}>{token.slice(1, -1)}</strong>);
    else if (token.startsWith('_')) out.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (token.startsWith('~')) out.push(<s key={key}>{token.slice(1, -1)}</s>);
    else
      out.push(
        <span key={key} className="text-[#027eb5] underline">
          {token}
        </span>,
      );
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface WhatsAppChatProps {
  message: RenderedMessage;
  /** the message's language: its direction and the bubble's side */
  locale: Locale;
  /** the business's name in the chat's header */
  business: string;
  /** under the name ("Business account") */
  businessHint: string;
  /** the day chip ("Today", "18 Nov") */
  day: string;
  /** the bubble's time, "10:00" */
  time: string;
  /** the input bar's placeholder ("Message") */
  placeholder: string;
  /** accessible name of the whole preview */
  label: string;
  /** the phone's own frame around the chat (off: the chat alone, e.g. inside a dialog) */
  frame?: boolean;
  className?: string;
}

export function WhatsAppChat({
  message,
  locale,
  business,
  businessHint,
  day,
  time,
  placeholder,
  label,
  frame = true,
  className,
}: WhatsAppChatProps) {
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const screen = (
    <div
      dir={dir}
      lang={locale}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#efeae2] font-sans text-[#111b21]"
      data-testid="whatsapp-chat"
    >
      {/* the phone's status bar */}
      <div
        aria-hidden
        className="flex h-7 shrink-0 items-center justify-between bg-[#008069] px-5 text-[11px] font-semibold text-white"
        dir="ltr"
      >
        <span>{time}</span>
        <span className="flex items-center gap-1">
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span key={h} className="w-[3px] rounded-[1px] bg-white" style={{ height: h }} />
            ))}
          </span>
          <span className="ms-1 inline-flex h-[10px] w-[20px] items-center rounded-[3px] border border-white/90 p-[1px]">
            <span className="h-full w-[70%] rounded-[1px] bg-white" />
          </span>
        </span>
      </div>
      {/* the business chat's header */}
      <div className="flex h-14 shrink-0 items-center gap-2 bg-[#008069] px-2 text-white">
        <Back aria-hidden className="size-5 shrink-0" />
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[15px] font-bold text-[#008069]"
        >
          {business.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold">{business}</span>
          <span className="block truncate text-[11.5px] text-white/80">{businessHint}</span>
        </span>
        <span aria-hidden className="flex shrink-0 items-center gap-3.5 px-1">
          <Video className="size-[18px]" />
          <Phone className="size-[17px]" />
          <MoreVertical className="size-[18px]" />
        </span>
      </div>
      {/* the conversation */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3" style={{ backgroundImage: WALLPAPER }}>
        <div className="mb-3 flex justify-center">
          <span className="rounded-[7px] bg-white/95 px-2.5 py-1 text-[11.5px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            {day}
          </span>
        </div>
        <div className="flex">
          <div className="relative w-[88%] max-w-[300px]">
            {/* the bubble's tail, at the incoming side's top corner */}
            <span
              aria-hidden
              className={cn(
                'absolute top-0 size-0 border-t-[10px] border-t-white',
                dir === 'rtl'
                  ? '-right-[7px] border-r-[8px] border-r-transparent'
                  : '-left-[7px] border-l-[8px] border-l-transparent',
              )}
            />
            <div
              className={cn(
                'bg-white px-2.5 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]',
                message.button ? 'rounded-t-[7.5px]' : 'rounded-[7.5px]',
                dir === 'rtl' ? 'rounded-tr-none' : 'rounded-tl-none',
              )}
            >
              <p
                className="text-[14.2px] leading-[19px] break-words whitespace-pre-wrap"
                data-testid="whatsapp-body"
              >
                {whatsappRich(message.body)}
              </p>
              {message.footer ? (
                <p className="mt-1 text-[12.5px] leading-[17px] text-[#8696a0]">{message.footer}</p>
              ) : null}
              <p className="mt-0.5 flex justify-end text-[11px] text-[#667781]" dir="ltr">
                {time}
              </p>
            </div>
            {message.button ? (
              <div
                className="flex items-center justify-center gap-1.5 rounded-b-[7.5px] border-t border-[#e9edef] bg-white py-2.5 text-[14px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
                data-testid="whatsapp-button"
              >
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{message.button}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {/* the input bar (the guest's, decorative) */}
      <div aria-hidden className="flex h-[52px] shrink-0 items-center gap-1.5 px-1.5">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 text-[#8696a0] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          <Smile className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[14px]">{placeholder}</span>
          <Paperclip className="size-[18px] shrink-0" />
          <Camera className="size-[18px] shrink-0" />
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
          <Mic className="size-5" />
        </span>
      </div>
    </div>
  );
  return (
    <figure aria-label={label} className={cn('m-0', className)} data-testid="whatsapp-preview">
      {frame ? (
        <div className="mx-auto w-full max-w-[300px] rounded-[42px] bg-[#111] p-[9px] shadow-lg">
          <div className="relative h-[560px] overflow-hidden rounded-[34px]">
            {/* the camera notch */}
            <span
              aria-hidden
              className="absolute top-1.5 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#111]"
            />
            {screen}
          </div>
        </div>
      ) : (
        <div className="h-[460px] overflow-hidden rounded-[14px] border border-line">{screen}</div>
      )}
    </figure>
  );
}

/** The double check under a message that was read — the history's small sign. */
export const ReadTicks = ({ className }: { className?: string }) => (
  <CheckCheck aria-hidden className={cn('size-4 text-[#53bdeb]', className)} />
);
