'use client';

import { ArrowUp, MessageCircleQuestion, RotateCcw, Sparkles, Square, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { SUPPORT_OPEN, openSupport, type SupportOpenDetail } from './open';

/**
 * The support assistant: a chat on every page of the site and the app (answers stream in from
 * /api/support/chat). Public pages get a floating button; the app opens it from its header, the
 * editor's bar, the account menu and the "?" explanations (openSupport()). The conversation lives in
 * this tab only (sessionStorage) and goes to the server just to be answered.
 */

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  /** streaming: being written; error: a local notice (never sent back); stopped: cut short */
  state?: 'streaming' | 'error' | 'stopped';
}

type Area = 'general' | 'editor' | 'guests' | 'responses' | 'billing';

const STORE = 'badook:support';
/** What the server accepts (features/support/chat.ts ChatSchema) */
const MAX_MESSAGES = 20;
const MAX_CHARS = 16_000;
const MAX_QUESTION = 2000;

const areaOf = (path: string): Area =>
  /^\/app\/invitations\/[^/]+\/edit/.test(path)
    ? 'editor'
    : /^\/app\/invitations\/[^/]+\/guests/.test(path)
      ? 'guests'
      : /^\/app\/invitations\/[^/]+\/responses/.test(path)
        ? 'responses'
        : path.startsWith('/app/billing')
          ? 'billing'
          : 'general';

/** The conversation as the server wants it: no local notices, the latest part, starting with a question. */
function forServer(history: Msg[]): { role: Msg['role']; content: string }[] {
  const list = history
    .filter((m) => m.state !== 'error' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_QUESTION) }))
    .slice(-MAX_MESSAGES);
  while (list.length > 1 && list.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) list.shift();
  while (list.length > 1 && list[0]!.role !== 'user') list.shift();
  return list;
}

function load(): Msg[] {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(STORE) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw
          .filter(
            (m): m is Msg =>
              !!m &&
              typeof m === 'object' &&
              ((m as Msg).role === 'user' || (m as Msg).role === 'assistant') &&
              typeof (m as Msg).content === 'string',
          )
          // an answer that was still being written when the page changed
          .map((m) => (m.state === 'streaming' ? { ...m, state: 'stopped' as const } : m))
      : [];
  } catch {
    return [];
  }
}

function save(messages: Msg[]) {
  try {
    if (messages.length) window.sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
    else window.sessionStorage.removeItem(STORE);
  } catch {
    // private mode: the conversation lasts for this page
  }
}

// ── answers: a little markdown (paragraphs, lists, bold, links to this site only) ──────────────────

type Block = { kind: 'p'; lines: string[] } | { kind: 'ol' | 'ul'; items: string[] };

function blocksOf(text: string): Block[] {
  const out: Block[] = [];
  let current = null as Block | null;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      current = null;
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (ordered || bullet) {
      const kind = ordered ? 'ol' : 'ul';
      const item = (ordered?.[1] ?? bullet?.[1] ?? '').trim();
      if (current?.kind === kind) current.items.push(item);
      else out.push((current = { kind, items: [item] }));
      continue;
    }
    // "## Heading" → a bold line
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const content = heading ? `**${heading[1]}**` : line;
    if (current?.kind === 'p') current.lines.push(content);
    else out.push((current = { kind: 'p', lines: [content] }));
  }
  return out;
}

const SITE_PATHS = '(?:app|contact|privacy|terms|cookies|accessibility|login|signup)';
const INLINE = new RegExp(
  [
    '\\*\\*([^*]+)\\*\\*', // **bold**
    '\\[([^\\]]+)\\]\\(([^)\\s]+)\\)', // [label](url)
    '(https?:\\/\\/[^\\s<>()]+)', // a web address
    `(?<![\\w/.])(\\/${SITE_PATHS}(?:\\/[\\w\\-/]*)?)`, // a page of the site: /contact
  ].join('|'),
  'g',
);

/** A link only when it leads to this site; anything else stays text (an answer can't send people away). */
function internalPath(url: string): string | null {
  const clean = url.replace(/[.,;:!?'"»”]+$/, '');
  if (/^\/(?!\/)/.test(clean)) return clean;
  try {
    const u = new URL(clean);
    return u.origin === window.location.origin ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}

function Inline({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const [whole, bold, label, href, bare, path] = m;
    const link = (to: string, children: ReactNode, key: number) => (
      <Link
        key={key}
        href={to}
        onClick={onNavigate}
        className="font-semibold text-brand-deep underline decoration-brand-line underline-offset-2 hover:decoration-brand"
      >
        {children}
      </Link>
    );
    if (bold) parts.push(<strong key={at}>{bold}</strong>);
    else if (label && href) {
      const to = internalPath(href);
      parts.push(to ? link(to, label, at) : `${label} (${href})`);
    } else if (bare || path) {
      const raw = (bare ?? path)!;
      const trimmed = raw.replace(/[.,;:!?'"»”]+$/, '');
      const to = internalPath(trimmed);
      parts.push(to ? link(to, <bdi dir="ltr">{trimmed}</bdi>, at) : trimmed);
      if (trimmed.length < raw.length) parts.push(raw.slice(trimmed.length));
    } else parts.push(whole);
    last = at + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Answer({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <>
      {blocksOf(text).map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j ? <br /> : null}
                <Inline text={line} onNavigate={onNavigate} />
              </Fragment>
            ))}
          </p>
        ) : (
          (() => {
            const List = b.kind;
            return (
              <List
                key={i}
                className={cn('flex flex-col gap-1 ps-5', b.kind === 'ol' ? 'list-decimal' : 'list-disc')}
              >
                {b.items.map((item, j) => (
                  <li key={j} className="ps-0.5">
                    <Inline text={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </List>
            );
          })()
        ),
      )}
    </>
  );
}

// ── the chat ─────────────────────────────────────────────────────────────────────────────────────────

export function SupportChat() {
  const { t, locale, fmt } = useUi();
  const s = t.support;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const stick = useRef(true);
  const inApp = path.startsWith('/app');
  const brand = t.brand;

  useEffect(() => setMessages(load()), []);
  useEffect(() => {
    if (!busy) save(messages);
  }, [messages, busy]);

  const close = useCallback(() => setOpen(false), []);

  // closing gives the focus back to what opened the chat (once it is visible again)
  useEffect(() => {
    if (open) return;
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, [open]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim().slice(0, MAX_QUESTION);
      if (!q || abort.current) return;
      const history: Msg[] = [...messages.filter((m) => m.state !== 'error'), { role: 'user', content: q }];
      setMessages([...history, { role: 'assistant', content: '', state: 'streaming' }]);
      setInput('');
      setBusy(true);
      stick.current = true;
      const controller = new AbortController();
      abort.current = controller;
      let text = '';
      const show = (content: string, state?: Msg['state']) =>
        setMessages((list) => [...list.slice(0, -1), { role: 'assistant', content, state }]);
      try {
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: forServer(history), page: window.location.pathname, locale }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const code = ((await res.json().catch(() => null)) as { code?: string } | null)?.code;
          show(
            code === 'rate' ? s.errors.rate : code === 'too_long' ? s.errors.tooLong : s.errors.generic,
            'error',
          );
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          show(text, 'streaming');
        }
        text += decoder.decode();
        show(text.trim() ? text : s.errors.generic, text.trim() ? undefined : 'error');
      } catch {
        if (controller.signal.aborted) show(text, 'stopped');
        else show(navigator.onLine === false ? s.errors.offline : s.errors.generic, 'error');
      } finally {
        abort.current = null;
        setBusy(false);
      }
    },
    [messages, locale, s],
  );

  // openSupport() from anywhere, with or without a question
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { question } = (e as CustomEvent<SupportOpenDetail>).detail ?? {};
      if (!returnTo.current && document.activeElement instanceof HTMLElement)
        returnTo.current = document.activeElement;
      setOpen(true);
      if (question) void askRef.current(question);
    };
    window.addEventListener(SUPPORT_OPEN, onOpen);
    return () => window.removeEventListener(SUPPORT_OPEN, onOpen);
  }, []);

  // stop an answer that is being written when the chat unmounts
  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    // a mouse and keyboard: straight to the field; a touch screen: no keyboard popping over the
    // suggestions. After a beat, so a menu that opened the chat has handed its focus back first.
    const timer = window.setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches) field.current?.focus({ preventScroll: true });
      else panel.current?.focus({ preventScroll: true });
    }, 40);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // follow the answer as it grows, unless the reader scrolled up
  useLayoutEffect(() => {
    const el = log.current;
    if (el && open && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // the field grows with the question, up to five lines
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input, open]);

  const onNavigate = useCallback(() => {
    // on a phone the chat covers the page it leads to
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void ask(input);
  };

  const restart = () => {
    abort.current?.abort();
    setMessages([]);
    setInput('');
    field.current?.focus();
  };

  const suggestions = s.suggestions[areaOf(path)];
  const empty = messages.length === 0;

  return (
    <>
      {!inApp ? (
        <button
          type="button"
          hidden={open}
          onClick={() => openSupport()}
          aria-label={s.open}
          aria-haspopup="dialog"
          data-testid="support-launcher"
          className="support-launcher fixed end-4 bottom-4 z-[55] flex h-13 items-center gap-2.5 rounded-full bg-linear-to-br from-brand to-brand-deep ps-1.5 pe-5 text-white shadow-[0_14px_34px_-10px_rgba(122,82,48,0.75)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:w-13 max-sm:justify-center max-sm:p-0 print:hidden sm:end-6 sm:bottom-6"
        >
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-white/15">
            <Sparkles className="size-5" />
          </span>
          <span className="text-[14px] font-semibold max-sm:sr-only">{s.launcher}</span>
        </button>
      ) : null}

      {open ? (
        <>
          {/* phones: the rest of the page dims; a tap outside closes */}
          <div
            aria-hidden
            className="fixed inset-0 z-[64] bg-ink/30 sm:hidden print:hidden"
            onClick={close}
          />
          <div
            ref={panel}
            role="dialog"
            aria-labelledby="support-title"
            tabIndex={-1}
            data-testid="support-chat"
            className={cn(
              'support-panel fixed z-[65] flex outline-none flex-col overflow-hidden border border-line bg-surface text-ink shadow-[0_30px_80px_-20px_rgba(28,25,23,0.45)] print:hidden',
              'inset-x-0 bottom-0 h-[88dvh] rounded-t-[22px]',
              'sm:inset-x-auto sm:end-6 sm:bottom-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-[22px]',
            )}
          >
            <header className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-linear-to-br from-brand-deep via-brand to-[#c08a55] px-4 py-3.5 text-white">
              <span
                aria-hidden
                className="support-orb pointer-events-none absolute -top-10 -end-6 size-32 rounded-full bg-white/10"
              />
              <span
                aria-hidden
                className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25"
              >
                <Sparkles className="size-5" />
              </span>
              <div className="relative min-w-0 flex-1">
                <h2 id="support-title" className="truncate text-[15px] font-bold">
                  {fmt(s.title, { brand })}
                </h2>
                <p className="flex items-center gap-1.5 truncate text-[12px] text-white/80">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#86efac]" />
                  {s.subtitle}
                </p>
              </div>
              {!empty ? (
                <button
                  type="button"
                  onClick={restart}
                  aria-label={s.newChat}
                  title={s.newChat}
                  className="relative grid size-9 shrink-0 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw aria-hidden className="size-[18px]" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={close}
                aria-label={s.close}
                title={s.close}
                data-testid="support-close"
                className="relative grid size-9 shrink-0 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X aria-hidden className="size-5" />
              </button>
            </header>

            <div
              ref={log}
              role="log"
              aria-label={fmt(s.title, { brand })}
              aria-busy={busy}
              onScroll={(e) => {
                const el = e.currentTarget;
                stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#fbf7f2,#ffffff_40%)] px-4 py-4"
            >
              <Bubble role="assistant" who={s.assistant}>
                <p>{fmt(s.greeting, { brand })}</p>
              </Bubble>
              {empty ? (
                <div className="support-rise mt-1">
                  <p className="mb-2 text-[12px] font-semibold text-muted">{s.suggestionsTitle}</p>
                  <ul className="flex flex-wrap gap-2">
                    {suggestions.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => void ask(q)}
                          className="rounded-full border border-brand-line bg-surface px-3 py-1.5 text-start text-[13px] text-brand-deep shadow-sm transition-colors hover:border-brand hover:bg-brand-soft"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <Bubble key={i} role="user" who={s.you}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </Bubble>
                ) : (
                  <Bubble
                    key={i}
                    role="assistant"
                    who={s.assistant}
                    tone={m.state === 'error' ? 'error' : undefined}
                  >
                    {m.state === 'streaming' && !m.content ? (
                      <span className="flex items-center gap-1 py-1" role="status" aria-label={s.thinking}>
                        <span className="support-dot" />
                        <span className="support-dot [animation-delay:150ms]" />
                        <span className="support-dot [animation-delay:300ms]" />
                      </span>
                    ) : (
                      <>
                        <Answer text={m.content} onNavigate={onNavigate} />
                        {m.state === 'stopped' ? (
                          <p className="text-[12px] text-muted italic">{s.stopped}</p>
                        ) : null}
                      </>
                    )}
                  </Bubble>
                ),
              )}
            </div>

            <form
              className="shrink-0 border-t border-line bg-surface px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-[16px] border border-line-strong bg-surface px-3 py-2 transition-colors focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(160,112,63,0.15)]">
                <label htmlFor="support-input" className="sr-only">
                  {s.placeholder}
                </label>
                <textarea
                  id="support-input"
                  ref={field}
                  rows={1}
                  value={input}
                  maxLength={MAX_QUESTION}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={s.placeholder}
                  data-testid="support-input"
                  className="max-h-[132px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[16px] leading-[1.5] outline-none placeholder:text-faint sm:text-[14px]"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => abort.current?.abort()}
                    aria-label={s.stop}
                    title={s.stop}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-primary-hover"
                  >
                    <Square aria-hidden className="size-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label={s.send}
                    title={s.send}
                    disabled={!input.trim()}
                    data-testid="support-send"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep disabled:bg-line-strong"
                  >
                    <ArrowUp aria-hidden className="size-[18px]" />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11.5px] leading-[1.45] text-muted">
                {s.disclaimer}{' '}
                <Link
                  href="/contact"
                  onClick={onNavigate}
                  className="font-semibold text-ink underline underline-offset-2"
                >
                  {s.human}
                </Link>
              </p>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}

function Bubble({
  role,
  who,
  tone,
  children,
}: {
  role: Msg['role'];
  who: string;
  tone?: 'error';
  children: ReactNode;
}) {
  const mine = role === 'user';
  return (
    <div className={cn('support-rise flex max-w-[88%] flex-col gap-1', mine ? 'self-end' : 'self-start')}>
      <span className="sr-only">{who}:</span>
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[18px] px-3.5 py-2.5 text-[14px] leading-[1.6] break-words',
          mine
            ? 'rounded-ee-[6px] bg-brand text-white'
            : tone === 'error'
              ? 'rounded-es-[6px] border border-danger/20 bg-danger-bg text-danger'
              : 'rounded-es-[6px] border border-line bg-surface text-ink shadow-sm',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The app header's button for the assistant. */
export function SupportButton({ className }: { className?: string }) {
  const { t } = useUi();
  return (
    <button
      type="button"
      onClick={() => openSupport()}
      aria-label={t.support.open}
      title={t.support.open}
      aria-haspopup="dialog"
      data-testid="support-button"
      className={cn(
        'grid size-9 place-items-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand hover:text-white',
        className,
      )}
    >
      <MessageCircleQuestion aria-hidden className="size-5" />
    </button>
  );
}
