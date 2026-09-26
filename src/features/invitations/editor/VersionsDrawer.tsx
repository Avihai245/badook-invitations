'use client';

import { ChevronDown, ExternalLink, RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Badge, Button, Dialog, Drawer, Hint, Segmented, Skeleton, cn, useToast } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { InvitationDocument } from '../contracts/types';
import { hostApi } from '../app/api';
import { HelpFor } from '../app/HelpFor';
import { describeChanges, type DocChange } from '../lib/doc-diff';
import type { HistoryEntry } from '../lib/versions';
import { getTemplate } from '../templates/registry';
import { sectionName } from './fields/fields';
import { useEditor } from './state/EditorProvider';

type Filter = 'all' | 'publish' | 'save';
/** What the drawer lists of the changes before "and n more". */
const SHOWN_CHANGES = 8;

/**
 * Versions and saves (§7.8, Phase 5C): every publish, and the draft's saves (kept while the host edits,
 * before a restore, before a design concept) — filtered, each viewable full-page in a new tab, with
 * what restoring it would change (section by section, in words), and restorable into the draft: the
 * server keeps the draft it replaces first, and in the editor the restore is one undo step.
 */
export function VersionsDrawer({
  onClose,
  onRestored,
  flush,
}: {
  onClose: () => void;
  onRestored: (draft: InvitationDocument, updatedAt: string) => void;
  /** saves pending changes first (the draft kept before the restore is the current one) */
  flush: () => Promise<boolean>;
}) {
  const { meta, doc } = useEditor();
  const { t, date, locale } = useUi();
  const { toast } = useToast();
  const h = t.studio.history;
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [keep, setKeep] = useState<{ days: number; max: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [docs, setDocs] = useState<Record<number, InvitationDocument | 'failed' | 'loading'>>({});
  const [confirm, setConfirm] = useState<HistoryEntry | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void hostApi<{ ok: boolean; entries: HistoryEntry[]; keep: { days: number; max: number } }>(
      `/api/invitations/${meta.id}/history`,
    ).then((res) => {
      if (!live) return;
      if (res.ok && res.body?.ok) {
        setRows(res.body.entries);
        setKeep(res.body.keep);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [meta.id, meta.version]);

  const label = (e: HistoryEntry) =>
    e.kind === 'publish' ? fmt(h.kinds.publish, { n: e.version ?? '' }) : h.kinds[e.reason ?? 'autosave'];

  const expand = (e: HistoryEntry) => {
    const next = openId === e.id ? null : e.id;
    setOpenId(next);
    if (next === null || docs[e.id]) return;
    setDocs((d) => ({ ...d, [e.id]: 'loading' }));
    void hostApi<{ ok: boolean; document: InvitationDocument }>(
      `/api/invitations/${meta.id}/history/${e.id}`,
    ).then((res) =>
      setDocs((d) => ({ ...d, [e.id]: res.ok && res.body?.ok ? res.body.document : 'failed' })),
    );
  };

  const restore = async (e: HistoryEntry) => {
    setBusy(true);
    // the server keeps the draft it replaces: first the latest edits have to be there
    await flush();
    const res = await hostApi<{ ok: boolean; draft: InvitationDocument; updatedAt: string }>(
      `/api/invitations/${meta.id}/history/${e.id}/restore`,
      { method: 'POST' },
    );
    setBusy(false);
    setConfirm(null);
    if (res.ok && res.body?.ok) {
      onRestored(res.body.draft, res.body.updatedAt);
      toast({ title: fmt(h.restored, { label: label(e) }), variant: 'success' });
      onClose();
    } else toast({ title: t.common.error, variant: 'danger' });
  };

  const shown = (rows ?? []).filter((e) => filter === 'all' || e.kind === filter);
  return (
    <>
      <Drawer
        open
        onOpenChange={(o) => !o && onClose()}
        title={h.title}
        description={h.description}
        closeLabel={t.common.close}
        help={<HelpFor area="history" inDialog />}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <Segmented<Filter>
            label={h.filter}
            value={filter}
            onValueChange={setFilter}
            options={(['all', 'publish', 'save'] as const).map((f) => ({ value: f, label: h.filters[f] }))}
          />
        </div>
        {rows === null && !failed ? (
          <div aria-busy className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} />
            ))}
          </div>
        ) : failed ? (
          <p role="alert" className="text-[13px] text-danger">
            {h.failed}
          </p>
        ) : !rows?.length ? (
          <p className="text-[13px] text-muted">{h.empty}</p>
        ) : !shown.length ? (
          <p className="text-[13px] text-muted">{h.emptyFilter}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="history-list">
            {shown.map((e) => (
              <HistoryRow
                key={e.id}
                entry={e}
                label={label(e)}
                live={e.kind === 'publish' && meta.status === 'published' && e.version === meta.version}
                when={date(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                open={openId === e.id}
                onToggle={() => expand(e)}
                target={docs[e.id]}
                current={doc}
                onRestore={() => setConfirm(e)}
                invitationId={meta.id}
                uiLocale={locale}
              />
            ))}
          </ul>
        )}
        {keep ? (
          <p className="mt-4 text-[12px] text-muted">{fmt(h.keep, { days: keep.days, max: keep.max })}</p>
        ) : null}
      </Drawer>
      {confirm ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setConfirm(null)}
          title={fmt(h.restoreTitle, { label: label(confirm) })}
          description={h.restoreBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => void restore(confirm)} loading={busy}>
                {h.restore}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

function HistoryRow({
  entry,
  label,
  live,
  when,
  open,
  onToggle,
  target,
  current,
  onRestore,
  invitationId,
  uiLocale,
}: {
  entry: HistoryEntry;
  label: string;
  live: boolean;
  when: string;
  open: boolean;
  onToggle: () => void;
  target: InvitationDocument | 'failed' | 'loading' | undefined;
  current: InvitationDocument;
  onRestore: () => void;
  invitationId: string;
  uiLocale: 'he' | 'en';
}) {
  const { t } = useUi();
  const h = t.studio.history;
  const panelId = useId();
  const templateId = entry.templateId ?? current.templateId;
  const otherDesign = templateId !== current.templateId ? getTemplate(templateId)?.manifest : null;
  const href = `/app/preview-frame/${templateId}?${new URLSearchParams({ invitation: invitationId, entry: String(entry.id) })}`;
  return (
    <li
      className="rounded-card border border-line bg-surface"
      data-testid="history-entry"
      data-kind={entry.kind}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
            {label}
            {live ? <Badge variant="live">{h.live}</Badge> : null}
          </div>
          <div className="text-[12px] text-muted">
            {when}
            {otherDesign ? (
              <>
                {' · '}
                {fmt(h.otherDesign, {
                  name: otherDesign.name[uiLocale] ?? otherDesign.name.en ?? otherDesign.id,
                })}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Hint text={h.viewHint}>
            <Button variant="ghost" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
              <a href={href} target="_blank" rel="noreferrer">
                {h.view}
              </a>
            </Button>
          </Hint>
          <Hint text={h.restoreHint}>
            <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={onRestore}>
              {h.restore}
            </Button>
          </Hint>
        </div>
      </div>
      <Hint text={h.changesHint}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-start text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          <ChevronDown
            aria-hidden
            size={14}
            strokeWidth={1.75}
            className={cn(
              'shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
          {open ? h.hideChanges : h.changes}
        </button>
      </Hint>
      {open ? (
        <div id={panelId} className="px-3 pb-3" data-testid="history-changes">
          {target === 'loading' || target === undefined ? (
            <p role="status" className="text-[12.5px] text-muted">
              {h.comparing}
            </p>
          ) : target === 'failed' ? (
            <p role="alert" className="text-[12.5px] text-danger">
              {t.common.error}
            </p>
          ) : (
            <ChangeList changes={describeChanges(current, target)} uiLocale={uiLocale} />
          )}
        </div>
      ) : null}
    </li>
  );
}

/** What restoring would change, in words (the first few, then how many more). */
function ChangeList({ changes, uiLocale }: { changes: DocChange[]; uiLocale: 'he' | 'en' }) {
  const { t, plural } = useUi();
  const c = t.studio.changes;
  const lines = useMemo(
    () =>
      changes.map((ch) => {
        switch (ch.kind) {
          case 'template': {
            const m = getTemplate(ch.templateId)?.manifest;
            return fmt(c.template, { name: m?.name[uiLocale] ?? m?.name.en ?? ch.templateId });
          }
          case 'added':
          case 'removed':
          case 'shown':
          case 'hidden':
            return fmt(c[ch.kind], { name: sectionName(ch.section, t.editor, uiLocale) });
          case 'changed':
            return fmt(c.changed, {
              name: sectionName(ch.section, t.editor, uiLocale),
              fields: ch.fields.map((f) => c.fields[f]).join(', '),
            });
          default:
            return c[ch.kind];
        }
      }),
    [changes, c, t.editor, uiLocale],
  );
  if (!lines.length) return <p className="text-[12.5px] text-muted">{t.studio.history.same}</p>;
  const rest = lines.length - SHOWN_CHANGES;
  return (
    <ul className="flex list-disc flex-col gap-1 ps-5 text-[12.5px] leading-relaxed">
      {lines.slice(0, SHOWN_CHANGES).map((line, i) => (
        <li key={i}>{line}</li>
      ))}
      {rest > 0 ? <li className="list-none text-muted">{plural(c.more, rest)}</li> : null}
    </ul>
  );
}
