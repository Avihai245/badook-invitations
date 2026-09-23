'use client';

import { ExternalLink, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Dialog, Drawer, Skeleton, useToast } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { InvitationDocument } from '../contracts/types';
import { hostApi } from '../app/api';
import { useEditor } from './state/EditorProvider';

interface VersionRow {
  version: number;
  createdAt: string;
}

/**
 * Published versions (§7.8): list, view (full-page preview in a new tab), restore to the draft. The
 * restore is one undo step in the editor.
 */
export function VersionsDrawer({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  onRestored: (draft: InvitationDocument, updatedAt: string) => void;
}) {
  const { meta, template } = useEditor();
  const { t, date } = useUi();
  const { toast } = useToast();
  const v = t.editor.versionsDrawer;
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void hostApi<{ ok: boolean; versions: VersionRow[] }>(`/api/invitations/${meta.id}/versions`).then(
      (res) => {
        if (!live) return;
        if (res.ok && res.body) setRows([...res.body.versions].sort((a, b) => b.version - a.version));
        else setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [meta.id, meta.version]);

  const restore = async (n: number) => {
    setBusy(true);
    const res = await hostApi<{ ok: boolean; draft: InvitationDocument; updatedAt: string }>(
      `/api/invitations/${meta.id}/restore/${n}`,
      { method: 'POST' },
    );
    setBusy(false);
    setConfirm(null);
    if (res.ok && res.body?.ok) {
      onRestored(res.body.draft, res.body.updatedAt);
      toast({ title: fmt(v.restored, { n }), variant: 'success' });
      onClose();
    } else toast({ title: t.common.error, variant: 'danger' });
  };

  return (
    <>
      <Drawer
        open
        onOpenChange={(o) => !o && onClose()}
        title={v.title}
        description={v.description}
        closeLabel={t.common.close}
      >
        {rows === null && !failed ? (
          <div aria-busy className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} />
            ))}
          </div>
        ) : failed ? (
          <p className="text-[13px] text-danger">{v.failed}</p>
        ) : rows && rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const live = meta.status === 'published' && row.version === meta.version;
              const href = `/app/preview-frame/${template.id}?${new URLSearchParams({ invitation: meta.id, version: String(row.version) })}`;
              return (
                <li
                  key={row.version}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-semibold">
                      {fmt(v.version, { n: row.version })}
                      {live ? <Badge variant="live">{v.live}</Badge> : null}
                    </div>
                    <div className="text-[12px] text-muted">
                      {date(row.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
                    <a href={href} target="_blank" rel="noreferrer">
                      {v.view}
                    </a>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw />}
                    onClick={() => setConfirm(row.version)}
                  >
                    {v.restore}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{v.empty}</p>
        )}
      </Drawer>
      {confirm !== null ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setConfirm(null)}
          title={fmt(v.restoreTitle, { n: confirm })}
          description={v.restoreBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => void restore(confirm)} loading={busy}>
                {v.restore}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
