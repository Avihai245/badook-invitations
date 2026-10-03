'use client';

import {
  ArrowUp,
  BookOpen,
  LifeBuoy,
  Mail,
  MessagesSquare,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
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
import { cn, Hint } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { navKeyOf } from '@/features/invitations/app/workspace/stages';
import { SUPPORT_OPEN, openHelp, type SupportOpenDetail } from './open';
import {
  currentInvitationId,
  linkifyLabeledPaths,
  normalizeAnswer,
  resolveSupportPath,
  supportPageName,
} from './pages';
import { ChatHandoff } from './tickets/ui/ChatHandoff.client';

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

type Area =
  'general' | 'editor' | 'guests' | 'responses' | 'billing' | 'home' | 'budget' | 'seating' | 'gallery';

/** The guide tab's words load when it is first shown, not with every page. */
const GuidePanel = dynamic(() => import('@/features/guide/GuidePanel'), {
  ssr: false,
  loading: () => <div aria-hidden className="h-40 animate-pulse rounded-[16px] bg-subtle" />,
});

const STORE = 'badook:support';
/** What the server accepts (features/support/chat.ts ChatSchema) */
const MAX_MESSAGES = 20;
const MAX_CHARS = 16_000;
const MAX_QUESTION = 2000;

/** The screen the help was opened on, for the assistant's three ready questions. */
const areaOf = (path: string): Area =>
  /^\/app\/invitations\/[^/]+\/edit/.test(path)
    ? 'editor'
    : /^\/app\/invitations\/[^/]+\/guests/.test(path)
      ? 'guests'
      : /^\/app\/invitations\/[^/]+\/responses/.test(path)
        ? 'responses'
        : /^\/app\/invitations\/[^/]+\/plan\/budget/.test(path)
          ? 'budget'
          : /^\/app\/invitations\/[^/]+\/seating/.test(path)
            ? 'seating'
            : /^\/app\/invitations\/[^/]+\/gallery/.test(path)
              ? 'gallery'
              : /^\/app\/invitations\/(?!new)[^/]+\/?$/.test(path)
                ? 'home'
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
    `(?<![\\w/.])(\\/${SITE_PATHS}(?:\\/[\\w:\\-/]*)?)`, // a page of the site: /contact, /app/invitations/:id/guests
  ].join('|'),
  'g',
);

/** The path of a URL, only when it leads to this site — not yet whether it's a real screen. */
function internalPath(url: string): string | null {
  const clean = url.replace(/[.,;:!?'"»”]+$/, '');
  // a path of this site — not `//host` or `/\host`, which browsers read as another site
  if (/^\/(?![/\\])/.test(clean)) return clean;
  try {
    const u = new URL(clean);
    return u.origin === window.location.origin ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}

/**
 * A URL the assistant wrote → a link only when it is one of SUPPORT_PAGES (pages.ts), with `:id`
 * substituted for the visitor's real, current invitation; anything else — another site, or a path
 * that isn't a real known screen — stays plain text.
 */
function supportLink(url: string, invitationId: string | null): string | null {
  const path = internalPath(url);
  return path ? resolveSupportPath(path, invitationId) : null;
}

function Inline({
  text,
  onNavigate,
  invitationId,
}: {
  text: string;
  onNavigate: () => void;
  invitationId: string | null;
}) {
  const { locale } = useUi();
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
      const to = supportLink(href, invitationId);
      // not a known screen: the words alone, never the raw path
      parts.push(to ? link(to, label, at) : label);
    } else if (bare || path) {
      const raw = (bare ?? path)!;
      const trimmed = raw.replace(/[.,;:!?'"»”]+$/, '');
      const to = supportLink(trimmed, invitationId);
      // a bare path of this site: linked under the screen's name, never shown as a path
      const name = path ? supportPageName(trimmed, locale === 'en' ? 'en' : 'he') : null;
      parts.push(to ? link(to, name ?? <bdi dir="ltr">{trimmed}</bdi>, at) : trimmed);
      if (trimmed.length < raw.length) parts.push(raw.slice(trimmed.length));
    } else parts.push(whole);
    last = at + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Answer({
  text,
  onNavigate,
  invitationId,
}: {
  text: string;
  onNavigate: () => void;
  invitationId: string | null;
}) {
  return (
    <>
      {blocksOf(linkifyLabeledPaths(normalizeAnswer(text), invitationId)).map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j ? <br /> : null}
                <Inline text={line} onNavigate={onNavigate} invitationId={invitationId} />
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
                    <Inline text={item} onNavigate={onNavigate} invitationId={invitationId} />
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
  // the help panel's tab: the written guide (an article or its index), the assistant, the team
  const [tab, setTab] = useState<'guide' | 'assistant' | 'contact'>('assistant');
  const [article, setArticle] = useState<string | null>(null);
  const guideBody = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // "talk to a person": a ticket for the team with this conversation (features/support/tickets)
  // (shown; hidden while back in the chat, its draft kept; null: none)
  const [handoff, setHandoff] = useState<'shown' | 'hidden' | null>(null);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const stick = useRef(true);
  // the full-screen editor: the launcher is a small round button there (the preview's corner)
  const inEditor = /^\/app\/invitations\/[^/]+\/edit/.test(path);
  const brand = t.brand;
  // for substituting a ":id" the assistant reused from its own screen note (chat.ts's screenNote())
  const invitationId = currentInvitationId(path);

  useEffect(() => setMessages(load()), []);
  useEffect(() => {
    if (!busy) save(messages);
  }, [messages, busy]);

  const close = useCallback(() => {
    setOpen(false);
    setHandoff(null);
  }, []);

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
      const detail = (e as CustomEvent<SupportOpenDetail>).detail ?? {};
      if (!returnTo.current && document.activeElement instanceof HTMLElement)
        returnTo.current = document.activeElement;
      setOpen(true);
      setTab(detail.question ? 'assistant' : (detail.tab ?? 'assistant'));
      if (detail.tab === 'guide') setArticle(detail.article ?? null);
      if (detail.question) void askRef.current(detail.question);
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
      if (tab === 'assistant' && window.matchMedia('(pointer: fine)').matches)
        field.current?.focus({ preventScroll: true });
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
  }, [open, close, tab]);

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

  /** Back to the conversation: `keep` the hand-off's draft for later, or start over (it was sent). */
  const backToChat = (keep: boolean) => {
    setHandoff(keep ? 'hidden' : null);
    requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void ask(input);
  };

  const restart = () => {
    abort.current?.abort();
    setHandoff(null);
    setMessages([]);
    setInput('');
    field.current?.focus();
  };

  // the admin console is the team's own screen: not the customers' assistant
  if (path.startsWith('/app/admin')) return null;
  // three ready questions for this screen
  const suggestions = s.suggestions[areaOf(path)].slice(0, 3);
  const empty = messages.length === 0;
  // what a ticket from here would carry: the conversation as the server gets it
  const conversation = forServer(messages);

  return (
    <>
      {/* always there (the sidebar's help opens the same panel); in the editor a small round button in
          the preview's corner, clear of the phone and above the phone editor's own bottom bar */}
      <button
        type="button"
        hidden={open}
        onClick={() => openHelp()}
        aria-label={s.open}
        aria-haspopup="dialog"
        data-testid="support-launcher"
        data-compact={inEditor ? '' : undefined}
        className={cn(
          'support-launcher fixed z-[55] flex items-center rounded-full bg-linear-to-br from-brand to-brand-strong text-white shadow-[0_14px_34px_-10px_rgba(122,82,48,0.75)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus print:hidden',
          inEditor
            ? 'end-3 bottom-[68px] size-11 justify-center lg:end-5 lg:bottom-5'
            : 'end-4 bottom-4 h-13 gap-2.5 ps-1.5 pe-5 max-sm:w-13 max-sm:justify-center max-sm:p-0 sm:end-6 sm:bottom-6',
        )}
      >
        <span
          aria-hidden
          className={cn('grid place-items-center rounded-full', inEditor ? 'size-9' : 'size-10 bg-white/15')}
        >
          <Sparkles className={inEditor ? 'size-[18px]' : 'size-5'} />
        </span>
        {inEditor ? null : <span className="text-[14px] font-semibold max-sm:sr-only">{s.launcher}</span>}
      </button>

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
              'sm:inset-x-auto sm:end-6 sm:bottom-6 sm:h-[min(720px,calc(100dvh-48px))] sm:w-[440px] sm:rounded-[22px]',
            )}
          >
            <header className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-linear-to-br from-brand-strong via-brand to-[#c08a55] px-4 py-3.5 text-white">
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
                  {tab === 'assistant' ? fmt(s.title, { brand }) : t.helpCenter.title}
                </h2>
                <p className="flex items-center gap-1.5 truncate text-[12px] text-white/80">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#86efac]" />
                  {s.subtitle}
                </p>
              </div>
              {!empty && tab === 'assistant' ? (
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
              role="tablist"
              aria-label={t.helpCenter.tabsLabel}
              className="flex shrink-0 gap-1 border-b border-line bg-surface px-2 pt-2"
            >
              {(
                [
                  ['guide', BookOpen],
                  ['assistant', MessagesSquare],
                  ['contact', LifeBuoy],
                ] as const
              ).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  data-help-tab={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded-t-[10px] px-2 pt-1.5 pb-2.5 text-[13px] font-semibold transition-colors',
                    tab === key ? 'text-brand-deep' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{t.helpCenter.tabs[key]}</span>
                  {tab === key ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-brand"
                    />
                  ) : null}
                </button>
              ))}
            </div>

            {tab === 'guide' ? (
              <div
                ref={guideBody}
                role="tabpanel"
                className="flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#fbf7f2,#ffffff_30%)] px-4 py-4 dark:bg-none"
                data-testid="help-guide"
              >
                <GuidePanel
                  article={article}
                  screen={invitationId ? navKeyOf(path, invitationId) : null}
                  onOpen={(slug) => {
                    setArticle(slug);
                    guideBody.current?.scrollTo({ top: 0 });
                  }}
                  onAsk={(q) => {
                    setTab('assistant');
                    void ask(q);
                  }}
                />
              </div>
            ) : tab === 'contact' ? (
              <div
                role="tabpanel"
                className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5"
                data-testid="help-contact"
              >
                <div>
                  <h3 className="text-[17px] font-bold">{t.helpCenter.contact.title}</h3>
                  <p className="mt-1 text-[13.5px] text-muted">{t.helpCenter.contact.body}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/app/support/new"
                    onClick={onNavigate}
                    className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-brand text-[15px] font-semibold text-white hover:bg-brand-strong"
                  >
                    <LifeBuoy aria-hidden className="size-4" />
                    {t.helpCenter.contact.newTicket}
                  </Link>
                  <Link
                    href="/app/support"
                    onClick={onNavigate}
                    className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-line-strong text-[14px] font-semibold hover:bg-subtle"
                  >
                    {t.helpCenter.contact.myTickets}
                  </Link>
                  <Link
                    href="/contact"
                    onClick={onNavigate}
                    className="flex h-11 items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold text-muted hover:bg-subtle hover:text-ink"
                  >
                    <Mail aria-hidden className="size-4" />
                    {t.helpCenter.contact.contactPage}
                  </Link>
                </div>
                <p className="rounded-[12px] bg-subtle px-3 py-2.5 text-[12.5px] text-muted">
                  {t.helpCenter.contact.fromChat}
                </p>
              </div>
            ) : null}

            {tab === 'assistant' && handoff ? (
              <ChatHandoff
                conversation={conversation}
                hidden={handoff === 'hidden'}
                onBack={() => backToChat(true)}
                onFinish={() => backToChat(false)}
                onNavigate={onNavigate}
              />
            ) : null}
            <div
              ref={log}
              hidden={handoff === 'shown' || tab !== 'assistant'}
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
                        <Answer text={m.content} onNavigate={onNavigate} invitationId={invitationId} />
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
              hidden={handoff === 'shown' || tab !== 'assistant'}
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
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-inverse text-white transition-colors hover:bg-primary-hover"
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
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong disabled:bg-line-strong"
                  >
                    <ArrowUp aria-hidden className="size-[18px]" />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11.5px] leading-[1.45] text-muted">
                {s.disclaimer}{' '}
                {conversation.some((m) => m.role === 'user') ? (
                  <Hint text={t.tickets.handoff.buttonHint}>
                    <button
                      type="button"
                      onClick={() => setHandoff('shown')}
                      data-testid="support-human"
                      className="font-semibold text-ink underline underline-offset-2"
                    >
                      {t.tickets.handoff.button}
                    </button>
                  </Hint>
                ) : (
                  <Link
                    href="/app/support/new"
                    onClick={onNavigate}
                    className="font-semibold text-ink underline underline-offset-2"
                  >
                    {t.tickets.handoff.button}
                  </Link>
                )}
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
