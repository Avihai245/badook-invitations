'use client';

import {
  Ban,
  CircleCheck,
  Copy,
  Crown,
  ExternalLink,
  Link2,
  MessageCircle,
  RotateCcw,
  ScanEye,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  Drawer,
  Field,
  Hint,
  Input,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Textarea,
  cn,
  useToast,
} from '@/components/app';
import { HelpFor } from '@/features/invitations/app/HelpFor';
import type { Section } from '@/features/invitations/contracts/types';
import { sectionName } from '@/features/invitations/editor/fields/fields';
import { useEditor } from '@/features/invitations/editor/state/EditorProvider';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { REVIEW } from '../../config';
import type { NotifyMode, ReviewComment, ReviewLinkView } from '../../model';
import { useReview } from './ReviewProvider';

type Expiry = 'never' | 'd7' | 'd30';
type Filter = 'open' | 'handled' | 'all';
const DAYS: Record<Expiry, 7 | 30 | null> = { never: null, d7: 7, d30: 30 };

/**
 * The family's review in the editor (feature `draft_review`): the link — made with an optional expiry,
 * copied, opened, sent on WhatsApp, its expiry and emails changed, replaced or revoked — and the
 * comments, grouped by section: answered, marked handled (or open again), shown on the preview,
 * deleted. Live: new comments appear by themselves.
 */
export function ReviewDrawer({ onShow }: { onShow: (comment: ReviewComment) => void }) {
  const review = useReview()!;
  const { t } = useUi();
  const r = t.studio.review;
  const off = review.access === 'plan' || review.refused;
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && review.closeDrawer()}
      title={r.title}
      description={r.description}
      closeLabel={t.common.close}
      help={<HelpFor area="review" inDialog />}
    >
      {off ? (
        <OffCard />
      ) : (
        <div className="flex flex-col gap-6" data-testid="review-drawer">
          <LinkCard />
          <Comments onShow={onShow} />
        </div>
      )}
    </Drawer>
  );
}

function OffCard() {
  const { t } = useUi();
  const r = t.studio.review;
  return (
    <div className="rounded-card border border-brand-line bg-surface p-4" data-testid="review-off">
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-[#2b2118] text-[#f3d98b]">
          <Crown className="size-3.5" />
        </span>
        {r.offTitle}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{r.offBody}</p>
      <Button size="sm" className="mt-3" icon={<ExternalLink className="icon-dir" />} asChild>
        <a href="/app/billing" target="_blank" rel="noreferrer">
          {r.offCta}
          <span className="sr-only"> {t.editor.premium.newTab}</span>
        </a>
      </Button>
    </div>
  );
}

// ─── the link ──────────────────────────────────────────────────────────────────────────────────

function LinkCard() {
  const review = useReview()!;
  const { t, date } = useUi();
  const r = t.studio.review;
  const { toast } = useToast();
  const titleId = useId();
  const [expiry, setExpiry] = useState<Expiry>('never');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  const data = review.review;
  const link = data?.link ?? null;

  const run = async (key: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(key);
    const done = await review.linkCall(path, method, body);
    setBusy(null);
    if (!done) toast({ title: t.common.error, variant: 'danger' });
    return done;
  };

  const expirySelect = (
    <Segmented<Expiry>
      value={expiry}
      onValueChange={setExpiry}
      options={(['never', 'd7', 'd30'] as const).map((v) => ({ value: v, label: r.expiries[v] }))}
    />
  );

  let body;
  if (!data) {
    body = review.failed ? (
      <p role="alert" className="text-[13px] text-danger">
        {r.failed}
      </p>
    ) : (
      <Skeleton height={120} />
    );
  } else if (!link || link.state === 'revoked') {
    body = (
      <>
        <p className="text-[13px] leading-relaxed text-muted">{link ? r.states.revoked : r.none}</p>
        <Field label={r.expiry} help={r.expiryHint}>
          {expirySelect}
        </Field>
        <Hint text={r.createHint}>
          <Button
            icon={<Link2 />}
            loading={busy === 'create'}
            onClick={() => void run('create', '', 'POST', { expiresInDays: DAYS[expiry] })}
            data-testid="review-create"
          >
            {link ? r.again : r.create}
          </Button>
        </Hint>
      </>
    );
  } else {
    body = (
      <>
        {link.url ? (
          <ShareRow url={link.url} />
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">
            {r.keyChanged}
          </div>
        )}
        <LinkSettings
          link={link}
          busy={busy}
          onExpiry={(v) => void run('expiry', '', 'PATCH', { expiresInDays: DAYS[v] })}
          onNotify={(v) => void run('notify', '', 'PATCH', { notify: v })}
          when={(iso) => date(iso, { day: 'numeric', month: 'long', year: 'numeric' })}
        />
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Hint text={r.rotateHint}>
            <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => setConfirm('rotate')}>
              {r.rotate}
            </Button>
          </Hint>
          <Hint text={r.revokeHint}>
            <Button variant="ghost" size="sm" icon={<Ban />} onClick={() => setConfirm('revoke')}>
              {r.revoke}
            </Button>
          </Hint>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3" data-testid="review-link">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-[14px] font-bold">
          {r.link}
        </h3>
        {link && link.state === 'ok' ? <LiveLine /> : null}
      </div>
      {body}
      {confirm ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setConfirm(null)}
          title={confirm === 'rotate' ? r.rotateTitle : r.revokeTitle}
          description={confirm === 'rotate' ? r.rotateBody : r.revokeBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={!!busy}>
                {t.common.cancel}
              </Button>
              <Button
                variant={confirm === 'revoke' ? 'danger' : 'primary'}
                loading={busy === confirm}
                onClick={async () => {
                  const ok =
                    confirm === 'rotate'
                      ? await run('rotate', '/rotate', 'POST')
                      : await run('revoke', '', 'DELETE');
                  if (ok) setConfirm(null);
                }}
              >
                {confirm === 'rotate' ? r.rotate : r.revoke}
              </Button>
            </>
          }
        />
      ) : null}
    </section>
  );
}

function LiveLine() {
  const review = useReview()!;
  const { t } = useUi();
  const r = t.studio.review;
  const on = review.live === 'live';
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" role="status">
      <span aria-hidden className={cn('size-2 rounded-full', on ? 'bg-success' : 'bg-line-strong')} />
      {on ? r.live : r.polling}
    </span>
  );
}

function ShareRow({ url }: { url: string }) {
  const { t } = useUi();
  const r = t.studio.review;
  const { toast } = useToast();
  const inputId = useId();
  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => toast({ title: r.copied, variant: 'success' }),
      () => toast({ title: t.common.error, variant: 'danger' }),
    );
  return (
    <>
      <div>
        <label htmlFor={inputId} className="sr-only">
          {r.link}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            readOnly
            value={url}
            dir="ltr"
            textAlign="start"
            onFocus={(e) => e.target.select()}
            data-testid="review-url"
          />
          <Hint text={r.copyHint}>
            <Button variant="secondary" icon={<Copy />} onClick={() => void copy()}>
              {r.copy}
            </Button>
          </Hint>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Hint text={r.openHint}>
          <Button variant="secondary" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
            <a href={url} target="_blank" rel="noreferrer" data-testid="review-open">
              {r.open}
            </a>
          </Button>
        </Hint>
        <Hint text={r.whatsappHint}>
          <Button variant="whatsapp" size="sm" icon={<MessageCircle />} asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(fmt(r.whatsappText, { url }))}`}
              target="_blank"
              rel="noreferrer"
            >
              {r.whatsapp}
            </a>
          </Button>
        </Hint>
      </div>
    </>
  );
}

function LinkSettings({
  link,
  busy,
  onExpiry,
  onNotify,
  when,
}: {
  link: ReviewLinkView;
  busy: string | null;
  onExpiry: (v: Expiry) => void;
  onNotify: (v: NotifyMode) => void;
  when: (iso: string) => string;
}) {
  const { t } = useUi();
  const r = t.studio.review;
  const status =
    link.state === 'expired'
      ? r.states.expired
      : link.expiresAt
        ? fmt(r.validUntil, { date: when(link.expiresAt) })
        : r.noExpiry;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={r.expiry} help={r.expiryHint}>
        <Select
          value=""
          disabled={busy === 'expiry'}
          onChange={(e) => {
            const v = e.target.value as Expiry | '';
            if (v) onExpiry(v);
          }}
          data-testid="review-expiry"
        >
          <option value="">{status}</option>
          {(['never', 'd7', 'd30'] as const).map((v) => (
            <option key={v} value={v}>
              {r.expiries[v]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={r.notify} help={r.notifyHint}>
        <Select
          value={link.notify}
          disabled={busy === 'notify'}
          onChange={(e) => onNotify(e.target.value as NotifyMode)}
          data-testid="review-notify"
        >
          {(['each', 'daily', 'off'] as const).map((v) => (
            <option key={v} value={v}>
              {r.notifies[v]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

// ─── the comments ──────────────────────────────────────────────────────────────────────────────

function Comments({ onShow }: { onShow: (comment: ReviewComment) => void }) {
  const review = useReview()!;
  const { doc } = useEditor();
  const { t, locale } = useUi();
  const r = t.studio.review;
  const titleId = useId();
  const switchId = useId();
  const focus = review.drawer?.focus ?? null;
  const focused = review.review?.comments.find((c) => c.id === focus);
  const [filter, setFilter] = useState<Filter>(focused?.status === 'handled' ? 'all' : 'open');
  const comments = review.review?.comments ?? [];
  const shown = comments.filter((c) => filter === 'all' || c.status === filter);

  // grouped by section, in the invitation's order (a section no longer there: last)
  const groups = useMemo(() => {
    const order = new Map(doc.sections.map((s, i) => [s.id, i]));
    const by = new Map<string, ReviewComment[]>();
    for (const c of [...shown].sort((a, b) => a.number - b.number)) {
      const list = by.get(c.sectionId) ?? [];
      list.push(c);
      by.set(c.sectionId, list);
    }
    return [...by.entries()]
      .map(([sectionId, list]) => ({
        section: doc.sections.find((s) => s.id === sectionId) ?? null,
        list,
        at: order.get(sectionId) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.at - b.at);
  }, [shown, doc.sections]);

  if (!review.review) return null;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-[14px] font-bold">
          {r.comments}
        </h3>
        <Segmented<Filter>
          label={r.filter}
          value={filter}
          onValueChange={setFilter}
          options={(['open', 'handled', 'all'] as const).map((f) => ({ value: f, label: r.filters[f] }))}
        />
      </div>
      <div className="flex w-fit items-center gap-2 text-[13px]">
        <Hint text={r.pinsHint}>
          <Switch
            id={switchId}
            label={r.pins}
            checked={review.showPins}
            onCheckedChange={review.setShowPins}
            data-testid="review-pins-toggle"
          />
        </Hint>
        <label htmlFor={switchId} className="cursor-pointer">
          {r.pins}
        </label>
      </div>
      {!comments.length ? (
        <p className="text-[13px] text-muted">{r.empty}</p>
      ) : !shown.length ? (
        <p className="text-[13px] text-muted">{r.emptyFilter}</p>
      ) : (
        <div className="flex flex-col gap-4" data-testid="review-comments">
          {groups.map(({ section, list }) => (
            <div key={section?.id ?? list[0]!.sectionId}>
              <h4 className="mb-2 text-[12.5px] font-semibold text-muted">
                {section ? sectionName(section as Section, t.editor, locale) : r.sectionGone}
              </h4>
              <ul className="flex flex-col gap-2">
                {list.map((c) => (
                  <CommentCard
                    key={c.id}
                    comment={c}
                    focused={c.id === focus}
                    onShow={section?.enabled ? () => onShow(c) : null}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CommentCard({
  comment,
  focused,
  onShow,
}: {
  comment: ReviewComment;
  focused: boolean;
  onShow: (() => void) | null;
}) {
  const review = useReview()!;
  const { t, date } = useUi();
  const r = t.studio.review;
  const { toast } = useToast();
  const ref = useRef<HTMLLIElement>(null);
  const replyId = useId();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const handled = comment.status === 'handled';
  const when = (iso: string) =>
    date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const earlier =
    comment.draftUpdatedAt &&
    review.review &&
    Date.parse(comment.draftUpdatedAt) < Date.parse(review.review.updatedAt);

  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ block: 'center' });
    ref.current?.focus();
  }, [focused]);

  const act = async (key: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(key);
    const done = await review.commentCall(comment.id, path, method, body);
    setBusy(null);
    if (!done) toast({ title: t.common.error, variant: 'danger' });
    return done;
  };

  return (
    <li
      ref={ref}
      tabIndex={-1}
      className={cn(
        'rounded-card border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus',
        focused ? 'border-ink' : 'border-line',
        handled && 'bg-subtle',
      )}
      data-testid="review-comment"
      data-status={comment.status}
      data-number={comment.number}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
        <span
          aria-hidden
          className={cn(
            'inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold text-white',
            handled ? 'bg-[#57534e]' : 'bg-[#b42318]',
          )}
        >
          {comment.number}
        </span>
        <span className="sr-only">{fmt(r.pin, { n: comment.number })}</span>
        <bdi className="font-semibold text-ink">{comment.name}</bdi>
        <span>· {when(comment.createdAt)}</span>
        {handled ? <Badge variant="neutral">{r.handled}</Badge> : null}
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
        <bdi>{comment.body}</bdi>
      </p>
      {earlier ? <p className="mt-1 text-[12px] text-muted">{r.earlier}</p> : null}
      {comment.replies.length ? (
        <ul className="mt-2 flex flex-col gap-2 border-s-2 border-line ps-3">
          {comment.replies.map((x) => (
            <li key={x.id} className="text-[13px]">
              <span className="text-[12px] text-muted">
                <bdi className="font-semibold text-ink">{x.by === 'host' ? r.host : x.name}</bdi> ·{' '}
                {when(x.at)}
              </span>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">
                <bdi>{x.body}</bdi>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = reply.trim();
          if (!body) return;
          if (await act('reply', '/replies', 'POST', { id: crypto.randomUUID(), body })) setReply('');
        }}
      >
        <label htmlFor={replyId} className="sr-only">
          {fmt(r.replyLabel, { n: comment.number })}
        </label>
        <Textarea
          id={replyId}
          value={reply}
          maxLength={REVIEW.bodyMax}
          placeholder={r.replyPlaceholder}
          onChange={(e) => setReply(e.target.value)}
          className="min-h-[64px]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="submit"
            size="sm"
            icon={<Send className="icon-dir" />}
            loading={busy === 'reply'}
            disabled={!reply.trim()}
          >
            {r.send}
          </Button>
          <Hint text={handled ? r.reopenHint : r.markHandledHint}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={handled ? <RotateCcw /> : <CircleCheck />}
              loading={busy === 'status'}
              onClick={() => void act('status', '', 'PATCH', { status: handled ? 'open' : 'handled' })}
            >
              {handled ? r.reopen : r.markHandled}
            </Button>
          </Hint>
          {onShow ? (
            <Hint text={r.showHint}>
              <Button type="button" variant="ghost" size="sm" icon={<ScanEye />} onClick={onShow}>
                {r.show}
              </Button>
            </Hint>
          ) : null}
          <Hint text={r.removeHint}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<Trash2 />}
              onClick={() => setConfirm(true)}
            >
              {r.remove}
            </Button>
          </Hint>
        </div>
      </form>
      {confirm ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setConfirm(false)}
          title={fmt(r.removeTitle, { n: comment.number })}
          description={r.removeBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)} disabled={!!busy}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                loading={busy === 'remove'}
                onClick={async () => {
                  if (await act('remove', '', 'DELETE')) setConfirm(false);
                }}
              >
                {r.remove}
              </Button>
            </>
          }
        />
      ) : null}
    </li>
  );
}
