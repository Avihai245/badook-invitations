'use client';

import { Copy, Download, ExternalLink, RefreshCw, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardTitle, Dialog, Hint, Input, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { DayView } from '../../server/host-api';

/**
 * The entrance stations' link: copy it, open it, its QR code (to open the station on the phone at the
 * door), and "new link" (asked first: the stations open with the old one stop working).
 */
export function StationCard({
  station,
  slug,
  onRotate,
}: {
  station: DayView['station'];
  slug: string;
  onRotate(): Promise<boolean>;
}) {
  const { t } = useUi();
  const s = t.eventDay.station;
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = station.url;
  const copy = () =>
    url &&
    navigator.clipboard.writeText(url).then(
      () => toast({ variant: 'success', title: s.copied }),
      () => toast({ variant: 'danger', title: t.eventDay.errors.failed }),
    );
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-testid="station-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <ScanLine className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <CardTitle as="h2" className="mb-1">
            {s.title}
          </CardTitle>
          <p className="text-[13px] text-muted">{s.body}</p>
        </div>
      </div>
      {url ? (
        <>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              dir="ltr"
              textAlign="start"
              aria-label={s.title}
              onFocus={(e) => e.target.select()}
              data-testid="station-link"
            />
            <Hint text={s.copyHint}>
              <Button variant="secondary" icon={<Copy />} onClick={() => void copy()}>
                {s.copy}
              </Button>
            </Hint>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {station.qr ? (
              <div
                role="img"
                aria-label={s.qrHint}
                className="size-28 shrink-0 overflow-hidden rounded-input border border-line bg-white p-1 [&>svg]:size-full"
                // generated on the server from the link (no user markup)
                dangerouslySetInnerHTML={{ __html: station.qr.svg }}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Hint text={s.openHint}>
                <Button variant="secondary" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    {s.open}
                  </a>
                </Button>
              </Hint>
              {station.qr ? (
                <Hint text={s.qrHint}>
                  <Button variant="secondary" size="sm" icon={<Download />} asChild>
                    <a href={station.qr.png} download={`${slug}-station-qr.png`}>
                      {s.qr}
                    </a>
                  </Button>
                </Hint>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">{s.lost}</p>
      )}
      <div className="border-t border-line pt-3">
        <Hint text={s.rotateHint}>
          <Button
            variant={url ? 'ghost' : 'primary'}
            size="sm"
            icon={<RefreshCw />}
            onClick={() => (url ? setConfirm(true) : void onRotate())}
            data-testid="station-rotate"
          >
            {s.rotate}
          </Button>
        </Hint>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={s.rotate}
        description={s.rotateConfirm}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              loading={busy}
              icon={<RefreshCw />}
              data-testid="station-rotate-confirm"
              onClick={async () => {
                setBusy(true);
                const done = await onRotate();
                setBusy(false);
                if (done) {
                  setConfirm(false);
                  toast({ variant: 'success', title: s.rotated });
                }
              }}
            >
              {s.rotate}
            </Button>
          </>
        }
      />
    </Card>
  );
}
