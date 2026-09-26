'use client';

import { MessageSquarePlus, MessagesSquare, Trash2, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  dirOf,
  type InvitationDocument,
  type Locale,
  type Section,
} from '@/features/invitations/contracts/types';
import { fontFaceCss, pairFontFamilies } from '@/features/invitations/fonts';
import type { AssetBases } from '@/features/invitations/renderer/assets';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { MotionPause } from '@/features/invitations/renderer/MotionPause.client';
import {
  motionOff,
  resolveFontPair,
  themedDoc,
  themeMode,
  themeVars,
} from '@/features/invitations/renderer/theme';
import type { ReviewGuestDict } from '@/lib/i18n/review-guest.he';
import { fill, localeText, type LocaleText } from '@/lib/i18n/guest';
import { useLiveRefresh } from '@/lib/live/client';
import { REVIEW } from '../config';
import { reviewText } from '../text';
import { pinsOf, type ReviewComment, type ReviewState } from '../model';
import { PIN_CSS, PinLayer, spotAt } from './PinLayer';
import { ReviewGone, type ReviewGoneState } from './ReviewGone';

type Text = LocaleText<ReviewGuestDict>;
type Gone = ReviewGoneState;

const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // private mode: it is asked again next time
    }
  },
};
const NAME_KEY = 'badook:review:name';
const keyKey = (token: string) => `badook:review:key:${token}`;
const mineKey = (token: string) => `badook:review:mine:${token}`;

/** This browser's key for the link (lets its owner remove their own comments; the server keeps a hash). */
function authorKey(token: string): string {
  const stored = store.get(keyKey(token));
  if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const key = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  store.set(keyKey(token), key);
  return key;
}

async function post<T>(path: string, body: unknown): Promise<{ status: number; body: T | null }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
  } catch {
    return { status: 0, body: null };
  }
}

/** A sheet: the native <dialog> (modal: focus stays inside, Escape closes, the page is inert). */
function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="rv-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // a tap on the backdrop closes it
        if (e.target === ref.current) onClose();
      }}
      data-testid={testId}
    >
      {open ? (
        <div className="rv-sheet-in">
          <header>
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="rv-close" onClick={onClose} aria-label={closeLabel}>
              <X aria-hidden size={20} />
            </button>
          </header>
          <div className="rv-sheet-body">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/** A section's name for the family: its own title, else what kind of part it is. */
function partName(section: Section, locale: Locale, t: ReviewGuestDict): string {
  const d = section.data as { title?: Partial<Record<Locale, string>> | null };
  const own = section.type !== 'hero' ? d.title?.[locale]?.trim() : '';
  const names: Partial<Record<string, string>> = t.sectionNames;
  return own || names[section.type] || t.sectionNames.custom;
}

/**
 * /review/<token> — the draft of an invitation, as its guests would see it (the same renderer), for
 * the family to comment on: a "draft" mark over it, numbered pins where comments were left, "add a
 * comment" (tap the spot — or pick the part from the form's list), the comments and their replies, and
 * live updates both ways (the host's edits, everyone's comments). Nothing sends an RSVP, nobody is
 * counted; the name typed and this browser's key stay in this browser.
 */
export function ReviewScreen({
  token,
  initial,
  lang,
  brand,
  bases,
  publicBaseUrl,
}: {
  token: string;
  initial: ReviewState;
  lang: Locale | null;
  brand: string;
  bases: AssetBases;
  publicBaseUrl: string;
}) {
  const [state, setState] = useState(initial);
  const [gone, setGone] = useState<Gone | null>(null);
  const doc = state.draft;
  const template = state.template;
  const locale: Locale = lang && doc.locales.includes(lang) ? lang : doc.defaultLocale;
  const t: Text = useMemo(
    // the draft's language: its dictionary (features/review/text), its plurals, numbers and dates
    () => localeText(locale, reviewText(locale)),
    [locale],
  );
  const x = t.t;

  const [picking, setPicking] = useState(false);
  const [compose, setCompose] = useState<{ index: number; x: number; y: number } | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [mine, setMine] = useState<string[]>([]);
  // The comment's sheet closed with nothing after it: its opener (the list's link, or a tap on the
  // invitation) is gone, so the focus goes back to "add a comment" instead of the page's start.
  const addButton = useRef<HTMLButtonElement>(null);
  const composing = compose !== null;
  const wasComposing = useRef(false);
  useEffect(() => {
    const now = document.activeElement;
    if (wasComposing.current && !composing && (!now || now === document.body)) addButton.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => {
    try {
      setMine(JSON.parse(store.get(mineKey(token)) ?? '[]') as string[]);
    } catch {
      setMine([]);
    }
  }, [token]);

  // ── keeping current ──
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  }, [state]);
  const refresh = useCallback(async () => {
    const res = await post<ReviewState & { ok: boolean; code?: string }>('/api/review/open', { t: token });
    if (res.status === 410) setGone(res.body?.code === 'revoked' ? 'revoked' : 'expired');
    else if (res.status === 404) setGone('unavailable');
    else if (res.status === 200 && res.body?.ok) {
      const next = res.body;
      const prev = current.current;
      if (prev.updatedAt !== next.updatedAt) setAnnounce(x.updated);
      else if (next.comments.length > prev.comments.length) setAnnounce(x.newComments);
      setState(next);
    }
  }, [token, x.updated, x.newComments]);
  useLiveRefresh(state.realtime, () => void refresh(), REVIEW.pollMs);

  // ── the invitation ──
  const ctx = useMemo(
    () =>
      buildRenderContext(doc, template, locale, {
        mode: 'live',
        review: true,
        brand,
        bases,
        publicBaseUrl,
        cinematic: state.cinematic,
      }),
    [doc, template, locale, brand, bases, publicBaseUrl, state.cinematic],
  );
  const first = useRef(true);
  useLayoutEffect(() => {
    // the server wrote the first draft's tokens on <html>; a newer draft brings its own
    if (first.current) {
      first.current = false;
      return;
    }
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirOf(locale);
    root.dataset.theme = themeMode(template, doc);
    root.dataset.template = template.id;
    const themed = themedDoc(doc, state.cinematic);
    if (motionOff(themed)) root.dataset.motion = 'none';
    else delete root.dataset.motion;
    const vars = themeVars(template, themed, locale) as Record<string, string>;
    for (let i = root.style.length - 1; i >= 0; i--) {
      const name = root.style.item(i);
      if (name.startsWith('--') && !(name in vars)) root.style.removeProperty(name);
    }
    for (const [key, value] of Object.entries(vars))
      if (key.startsWith('--')) root.style.setProperty(key, String(value));
  }, [doc, template, locale, state.cinematic]);
  // a font pair the first page didn't declare (the host changed it meanwhile)
  const pair = resolveFontPair(template, doc);
  const initialPair = useRef(pair.id);
  const extraFonts = useMemo(
    () => (pair.id === initialPair.current ? '' : fontFaceCss(pairFontFamilies(pair))),
    [pair],
  );

  // ── pins ──
  const indexOf = useCallback(
    (sectionId: string) => doc.sections.findIndex((s) => s.id === sectionId && s.enabled),
    [doc],
  );
  const pins = useMemo(() => pinsOf(state.comments, thread), [state.comments, thread]);

  // ── picking a spot: the next tap on the invitation is the comment's place ──
  useEffect(() => {
    if (!picking) return;
    document.documentElement.classList.add('rv-picking');
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest('.rv-ui, .review-pins')) return;
      e.preventDefault();
      e.stopPropagation();
      const spot = spotAt(target, e.clientX, e.clientY);
      if (!spot) return;
      setPicking(false);
      setCompose(spot);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicking(false);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('rv-picking');
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [picking]);

  /** The part on screen now (the form's list starts there when no spot was tapped). */
  const partInView = (): number => {
    const els = [...document.querySelectorAll<HTMLElement>('[data-edit-path]')].filter((el) =>
      /^sections\.\d+$/.test(el.dataset.editPath ?? ''),
    );
    const mid = window.innerHeight / 2;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) return Number(el.dataset.editPath!.slice(9));
    }
    return doc.sections.findIndex((s) => s.enabled);
  };

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((m) => (m === message ? null : m)), 3500);
  };

  const remember = (id: string) => {
    setMine((prev) => {
      const next = [...prev, id].slice(-200);
      store.set(mineKey(token), JSON.stringify(next));
      return next;
    });
  };

  const comment = state.comments.find((c) => c.id === thread) ?? null;
  const open = state.comments.filter((c) => c.status === 'open').length;

  if (gone) return <ReviewGone state={gone} locale={t.locale} />;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PIN_CSS }} />
      {extraFonts ? <style dangerouslySetInnerHTML={{ __html: extraFonts }} /> : null}
      <InvitationBody
        ctx={ctx}
        showCover
        langSwitchHref={
          doc.locales.length > 1
            ? `/review/${token}/${doc.locales[(doc.locales.indexOf(locale) + 1) % doc.locales.length]}`
            : null
        }
      />
      <PinLayer
        pins={pins}
        indexOf={indexOf}
        onPin={(id) => setThread(id)}
        label={x.pinsLabel}
        pinLabel={(p) => {
          const c = state.comments.find((k) => k.id === p.id);
          return fill(x.pinLabel, { n: p.number, name: c?.name ?? '' });
        }}
      />
      {/* under the invitation's cover while it is up: CoverOverlay makes it inert meanwhile */}
      <div className="rv-ui" data-testid="review-ui" data-under-cover="">
        <div className="rv-watermark" aria-hidden>
          <span>{x.watermark}</span>
        </div>
        <p className="rv-banner" data-testid="review-banner">
          <span className="rv-dot" aria-hidden />
          <span>
            {x.banner} <small>· {x.bannerNote}</small>
          </span>
        </p>
        <div role="toolbar" aria-label={x.toolbar} className="rv-toolbar">
          <button
            ref={addButton}
            type="button"
            className="rv-btn"
            data-primary=""
            aria-pressed={picking}
            onClick={() => setPicking((p) => !p)}
            title={x.addHint}
          >
            <MessageSquarePlus aria-hidden />
            {x.add}
          </button>
          <button
            type="button"
            className="rv-btn"
            onClick={() => setList(true)}
            data-testid="review-list-button"
          >
            <MessagesSquare aria-hidden />
            {state.comments.length ? t.plural(x.list, state.comments.length) : x.listEmpty}
            {open ? (
              <span className="rv-sr">
                {' '}
                ({open} {x.open})
              </span>
            ) : null}
          </button>
          {/* "pause the animations" (WCAG 2.2.2) — the guest's page has it as a floating button */}
          <MotionPause
            labels={{ pause: ctx.t('motion.pause'), play: ctx.t('motion.play') }}
            className="rv-btn rv-btn-icon"
          />
        </div>
        {picking ? (
          <div className="rv-hint" role="status">
            <p>{x.picking}</p>
            <button
              type="button"
              className="rv-link"
              onClick={() => {
                setPicking(false);
                setCompose({ index: partInView(), x: 0.5, y: 0.08 });
              }}
            >
              {x.pickingKeyboard}
            </button>
            <button type="button" className="rv-btn rv-btn-small" onClick={() => setPicking(false)}>
              {x.cancel}
            </button>
          </div>
        ) : null}
        <p className="rv-sr" aria-live="polite">
          {announce}
        </p>
        {toast ? (
          <p className="rv-toast" role="status">
            {toast}
          </p>
        ) : null}

        <Composer
          key={compose ? `${compose.index}:${compose.x}:${compose.y}` : 'closed'}
          spot={compose}
          doc={doc}
          locale={locale}
          t={t}
          onClose={() => setCompose(null)}
          onSend={async (fields) => {
            const id = crypto.randomUUID();
            const section = doc.sections[fields.index];
            if (!section) return x.errors.unknown_section;
            const res = await post<{ ok: boolean; code?: string; comment?: ReviewComment }>(
              '/api/review/comment',
              {
                t: token,
                key: authorKey(token),
                id,
                sectionId: section.id,
                x: fields.x,
                y: fields.y,
                name: fields.name,
                body: fields.body,
              },
            );
            if (res.status === 200 && res.body?.comment) {
              const created = res.body.comment;
              store.set(NAME_KEY, fields.name);
              remember(created.id);
              setState((s) => ({
                ...s,
                comments: [...s.comments.filter((c) => c.id !== created.id), created],
              }));
              setCompose(null);
              setThread(created.id);
              flash(x.sent);
              return null;
            }
            if (res.status === 410) {
              setGone(res.body?.code === 'revoked' ? 'revoked' : 'expired');
              return x.errors.gone;
            }
            const code = res.body?.code;
            return code === 'rate' || code === 'too_many' || code === 'unknown_section'
              ? x.errors[code]
              : x.errors.failed;
          }}
        />

        <Sheet
          open={!!comment}
          onClose={() => setThread(null)}
          title={comment ? fill(x.pin, { n: comment.number }) : ''}
          closeLabel={x.close}
          testId="review-thread"
        >
          {comment ? (
            <Thread
              comment={comment}
              updatedAt={state.updatedAt}
              t={t}
              mine={mine.includes(comment.id)}
              onReply={async (name, body) => {
                const res = await post<{ ok: boolean; code?: string; comment?: ReviewComment }>(
                  '/api/review/reply',
                  {
                    t: token,
                    key: authorKey(token),
                    commentId: comment.id,
                    id: crypto.randomUUID(),
                    name,
                    body,
                  },
                );
                if (res.status === 200 && res.body?.comment) {
                  const updated = res.body.comment;
                  store.set(NAME_KEY, name);
                  setState((s) => ({
                    ...s,
                    comments: s.comments.map((c) => (c.id === updated.id ? updated : c)),
                  }));
                  return null;
                }
                const code = res.body?.code;
                return code === 'rate' || code === 'too_many' ? x.errors[code] : x.errors.failed;
              }}
              onRemove={async () => {
                const res = await post<{ ok: boolean }>('/api/review/remove', {
                  t: token,
                  key: authorKey(token),
                  commentId: comment.id,
                });
                if (res.status === 200) {
                  setState((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== comment.id) }));
                  setThread(null);
                  flash(x.removed);
                }
              }}
            />
          ) : null}
        </Sheet>

        <Sheet
          open={list}
          onClose={() => setList(false)}
          title={x.comments}
          closeLabel={x.close}
          testId="review-list"
        >
          {state.comments.length ? (
            <ul className="rv-comments">
              {[...state.comments]
                .sort((a, b) => (a.status === b.status ? a.number - b.number : a.status === 'open' ? -1 : 1))
                .map((c) => {
                  const section = doc.sections.find((s) => s.id === c.sectionId);
                  return (
                    <li key={c.id} className="rv-comment" data-status={c.status}>
                      <button
                        type="button"
                        className="rv-open"
                        onClick={() => {
                          setList(false);
                          const index = doc.sections.findIndex((s) => s.id === c.sectionId);
                          const el = document.querySelector(`[data-edit-path="sections.${index}"]`);
                          el?.scrollIntoView({
                            block: 'center',
                            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                              ? 'auto'
                              : 'smooth',
                          });
                          setThread(c.id);
                        }}
                      >
                        <span className="rv-comment-head">
                          <span className="rv-num" aria-hidden>
                            {c.number}
                          </span>
                          <span className="rv-sr">{fill(x.pin, { n: c.number })}</span>
                          <span className="rv-name">{c.name}</span>
                          {section ? <span>· {partName(section, locale, x)}</span> : null}
                          {c.status === 'handled' ? <span className="rv-tag">{x.handled}</span> : null}
                        </span>
                        <span className="rv-body">{c.body}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="rv-empty">{x.empty}</p>
          )}
        </Sheet>
      </div>
    </>
  );
}

function Composer({
  spot,
  doc,
  locale,
  t,
  onClose,
  onSend,
}: {
  spot: { index: number; x: number; y: number } | null;
  doc: InvitationDocument;
  locale: Locale;
  t: Text;
  onClose: () => void;
  /** null: sent; else the error to show */
  onSend: (fields: {
    index: number;
    x: number;
    y: number;
    name: string;
    body: string;
  }) => Promise<string | null>;
}) {
  const x = t.t;
  const ids = { section: useId(), name: useId(), nameHelp: useId(), body: useId(), error: useId() };
  const [index, setIndex] = useState(spot?.index ?? 0);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName((n) => n || (store.get(NAME_KEY) ?? '')), []);
  const parts = doc.sections.map((s, i) => ({ s, i })).filter(({ s }) => s.enabled);
  // a spot tapped keeps its place; a part picked from the list gets its top
  const place = spot && index === spot.index ? { x: spot.x, y: spot.y } : { x: 0.5, y: 0.08 };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    setError(await onSend({ index, ...place, name: name.trim(), body: body.trim() }));
    setBusy(false);
  };
  return (
    <Sheet
      open={!!spot}
      onClose={onClose}
      title={x.composeTitle}
      closeLabel={x.close}
      testId="review-compose"
    >
      <form onSubmit={submit} noValidate>
        <div className="rv-field">
          <label htmlFor={ids.section}>{x.section}</label>
          <select id={ids.section} value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {parts.map(({ s, i }) => (
              <option key={s.id} value={i}>
                {partName(s, locale, x)}
              </option>
            ))}
          </select>
        </div>
        <div className="rv-field">
          <label htmlFor={ids.name}>{x.name}</label>
          <input
            id={ids.name}
            value={name}
            maxLength={REVIEW.nameMax}
            autoComplete="name"
            placeholder={x.namePlaceholder}
            aria-describedby={ids.nameHelp}
            aria-invalid={tried && !name.trim() ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          <span id={ids.nameHelp} className="rv-help">
            {x.nameHelp}
          </span>
          {tried && !name.trim() ? <span className="rv-error">{x.required}</span> : null}
        </div>
        <div className="rv-field">
          <label htmlFor={ids.body}>{x.body}</label>
          <textarea
            id={ids.body}
            value={body}
            maxLength={REVIEW.bodyMax}
            placeholder={x.bodyPlaceholder}
            aria-invalid={tried && !body.trim() ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => setBody(e.target.value)}
          />
          {tried && !body.trim() ? <span className="rv-error">{x.required}</span> : null}
        </div>
        {error ? (
          <p id={ids.error} className="rv-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="rv-actions">
          <button type="submit" className="rv-btn" data-primary="" disabled={busy}>
            {busy ? x.sending : x.send}
          </button>
          <button type="button" className="rv-btn" onClick={onClose}>
            {x.cancel}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function Thread({
  comment,
  updatedAt,
  t,
  mine,
  onReply,
  onRemove,
}: {
  comment: ReviewComment;
  updatedAt: string;
  t: Text;
  mine: boolean;
  onReply: (name: string, body: string) => Promise<string | null>;
  onRemove: () => Promise<void>;
}) {
  const x = t.t;
  const ids = { name: useId(), body: useId() };
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName((n) => n || (store.get(NAME_KEY) ?? '')), []);
  const earlier = comment.draftUpdatedAt && Date.parse(comment.draftUpdatedAt) < Date.parse(updatedAt);
  const when = (iso: string) =>
    t.date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="rv-comment" data-status={comment.status}>
      <div className="rv-comment-head">
        <span className="rv-num" aria-hidden>
          {comment.number}
        </span>
        <span className="rv-name">{comment.name}</span>
        <span>· {when(comment.createdAt)}</span>
        {comment.status === 'handled' ? <span className="rv-tag">{x.handled}</span> : null}
      </div>
      <p className="rv-body">{comment.body}</p>
      {earlier ? <p className="rv-help">{x.earlier}</p> : null}
      {comment.replies.length ? (
        <ul className="rv-replies">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <span className="rv-by">
                <strong>{r.by === 'host' ? x.hosts : r.name}</strong> · {when(r.at)}
              </span>
              <p className="rv-body">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        style={{ marginTop: 14 }}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !body.trim()) return setError(x.required);
          setBusy(true);
          const failed = await onReply(name.trim(), body.trim());
          setBusy(false);
          setError(failed);
          if (!failed) setBody('');
        }}
      >
        <div className="rv-field">
          <label htmlFor={ids.name}>{x.name}</label>
          <input
            id={ids.name}
            value={name}
            maxLength={REVIEW.nameMax}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="rv-field">
          <label htmlFor={ids.body}>{fill(x.replyLabel, { n: comment.number })}</label>
          <textarea
            id={ids.body}
            value={body}
            maxLength={REVIEW.bodyMax}
            placeholder={x.replyPlaceholder}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        {error ? (
          <p className="rv-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="rv-actions">
          <button type="submit" className="rv-btn" data-primary="" disabled={busy}>
            {x.replySend}
          </button>
          {mine ? (
            <button type="button" className="rv-btn" onClick={() => void onRemove()}>
              <Trash2 aria-hidden />
              {x.remove}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
