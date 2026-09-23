'use client';

import {
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  QrCode,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Field, Input, cn, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { SLUG_RE } from '../contracts/schemas';
import { validateDocument, type Issue } from '../contracts/validate';
import { hostApi } from '../app/api';
import { posterColors } from '../app/poster';
import { formatEventDate } from '../lib/dates';
import { hostsText, issueText, sectionName } from './fields/fields';
import { issueTarget } from './issues';
import { useEditor } from './state/EditorProvider';

type SlugState = 'current' | 'checking' | 'available' | 'taken' | 'invalid';
type PublishResponse =
  | { ok: true; slug: string; version: number; publishedAt: string; updatedAt: string; warnings: Issue[] }
  | { ok: false; code: string; issues?: Issue[] };

/**
 * Publish (§7.7, §9B.3-F): the address with a live availability check, blocking errors and warnings
 * (each row jumps to its field), the WhatsApp card, then publish → the link to share.
 */
export function PublishDialog({ onClose, flush }: { onClose: () => void; flush: () => Promise<boolean> }) {
  const { doc, template, meta, setMeta, publicBaseUrl, select, setShowIssues } = useEditor();
  const { t, locale: ui, plural } = useUi();
  const { toast } = useToast();
  const e = t.editor;
  const p = e.publishDialog;
  const [slug, setSlug] = useState(meta.slug);
  const [slugState, setSlugState] = useState<SlugState>('current');
  const [phase, setPhase] = useState<'review' | 'publishing' | 'done'>('review');
  const [error, setError] = useState<string | null>(null);
  const base = publicBaseUrl.replace(/\/+$/, '');
  const url = `${base}/i/${phase === 'done' ? meta.slug : slug}`;

  const { errors, warnings } = useMemo(
    () => validateDocument({ ...doc, share: { ...doc.share, slug } }, template, { mode: 'publish' }),
    [doc, template, slug],
  );
  // The slug's own format is shown next to the field, not in the list.
  const listErrors = errors.filter((i) => i.path !== 'share.slug');

  useEffect(() => {
    if (slug === meta.slug) return setSlugState('current');
    if (!SLUG_RE.test(slug)) return setSlugState('invalid');
    setSlugState('checking');
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await hostApi<{ valid: boolean; available: boolean }>(
          `/api/invitations/slug?${new URLSearchParams({ slug, id: meta.id })}`,
          { signal: ctrl.signal },
        );
        if (!res.body) return setSlugState('available'); // offline: the publish call decides
        setSlugState(!res.body.valid ? 'invalid' : res.body.available ? 'available' : 'taken');
      } catch {
        // aborted by a newer keystroke
      }
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [slug, meta.slug, meta.id]);

  const jump = (issue: Issue) => {
    const target = issueTarget(issue, doc);
    if (!target) return;
    setShowIssues(true);
    onClose();
    select(target, issue.path.replace(/\.(he|en)$/, ''));
  };

  const publish = async () => {
    setError(null);
    setPhase('publishing');
    if (!(await flush())) {
      setPhase('review');
      return setError(p.failed);
    }
    const res = await hostApi<PublishResponse>(`/api/invitations/${meta.id}/publish`, {
      method: 'POST',
      body: slug === meta.slug ? {} : { slug },
    });
    const body = res.body;
    if (res.ok && body?.ok) {
      setMeta({
        slug: body.slug,
        status: 'published',
        version: body.version,
        publishedAt: body.publishedAt,
        unpublishedChanges: false,
      });
      setShowIssues(false);
      setPhase('done');
      toast({ title: p.published, variant: 'success' });
      return;
    }
    setPhase('review');
    if (res.status === 409) setSlugState('taken');
    else if (res.status === 422) setShowIssues(true);
    else setError(p.failed);
  };

  const blocked =
    listErrors.length > 0 || slugState === 'taken' || slugState === 'invalid' || slugState === 'checking';
  const labelOf = (issue: Issue) => {
    if (issue.code === 'empty_section' && issue.sectionId) {
      const s = doc.sections.find((x) => x.id === issue.sectionId);
      if (s) return issueText(issue, e, sectionName(s, e, ui));
    }
    return issueText(issue, e);
  };
  const where = (issue: Issue) => {
    const target = issueTarget(issue, doc);
    if (!target) return '';
    if (target.kind === 'panel') return e.names[target.panel];
    const s = doc.sections.find((x) => x.id === target.id);
    return s ? sectionName(s, e, ui) : '';
  };

  if (phase === 'done') {
    const message = `${hostsText(doc, doc.defaultLocale)}\n${url}`;
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={p.doneTitle}
        description={p.doneBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" icon={<ExternalLink className="icon-dir" />} asChild>
              <a href={url} target="_blank" rel="noreferrer">
                {p.open}
              </a>
            </Button>
            <Button variant="secondary" icon={<QrCode />} asChild>
              <Link href={`/app/invitations/${meta.id}/share`}>{p.moreSharing}</Link>
            </Button>
            <Button variant="whatsapp" icon={<MessageCircle />} asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                {p.toShare}
              </a>
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Input readOnly value={url} dir="ltr" onFocus={(ev) => ev.target.select()} />
          <Button
            variant="secondary"
            icon={<Copy />}
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => toast({ title: p.copied, variant: 'success' }))
            }
          >
            {p.copy}
          </Button>
        </div>
      </Dialog>
    );
  }

  const colors = posterColors(template, doc.cover.sealColor);
  const cardTitle = doc.share.ogTitle?.[doc.defaultLocale]?.trim() || hostsText(doc, doc.defaultLocale);
  const cardDescription =
    doc.share.ogDescription?.[doc.defaultLocale]?.trim() || formatEventDate(doc, doc.defaultLocale);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && phase !== 'publishing' && onClose()}
      title={meta.status === 'published' ? p.titleUpdate : p.title}
      closeLabel={phase === 'publishing' ? undefined : t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={phase === 'publishing'}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => void publish()} disabled={blocked} loading={phase === 'publishing'}>
            {phase === 'publishing' ? p.publishing : p.publish}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label={p.slug}
          help={slugState === 'invalid' ? undefined : p.slugHelp}
          error={slugState === 'invalid' ? p.invalid : slugState === 'taken' ? p.taken : undefined}
        >
          <div className="flex items-center gap-2" dir="ltr">
            <span className="shrink-0 text-[13px] text-muted">{base.replace(/^https?:\/\//, '')}/i/</span>
            <Input
              value={slug}
              onChange={(ev) =>
                setSlug(
                  ev.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .slice(0, 60),
                )
              }
              dir="ltr"
              textAlign="start"
              spellCheck={false}
              autoComplete="off"
            />
            <SlugBadge state={slugState} />
          </div>
        </Field>

        <section aria-labelledby="publish-issues">
          <h3 id="publish-issues" className="sr-only">
            {p.title}
          </h3>
          {listErrors.length === 0 && warnings.length === 0 ? (
            <p className="flex items-center gap-2 rounded-card bg-success-bg px-3 py-2.5 text-[13px] font-semibold text-success">
              <CircleCheck aria-hidden size={16} strokeWidth={1.75} />
              {p.ready}
            </p>
          ) : null}
          {listErrors.length ? (
            <IssueList
              title={plural(p.errors, listErrors.length)}
              tone="error"
              issues={listErrors}
              labelOf={labelOf}
              where={where}
              onJump={jump}
              goTo={p.goTo}
            />
          ) : null}
          {warnings.length ? (
            <IssueList
              title={plural(p.warnings, warnings.length)}
              tone="warning"
              issues={warnings}
              labelOf={labelOf}
              where={where}
              onJump={jump}
              goTo={p.goTo}
              className={listErrors.length ? 'mt-3' : undefined}
            />
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">{p.card}</h3>
          <div
            className="max-w-[320px] rounded-[10px] bg-[#DCF8C6] p-1.5 shadow-sm"
            dir={doc.defaultLocale === 'he' ? 'rtl' : 'ltr'}
          >
            <div className="overflow-hidden rounded-[8px] bg-white/70">
              <div className="grid h-[120px] place-items-center" style={{ background: colors.background }}>
                <span
                  className="grid size-12 place-items-center rounded-full text-[11px] font-bold text-black/35 shadow-md"
                  style={{ background: colors.seal }}
                >
                  <bdi>{doc.cover.monogram?.[doc.defaultLocale] ?? ''}</bdi>
                </span>
              </div>
              <div className="px-2.5 py-2" lang={doc.defaultLocale}>
                <div className="truncate text-[13px] font-semibold text-[#111]">{cardTitle}</div>
                <div className="truncate text-[12px] text-[#555]">{cardDescription}</div>
                <div className="truncate text-[11px] text-[#777]" dir="ltr">
                  {base.replace(/^https?:\/\//, '')}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function SlugBadge({ state }: { state: SlugState }) {
  const { t } = useUi();
  const p = t.editor.publishDialog;
  if (state === 'checking')
    return (
      <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted" aria-live="polite">
        <LoaderCircle aria-hidden size={14} className="motion-safe:animate-spin" />
        {p.checking}
      </span>
    );
  if (state === 'available' || state === 'current')
    return (
      <span
        className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-success"
        aria-live="polite"
      >
        <CircleCheck aria-hidden size={14} strokeWidth={1.75} />
        {state === 'current' ? p.current : p.available}
      </span>
    );
  return null;
}

function IssueList({
  title,
  tone,
  issues,
  labelOf,
  where,
  onJump,
  goTo,
  className,
}: {
  title: string;
  tone: 'error' | 'warning';
  issues: Issue[];
  labelOf: (i: Issue) => string;
  where: (i: Issue) => string;
  onJump: (i: Issue) => void;
  goTo: string;
  className?: string;
}) {
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;
  return (
    <div className={className}>
      <p className={cn('mb-1.5 text-[13px] font-bold', tone === 'error' ? 'text-danger' : 'text-warning')}>
        {title}
      </p>
      <ul className="max-h-[240px] overflow-auto rounded-card border border-line">
        {issues.map((issue, i) => (
          <li key={`${issue.path}-${issue.code}-${i}`} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onJump(issue)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-start hover:bg-subtle"
              aria-label={`${labelOf(issue)} — ${goTo}`}
            >
              <Icon
                aria-hidden
                size={16}
                strokeWidth={1.75}
                className={cn('mt-0.5 shrink-0', tone === 'error' ? 'text-danger' : 'text-warning')}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">{labelOf(issue)}</span>
                {where(issue) ? <span className="block text-[12px] text-muted">{where(issue)}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
