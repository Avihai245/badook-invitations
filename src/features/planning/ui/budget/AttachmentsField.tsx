'use client';

import { FileText, Image as ImageIcon, Lock, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, IconButton } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { ATTACHMENT_TYPES, MAX_ATTACHMENTS } from '../../model/budget-view';
import type { Attachment } from '../../model/plan';
import { usePlan } from '../PlanProvider';
import { putFile } from './upload';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * An item's files — quotes, contracts, receipts (PDF or a picture, up to 10MB): uploaded straight to the private
 * bucket with a signed URL (the files route), opened through a signed read. A paid tool (Pro): without it a
 * gentle card says so and links to the upgrade.
 */
export function AttachmentsField({
  files,
  onChange,
}: {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
}) {
  const { t, fmt } = useUi();
  const F = t.planning.budget.files;
  const { view, call } = usePlan();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!view.features.export)
    return (
      <div className="flex items-start gap-3 rounded-btn bg-subtle p-3.5" data-testid="files-locked">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">{F.lockedTitle}</p>
          <p className="mt-0.5 text-[13px] text-muted">{F.lockedBody}</p>
          <Button asChild variant="secondary" size="sm" className="mt-2.5">
            <Link href="/app/billing?plan=pro">{t.planning.budget.export.locked.cta}</Link>
          </Button>
        </div>
      </div>
    );

  const pick = async (file: File) => {
    setError(null);
    if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return setError(F.badType);
    if (file.size > MAX_BYTES) return setError(F.tooLarge);
    if (files.length >= MAX_ATTACHMENTS) return setError(fmt(F.limit, { n: MAX_ATTACHMENTS }));
    setBusy(true);
    const res = await call<{ path?: string; url?: string }>('/files', {
      op: 'upload',
      purpose: 'attachment',
      contentType: file.type,
      size: file.size,
    });
    const path = res.body?.path;
    const url = res.body?.url;
    const sent = res.ok && path && url ? await putFile(url, file, file.type) : false;
    setBusy(false);
    if (!path || !sent) return setError(F.failed);
    onChange([...files, { path, name: file.name.slice(0, 120), size: file.size, type: file.type }]);
  };

  const open = async (path: string) => {
    const res = await call<{ urls?: Record<string, string> }>('/files', { op: 'read', paths: [path] });
    const url = res.body?.urls?.[path];
    if (!url) return setError(F.failed);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12.5px] text-muted">{F.hint}</p>
      {files.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded-btn border border-line">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-1 ps-3 pe-1.5">
              <button
                type="button"
                onClick={() => void open(f.path)}
                aria-label={fmt(F.open, { name: f.name })}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-start text-[13.5px]"
              >
                {f.type === 'application/pdf' ? (
                  <FileText aria-hidden className="size-4 shrink-0 text-muted" />
                ) : (
                  <ImageIcon aria-hidden className="size-4 shrink-0 text-muted" />
                )}
                <span className="truncate">{f.name}</span>
              </button>
              <IconButton
                className="min-h-11 min-w-11"
                label={fmt(F.remove, { name: f.name })}
                onClick={() => onChange(files.filter((x) => x.path !== f.path))}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={ATTACHMENT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Paperclip />}
          loading={busy}
          className="min-h-11"
          onClick={() => input.current?.click()}
        >
          {busy ? F.adding : F.add}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
