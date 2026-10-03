'use client';

import { FileText, Image as ImageIcon, Lock, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, IconButton } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { Attachment } from '../../model/plan';
import { usePlan } from '../PlanProvider';
import { MAX_FILES } from './helpers';

const TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;

/**
 * A vendor's files (quotes, contracts, receipts): the Pro tool. The browser uploads straight to the plan's
 * private folder with a signed URL (the files route hands it out) and reads them back through signed
 * links; the list is part of the vendor and is saved with it. Without the tool: a gentle card with the way
 * to Pro (and whatever the vendor already holds stays openable).
 */
export function VendorFiles({
  value,
  onChange,
  enabled,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  enabled: boolean;
}) {
  const { t, fmt, number } = useUi();
  const F = t.planning.vendors.files;
  const plan = usePlan();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const known = useRef<Set<string>>(new Set());

  // signed links for the files the vendor holds (an hour long; asked once per file)
  useEffect(() => {
    const paths = value.map((a) => a.path).filter((p) => !known.current.has(p));
    if (paths.length === 0) return;
    paths.forEach((p) => known.current.add(p));
    let live = true;
    void plan.call<{ urls?: Record<string, string> }>('/files', { op: 'read', paths }).then((res) => {
      if (!live) return;
      if (res.ok && res.body?.urls) setUrls((u) => ({ ...u, ...res.body!.urls }));
      else paths.forEach((p) => known.current.delete(p));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plan.call is stable for this event
  }, [value]);

  const upload = async (file: File) => {
    setError(null);
    if (value.length >= MAX_FILES) return setError(fmt(F.limit, { n: MAX_FILES }));
    if (!TYPES.includes(file.type)) return setError(F.badType);
    if (file.size > MAX_BYTES) return setError(F.tooLarge);
    setBusy(true);
    try {
      const signed = await plan.call<{ path?: string; url?: string }>('/files', {
        op: 'upload',
        purpose: 'attachment',
        contentType: file.type,
        size: file.size,
      });
      if (!signed.ok || !signed.body?.url || !signed.body.path)
        return setError(signed.status === 413 ? F.tooLarge : signed.status === 415 ? F.badType : F.failed);
      const sent = await fetch(signed.body.url, {
        method: 'PUT',
        headers: { 'content-type': file.type, 'x-upsert': 'false' },
        body: file,
      }).catch(() => null);
      if (!sent?.ok) return setError(F.failed);
      onChange([
        ...value,
        { path: signed.body.path, name: file.name.slice(0, 200), size: file.size, type: file.type },
      ]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const locked = !enabled;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{F.title}</h3>
        {locked ? null : (
          <>
            <input
              ref={input}
              type="file"
              accept={TYPES.join(',')}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button
              variant="secondary"
              icon={<Paperclip />}
              loading={busy}
              className="min-h-11"
              disabled={value.length >= MAX_FILES}
              onClick={() => input.current?.click()}
            >
              {busy ? F.uploading : F.add}
            </Button>
          </>
        )}
      </div>
      {locked ? null : <p className="-mt-2 text-[12.5px] text-muted">{F.hint}</p>}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {value.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((a) => {
            const href = urls[a.path];
            const Icon = a.type === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li
                key={a.path}
                className="flex items-center gap-2 rounded-card border border-line bg-surface ps-3 pe-1"
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={fmt(F.open, { name: a.name })}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-[13.5px] hover:underline"
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="shrink-0 text-[12px] text-muted" dir="ltr">
                      {sizeText(a.size)}
                    </span>
                  </a>
                ) : (
                  <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-[13.5px]">
                    <span className="truncate">{a.name}</span>
                    <span className="shrink-0 text-[12px] text-muted" dir="ltr">
                      {sizeText(a.size)}
                    </span>
                  </span>
                )}
                <IconButton
                  label={fmt(F.remove, { name: a.name })}
                  onClick={() => onChange(value.filter((x) => x.path !== a.path))}
                >
                  <X />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : locked ? null : (
        <p className="text-[13px] text-muted">{F.none}</p>
      )}
      {locked ? (
        <Card tone="info" padding="sm" className="flex flex-wrap items-center gap-3">
          <Lock aria-hidden className="size-4 shrink-0 text-info" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-[200px]">
            <p className="text-[13.5px] font-semibold text-info">{F.locked.title}</p>
            <p className="text-[12.5px] text-ink/80">{F.locked.body}</p>
          </div>
          <Button asChild variant="secondary" className="min-h-11">
            <Link href="/app/billing?plan=pro">{fmt(t.planning.common.upgrade, { plan: 'Pro' })}</Link>
          </Button>
        </Card>
      ) : value.length >= MAX_FILES ? (
        <p className="text-[12.5px] text-muted">{fmt(F.limit, { n: number(MAX_FILES) })}</p>
      ) : null}
    </div>
  );
}
