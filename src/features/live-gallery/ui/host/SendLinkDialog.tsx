'use client';

import { Check, Copy, Globe, MessageCircle, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dialog, Hint, IconButton, Segmented, Skeleton, useToast } from '@/components/app';
import { isolate } from '@/features/event-day/messages';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { nativeName } from '@/features/invitations/lib/locales';
import {
  guestLocale,
  templateChain,
  valuesLocale,
  type TemplateLanguage,
} from '@/features/whatsapp/languages';
import { fillTemplate, GALLERY_TEMPLATE_TEXT } from '@/features/whatsapp/template-text';
import { fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { GALLERY_MESSAGE, guestGalleryLink } from '../../messages';
import type { GalleryNoticeGuest, GalleryNoticeInvitation } from '../../server/notices-api';
import type { Skipped } from '../../server/notices-db';

type GalleryNoticeRow = GalleryNoticeGuest;

interface NoticesState {
  rows: GalleryNoticeRow[];
  ready: boolean;
  /** the languages the gallery's template is set up in */
  langs: TemplateLanguage[];
  credits: number;
  unlimited: boolean;
  /** the gallery's link for guests (each guest's adds `&g=<their token>`, and their language) */
  link: string;
  /** the invitation's languages and the hosts in each (the messages are in the guest's language) */
  own: GalleryNoticeInvitation;
}

/** Where a guest stands with the gallery link. */
type RowState = 'queued' | 'sent' | 'failed' | 'unsent';
const rowState = (r: GalleryNoticeRow): RowState =>
  r.queued ? 'queued' : !r.last ? 'unsent' : r.last.status === 'failed' ? 'failed' : 'sent';

type Tab = 'all' | 'unsent' | 'sent';
const IN_TAB: Record<Tab, (s: RowState) => boolean> = {
  all: () => true,
  unsent: (s) => s === 'unsent' || s === 'failed',
  sent: (s) => s === 'sent' || s === 'queued',
};
/** a guest the system's number can send to now */
const sendable = (r: GalleryNoticeRow) => {
  const s = rowState(r);
  return (s === 'unsent' || s === 'failed') && r.reach === 'ok';
};
/** a phone WhatsApp reaches (the host's own WhatsApp too — a landline never has it) */
const mobile = (r: GalleryNoticeRow) => !!r.phone && (r.reach === 'ok' || r.reach === 'opted_out');
const markable = (r: GalleryNoticeRow) => {
  const s = rowState(r);
  return s === 'unsent' || s === 'failed';
};

/**
 * "{language}: 3 messages" with the language's own name kept whole in its direction (<bdi>): a
 * right-to-left name never pulls the colon and the number into its run in a left-to-right line.
 */
function languageLine(text: string, l: Locale) {
  const [before = '', after = ''] = text.split('{language}');
  return (
    <>
      {before}
      <bdi lang={l}>{nativeName(l)}</bdi>
      {after}
    </>
  );
}

/**
 * The guests by the language the system's message is written in (the sender's choice: their own
 * language when the gallery's template is approved in it, else the invitation's —
 * features/whatsapp/languages), in the order the template's languages are configured; and the
 * languages guests wanted but get another one instead.
 */
function byLanguage(recipients: readonly GalleryNoticeRow[], data: NoticesState) {
  const doc = { locales: data.own.locales, defaultLocale: data.own.locale };
  const groups = new Map<Locale, GalleryNoticeRow[]>();
  const fallbacks = new Map<string, { wanted: Locale; got: Locale }>();
  for (const r of recipients) {
    const got = templateChain(r.language, doc, data.langs)[0]?.locale ?? data.own.locale;
    groups.set(got, [...(groups.get(got) ?? []), r]);
    const wanted = guestLocale(r.language, doc);
    if (wanted !== got) fallbacks.set(`${wanted}>${got}`, { wanted, got });
  }
  return { groups: [...groups], fallbacks: [...fallbacks.values()] };
}

/**
 * "Send guests the gallery link": every guest of the list with their own link to the gallery (it keeps
 * their personal link: their uploads carry their name, and opens in their language), what they got
 * already, and three ways to send it — the system's WhatsApp number (the third template, in each
 * guest's language when it is approved in it; a credit each — how many go out in each language, and
 * each message as it will look), the host's own WhatsApp (a ready message in the guest's language,
 * then marked as sent), or that message copied. Marking by hand for the rest.
 */
export function SendLinkDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { t, fmt, plural, number } = useUi();
  const N = t.galleryNotify;
  const { toast } = useToast();
  const [data, setData] = useState<NoticesState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState<'send' | 'mark' | null>(null);

  const load = useCallback(async () => {
    const res = await hostApi<NoticesState & { code?: string }>(`/api/invitations/${id}/gallery/notices`);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body) {
      setError(res.body?.code === 'no_gallery' ? N.noGallery : N.errors.failed);
      return;
    }
    setError(null);
    setData(res.body);
  }, [id, N.noGallery, N.errors.failed]);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setTab(null);
    void load();
  }, [open, load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: rows.length, unsent: 0, sent: 0 };
    for (const r of rows) {
      const s = rowState(r);
      if (IN_TAB.unsent(s)) c.unsent += 1;
      if (IN_TAB.sent(s)) c.sent += 1;
    }
    return c;
  }, [rows]);
  const current: Tab = tab ?? (counts.unsent ? 'unsent' : 'all');
  const shown = rows.filter((r) => IN_TAB[current](rowState(r)));
  const toSend = shown.filter(sendable);
  const toMark = shown.filter(markable);
  const short = !!data && !data.unlimited && data.credits < toSend.length;
  const shortText = data
    ? fmt(N.errors.credits, { needed: number(toSend.length), balance: number(data.credits) })
    : '';
  const doc = data ? { locales: data.own.locales, defaultLocale: data.own.locale } : null;
  /** the guest's language: their own when the invitation has it, else its default */
  const languageOf = (r: GalleryNoticeRow): Locale | null => (doc ? guestLocale(r.language, doc) : null);
  /** the ready message with the guest's own gallery link (opening in their language), in their language */
  const messageOf = (r: GalleryNoticeRow) => {
    const l = languageOf(r);
    if (!data || !l) return null;
    return format(GALLERY_MESSAGE[l], {
      name: isolate(r.name),
      hosts: isolate(data.own.hosts[l] ?? data.own.hosts[data.own.locale] ?? ''),
      url: guestGalleryLink(data.link, r.token, l, data.own.locale),
    });
  };

  // the system's messages by language, and the message of each language as it will look
  const { groups, fallbacks } = data ? byLanguage(toSend, data) : { groups: [], fallbacks: [] };
  const [previewLang, setPreviewLang] = useState<Locale | null>(null);
  const firstLang =
    doc && data ? (templateChain(null, doc, data.langs)[0]?.locale ?? doc.defaultLocale) : 'he';
  const lang: Locale =
    previewLang && groups.some(([l]) => l === previewLang) ? previewLang : (groups[0]?.[0] ?? firstLang);
  const template = GALLERY_TEMPLATE_TEXT[lang];
  const sample = groups.find(([l]) => l === lang)?.[1][0]?.name ?? toSend[0]?.name ?? '';
  const preview =
    data && doc ? fillTemplate(template.body, [sample, data.own.hosts[valuesLocale(lang, doc)] ?? '']) : '';

  const skippedLine = (skipped: Skipped | undefined) => {
    if (!skipped) return null;
    const parts = (Object.keys(N.reasons) as (keyof typeof N.reasons)[])
      .filter((k) => (skipped[k] ?? 0) > 0)
      .map((k) => fmt(N.reasons[k], { n: number(skipped[k]!) }));
    return parts.length ? fmt(N.skipped, { reasons: parts.join(', ') }) : null;
  };

  const mark = async (guestIds: string[], quiet = false) => {
    if (!guestIds.length) return;
    if (!quiet) setBusy('mark');
    const res = await hostApi<{ marked?: number }>(`/api/invitations/${id}/gallery/notices`, {
      method: 'POST',
      body: { action: 'mark', guestIds },
    });
    setBusy(null);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body) return toast({ variant: 'danger', title: N.errors.failed });
    const n = res.body.marked ?? 0;
    if (!quiet) toast({ variant: 'success', title: plural(N.marked, n, { n: number(n) }) });
    await load();
  };

  const send = async () => {
    const guestIds = toSend.map((r) => r.guestId);
    if (!guestIds.length) return;
    setBusy('send');
    const res = await hostApi<{
      code?: string;
      queued?: number;
      pending?: number;
      needed?: number;
      balance?: number;
      skipped?: Skipped;
    }>(`/api/invitations/${id}/gallery/notices`, { method: 'POST', body: { action: 'send', guestIds } });
    setBusy(null);
    if (res.status === 401) return window.location.assign(loginUrl());
    const body = res.body;
    if (!res.ok || !body) {
      const code = body?.code;
      const title =
        code === 'credits'
          ? fmt(N.errors.credits, { needed: number(body?.needed ?? 0), balance: number(body?.balance ?? 0) })
          : code === 'nobody' || code === 'no_gallery'
            ? N.errors[code]
            : code === 'not_configured'
              ? N.notReady
              : N.errors.failed;
      toast({ variant: 'danger', title, description: skippedLine(body?.skipped) ?? undefined });
      return;
    }
    const waiting = (body.pending ?? 0) > 0 ? fmt(N.waiting, { n: number(body.pending ?? 0) }) : null;
    toast({
      variant: 'success',
      title: plural(N.sent, body.queued ?? 0, { n: number(body.queued ?? 0) }),
      description: [waiting, skippedLine(body.skipped)].filter(Boolean).join(' ') || undefined,
    });
    await load();
  };

  /** "Send from my WhatsApp": wa.me with the message in the guest's language, then marked as sent. */
  const sendOwn = (r: GalleryNoticeRow) => {
    const text = messageOf(r);
    if (!text || !r.phone) return;
    window.open(
      `https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
    void mark([r.guestId], true);
  };

  /** The same message, copied — to send it any other way. */
  const copy = (r: GalleryNoticeRow) => {
    const text = messageOf(r);
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast({ variant: 'success', title: N.copied }),
      () => toast({ variant: 'danger', title: N.errors.failed }),
    );
  };

  const badge = (r: GalleryNoticeRow) => {
    const s = rowState(r);
    if (s === 'queued') return <Badge variant="info">{N.row.queued}</Badge>;
    if (s === 'unsent') return <Badge variant="draft">{N.row.unsent}</Badge>;
    if (s === 'failed') return <Badge variant="warning">{N.row.failed}</Badge>;
    const last = r.last!;
    const text =
      last.channel === 'manual'
        ? N.row.manual
        : last.status === 'read'
          ? N.row.read
          : last.status === 'delivered'
            ? N.row.delivered
            : N.row.sent;
    return <Badge variant="live">{text}</Badge>;
  };
  const reachNote = (r: GalleryNoticeRow) =>
    r.reach === 'none'
      ? N.row.noPhone
      : r.reach === 'landline'
        ? N.row.landline
        : r.reach === 'opted_out'
          ? N.row.optedOut
          : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={N.title}
      description={N.intro}
      closeLabel={N.close}
      className="max-w-[640px]"
      footer={
        data && rows.length ? (
          <>
            <Hint text={N.markAllHint}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Check />}
                disabled={!toMark.length}
                loading={busy === 'mark'}
                onClick={() => void mark(toMark.map((r) => r.guestId))}
                className="me-auto"
                data-testid="gallery-notices-mark-all"
              >
                {N.markAll}
              </Button>
            </Hint>
            {data.ready ? (
              <Hint
                text={fmt(N.sendAllHint, { brand: t.brand })}
                disabledText={toSend.length ? shortText : N.sendNone}
              >
                <Button
                  variant="whatsapp"
                  size="sm"
                  icon={<Send className="icon-dir" />}
                  disabled={!toSend.length || short}
                  loading={busy === 'send'}
                  onClick={() => void send()}
                  data-testid="gallery-notices-send"
                >
                  {toSend.length
                    ? plural(N.sendAll, toSend.length, { n: number(toSend.length) })
                    : N.sendNone}
                </Button>
              </Hint>
            ) : null}
          </>
        ) : null
      }
    >
      {!data ? (
        error ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[13.5px] text-danger">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {t.common.retry}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={52} radius={10} />
            ))}
          </div>
        )
      ) : !rows.length ? (
        <p className="text-[13.5px] text-muted">{N.empty}</p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="gallery-notices">
          {!data.ready ? (
            <p className="rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">{N.notReady}</p>
          ) : null}
          <p className="text-[12.5px] text-muted">
            {plural(N.counts, rows.length, { guests: number(rows.length), sent: number(counts.sent) })}
          </p>
          <Segmented<Tab>
            value={current}
            onValueChange={setTab}
            label={N.title}
            className="max-w-full overflow-x-auto"
            options={(['all', 'unsent', 'sent'] as const).map((k) => ({
              value: k,
              label: `${N.tabs[k]} · ${number(counts[k])}`,
            }))}
          />
          <ul
            className="-mx-1 flex max-h-[46dvh] flex-col overflow-y-auto px-1"
            data-testid="gallery-notices-rows"
          >
            {shown.map((r) => {
              const note = reachNote(r);
              // the language their messages are written in (an invitation in several languages)
              const language = data.own.locales.length > 1 ? languageOf(r) : null;
              return (
                <li
                  key={r.guestId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2.5 last:border-b-0"
                  data-notice-row={r.name}
                  data-notice-state={rowState(r)}
                >
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <p className="truncate text-[14px] font-semibold">
                      <bdi>{r.name}</bdi>
                      {r.group ? (
                        <span className="ms-2 text-[12.5px] font-normal text-muted">{r.group}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      {badge(r)}
                      {language ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px] text-muted"
                          data-notice-language={language}
                        >
                          <Globe aria-hidden className="size-3" />
                          <span lang={language}>{nativeName(language)}</span>
                        </span>
                      ) : null}
                      {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {mobile(r) ? (
                      <Hint text={N.sendOwnHint}>
                        <IconButton label={N.sendOwn} size="sm" onClick={() => sendOwn(r)} data-send-own="">
                          <MessageCircle />
                        </IconButton>
                      </Hint>
                    ) : null}
                    {markable(r) ? (
                      <Hint text={N.markSentHint}>
                        <IconButton label={N.markSent} size="sm" onClick={() => void mark([r.guestId])}>
                          <Check />
                        </IconButton>
                      </Hint>
                    ) : null}
                    <Hint text={N.copyLinkHint}>
                      <IconButton label={N.copyLink} size="sm" onClick={() => copy(r)} data-copy-message="">
                        <Copy />
                      </IconButton>
                    </Hint>
                  </div>
                </li>
              );
            })}
          </ul>
          {data.ready && toSend.length ? (
            <p className={`text-end text-[12px] ${short ? 'font-semibold text-warning' : 'text-muted'}`}>
              {data.unlimited
                ? N.unlimited
                : short
                  ? shortText
                  : fmt(N.cost, { n: number(toSend.length), credits: number(data.credits) })}
            </p>
          ) : null}
          {data.ready && toSend.length ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {groups.length > 1 || fallbacks.length ? (
                <ul className="flex flex-col gap-0.5 text-[12.5px]" data-testid="gallery-notices-languages">
                  {groups.map(([l, list]) => (
                    <li key={l}>
                      · {languageLine(plural(N.byLanguage, list.length, { n: number(list.length) }), l)}
                    </li>
                  ))}
                  {fallbacks.map(({ wanted, got }) => (
                    <li key={`${wanted}-${got}`} className="text-muted">
                      ·{' '}
                      {fmt(N.fallback, {
                        language: t.editor.languageIn[wanted],
                        fallback: t.editor.languageIn[got],
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">
                  {groups.length > 1 ? fmt(N.previewIn, { language: t.editor.languageIn[lang] }) : N.preview}
                </p>
                {groups.length > 1 ? (
                  <Segmented<Locale>
                    label={N.preview}
                    value={lang}
                    onValueChange={setPreviewLang}
                    options={groups.map(([l]) => ({
                      value: l,
                      label: t.editor.languageShort[l],
                      ariaLabel: nativeName(l),
                    }))}
                  />
                ) : null}
              </div>
              <div
                className="rounded-[14px] bg-[#e7ddd3] p-3"
                dir={RTL_LOCALES.includes(lang) ? 'rtl' : 'ltr'}
                lang={lang}
                data-testid="gallery-notices-preview"
              >
                <div className="max-w-[340px] rounded-[10px] bg-white px-3 pt-2.5 pb-2 shadow-sm">
                  <p className="text-[13.5px] leading-[1.5] whitespace-pre-line text-[#111b21]">{preview}</p>
                  <p className="mt-1 text-[11.5px] text-[#667781]">{template.footer}</p>
                  <div className="mt-2 border-t border-[#e9edef] pt-2 text-center text-[13.5px] font-medium text-[#027eb5]">
                    {template.button}
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-muted">{N.previewHint}</p>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
