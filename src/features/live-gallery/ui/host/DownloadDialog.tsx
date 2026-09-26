'use client';

import { Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Dialog, Hint, Segmented } from '@/components/app';
import { hostApi } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { downloadAll, type DownloadPage, type DownloadProgress } from '../../client/download';
import { formatBytes } from '../../format';
import type { GalleryCounts } from '../../server/db';

type Phase = 'idle' | 'running' | 'done' | 'failed' | 'stopped';

/**
 * "Download everything": a ZIP of the original files written in the host's browser as they are
 * fetched (straight to disk where the browser can, else in parts), with its progress and a stop.
 * Everything, or only what is in the feed.
 */
export function DownloadDialog({
  invitationId,
  slug,
  counts,
}: {
  invitationId: string;
  slug: string;
  counts: GalleryCounts;
}) {
  const { t, fmt, plural, number, locale } = useUi();
  const d = t.liveGallery.download;
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'all' | 'published'>('all');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<{ files: number; missing: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase('running');
    setProgress(null);
    setResult(null);
    try {
      const out = await downloadAll({
        filename: `${slug}-gallery`,
        signal: controller.signal,
        missingListName: d.missingList,
        missingIntro: d.missingIntro,
        onProgress: setProgress,
        async page(after) {
          const res = await hostApi<DownloadPage & { ok: true }>(
            `/api/invitations/${invitationId}/gallery/originals`,
            {
              method: 'POST',
              body: { scope, ...(after ? { after } : {}) },
            },
          );
          if (!res.ok || !res.body) throw new Error(`originals: ${res.status}`);
          return res.body;
        },
      });
      setResult(out);
      setPhase('done');
    } catch (err) {
      setPhase(
        controller.signal.aborted || (err as { name?: string })?.name === 'AbortError' ? 'stopped' : 'failed',
      );
    } finally {
      abort.current = null;
    }
  };

  const total = scope === 'all' ? counts.total : counts.published;
  const running = phase === 'running';
  const pct = progress?.totalBytes
    ? Math.min(100, Math.round((progress.bytes / progress.totalBytes) * 100))
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && running) abort.current?.abort();
        setOpen(o);
        if (!o) setPhase('idle');
      }}
      trigger={
        <Hint text={t.liveGallery.hints.download}>
          <Button
            variant="secondary"
            icon={<Download />}
            disabled={!counts.total}
            data-testid="gallery-download"
          >
            {d.button}
          </Button>
        </Hint>
      }
      title={d.title}
      description={d.body}
      closeLabel={t.common.close}
      footer={
        running ? (
          <Button variant="secondary" onClick={() => abort.current?.abort()}>
            {d.cancel}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {d.close}
            </Button>
            <Button
              icon={<Download />}
              onClick={() => void start()}
              disabled={!total}
              data-testid="gallery-download-start"
            >
              {d.start}
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">{d.scope}</p>
          <Segmented
            label={d.scope}
            value={scope}
            onValueChange={setScope}
            disabled={running}
            fullWidth
            options={[
              { value: 'all', label: fmt(d.scopeAll, { n: number(counts.total) }) },
              { value: 'published', label: fmt(d.scopePublished, { n: number(counts.published) }) },
            ]}
          />
        </div>
        <p className="text-[12.5px] text-muted">
          {typeof window !== 'undefined' && 'showSaveFilePicker' in window ? d.stream : d.parts}
        </p>
        {phase !== 'idle' ? (
          <div role="status" aria-live="polite" data-testid="gallery-download-progress">
            <div className="h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${phase === 'done' ? 100 : pct}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] tabular-nums">
              {phase === 'done' && result
                ? plural(d.done, result.files)
                : phase === 'failed'
                  ? d.failed
                  : phase === 'stopped'
                    ? d.stopped
                    : progress
                      ? fmt(d.progress, {
                          files: number(progress.files),
                          total: number(progress.total),
                          done: formatBytes(progress.bytes, locale),
                          size: formatBytes(progress.totalBytes, locale),
                        })
                      : t.common.loading}
            </p>
            {running && progress?.current ? (
              <p className="mt-0.5 truncate text-[12px] text-muted" dir="ltr">
                {progress.part > 1 ? `${fmt(d.part, { n: progress.part })} · ` : ''}
                {progress.current}
              </p>
            ) : null}
            {phase === 'done' && result?.missing ? (
              <p className="mt-1 text-[12.5px] text-warning">{plural(d.missing, result.missing)}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
