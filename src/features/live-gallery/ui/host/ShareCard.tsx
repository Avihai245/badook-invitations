'use client';

import { Copy, Download, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardTitle, Dialog, Hint, Input, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { HostGalleryView } from '../../server/host-api';

/**
 * The guests' link: copy it, open it, send it on WhatsApp, the QR code (PNG / SVG) for the tables,
 * and "new link" (the old one stops working — asked first).
 */
export function ShareCard({
  view,
  onRotate,
}: {
  view: HostGalleryView;
  onRotate(which: 'upload' | 'projector'): Promise<boolean>;
}) {
  const { t } = useUi();
  const s = t.liveGallery.share;
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const g = view.gallery!;
  const url = g.uploadUrl;

  const copy = () =>
    url &&
    navigator.clipboard.writeText(url).then(
      () => toast({ title: s.copied, variant: 'success' }),
      () => toast({ title: s.copyFailed, variant: 'danger' }),
    );

  return (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="gallery-share">
      <div>
        <CardTitle as="h2" className="mb-1">
          {s.title}
        </CardTitle>
        <p className="text-[13px] text-muted">{s.body}</p>
      </div>
      {url ? (
        <>
          <div>
            <label htmlFor="gallery-upload-link" className="mb-1.5 block text-[13px] font-semibold">
              {s.link}
            </label>
            <div className="flex gap-2">
              <Input
                id="gallery-upload-link"
                readOnly
                value={url}
                dir="ltr"
                textAlign="start"
                onFocus={(e) => e.target.select()}
                data-testid="gallery-upload-link"
              />
              <Hint text={t.liveGallery.hints.copy}>
                <Button variant="secondary" icon={<Copy />} onClick={() => void copy()}>
                  {s.copy}
                </Button>
              </Hint>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Hint text={t.liveGallery.hints.open}>
              <Button variant="secondary" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  {s.open}
                </a>
              </Button>
            </Hint>
            <Hint text={t.liveGallery.hints.whatsapp}>
              <Button variant="whatsapp" size="sm" icon={<MessageCircle />} asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(s.message.replace('{url}', url))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.whatsapp}
                </a>
              </Button>
            </Hint>
          </div>
          {g.qr ? (
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={s.qrLabel}
                className="size-32 shrink-0 overflow-hidden rounded-input border border-line bg-white p-1.5 sm:size-36 [&>svg]:size-full"
                // generated on the server from the link (no user markup)
                dangerouslySetInnerHTML={{ __html: g.qr.svg }}
              />
              <div className="grid gap-2">
                <p className="text-[13px] font-semibold">{s.qr}</p>
                <Button variant="secondary" size="sm" icon={<Download />} asChild>
                  <a href={g.qr.png} download={`${view.slug}-gallery-qr.png`} aria-label={s.downloadPng}>
                    PNG
                  </a>
                </Button>
                <Button variant="secondary" size="sm" icon={<Download />} asChild>
                  <a
                    href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(g.qr.svg)}`}
                    download={`${view.slug}-gallery-qr.svg`}
                    aria-label={s.downloadSvg}
                  >
                    SVG
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">{s.lost}</p>
      )}
      <div className="border-t border-line pt-3">
        <Hint text={t.liveGallery.hints.rotate}>
          <Button variant="ghost" size="sm" icon={<RefreshCw />} onClick={() => setConfirm(true)}>
            {s.rotate}
          </Button>
        </Hint>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={s.rotateTitle}
        description={s.rotateBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const done = await onRotate('upload');
                setBusy(false);
                if (done) {
                  setConfirm(false);
                  toast({ title: s.rotated, variant: 'success' });
                }
              }}
            >
              {s.rotateConfirm}
            </Button>
          </>
        }
      />
    </Card>
  );
}
