'use client';

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';
import { Button, Dialog, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { displayPhone } from '../../lib/guest-status';
import { hostApi, loginUrl } from '../api';
import {
  csvCell,
  parseCsv,
  readGuestRows,
  type Cell,
  type ColumnKey,
  type ImportPreview,
} from '../../lib/guest-import';

/** Rows per request (the host API takes up to 512KB of JSON). */
const BATCH = 1000;
const SHOWN_ISSUES = 8;

/** A spreadsheet file → its first sheet's rows (xlsx via read-excel-file, CSV parsed here). */
async function readSheet(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text());
  if (name.endsWith('.xls')) throw new Error('old_excel');
  const { readSheet: read } = await import('read-excel-file/universal');
  return (await read(file)) as Cell[][];
}

/** The sample file (CSV with a BOM, so Excel opens the Hebrew right). */
export function downloadSample(rows: string[][], fileName: string) {
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Import guests from Excel or CSV: pick or drop a file → the columns found, the rows it can't use
 * and a sample of the guests → import (in batches). A phone already on the list updates that guest.
 */
export function ImportDialog({
  id,
  maxGuests,
  onClose,
  onImported,
}: {
  id: string;
  maxGuests: number;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const { t, fmt, number } = useUi();
  const g = t.guests;
  const im = g.import;
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'reading' | 'importing'>('idle');
  const [limit, setLimit] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLimit(null);
    setPreview(null);
    setFileName(file.name);
    setState('reading');
    try {
      const result = readGuestRows(await readSheet(file));
      if (!result.guests.length && !result.issues.length) setError(im.emptyFile);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error && err.message === 'old_excel' ? im.oldExcel : im.badFile);
    } finally {
      setState('idle');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files[0]);
  };

  const submit = async () => {
    if (!preview?.guests.length) return;
    setState('importing');
    let added = 0;
    let updated = 0;
    for (let i = 0; i < preview.guests.length; i += BATCH) {
      const res = await hostApi<{ added: number; updated: number; code?: string; max?: number }>(
        `/api/invitations/${id}/guests`,
        { method: 'POST', body: { guests: preview.guests.slice(i, i + BATCH) } },
      );
      if (res.status === 401) return window.location.assign(loginUrl());
      if (res.status === 402) {
        setLimit(res.body?.max ?? maxGuests);
        setState('idle');
        if (added + updated) onImported(fmt(im.done, { added, updated }));
        return;
      }
      if (!res.ok || !res.body) {
        setState('idle');
        toast({ title: g.toast.error, variant: 'danger' });
        return;
      }
      added += res.body.added;
      updated += res.body.updated;
    }
    setState('idle');
    onImported(fmt(im.done, { added: number(added), updated: number(updated) }));
  };

  const mappingLabels = preview
    ? (Object.entries(preview.mapping) as [ColumnKey, number][])
        .sort((a, b) => a[1] - b[1])
        .map(([key]) => im.columns[key])
    : [];
  const count = preview?.guests.length ?? 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && state !== 'importing' && onClose()}
      title={im.title}
      description={im.formats}
      closeLabel={t.common.close}
      className="max-w-[640px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={state === 'importing'}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => void submit()} disabled={!count || state !== 'idle' || limit !== null}>
            {state === 'importing' ? im.importing : fmt(im.confirm, { n: number(count) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-7 text-center transition-colors ${
            dragging ? 'border-brand bg-brand-soft' : 'border-line bg-canvas hover:border-brand-line'
          }`}
        >
          <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
            {state === 'reading' ? (
              <FileSpreadsheet aria-hidden className="size-5 animate-pulse" />
            ) : (
              <Upload aria-hidden className="size-5" />
            )}
          </span>
          <span className="text-[14px] font-semibold">{state === 'reading' ? im.reading : im.drop}</span>
          {fileName ? (
            <span className="text-[12px] text-muted" dir="auto">
              {fileName}
            </span>
          ) : null}
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            data-testid="guest-file"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => downloadSample(g.sample, 'guests-sample.csv')}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand-deep hover:underline"
        >
          <Download aria-hidden className="size-4" />
          {g.actions.sample}
        </button>

        {error ? (
          <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {preview && count ? (
          <div className="flex flex-col gap-3" data-testid="import-preview">
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <CheckCircle2 aria-hidden className="size-5 text-success" />
              {fmt(im.found, { n: number(count) })}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-muted">{preview.header ? im.mapping : im.noHeader}:</span>
              {mappingLabels.map((label) => (
                <span key={label} className="rounded-full bg-subtle px-2 py-0.5 font-medium">
                  {label}
                </span>
              ))}
            </div>
            <div className="overflow-hidden rounded-card border border-line">
              <table className="w-full text-[13px]">
                <tbody>
                  {preview.guests.slice(0, 5).map((guest, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-medium">
                        <bdi>{guest.name}</bdi>
                      </td>
                      <td className="px-3 py-2 text-muted" dir="ltr">
                        {displayPhone(guest.phone) || '—'}
                      </td>
                      <td className="px-3 py-2 text-muted max-sm:hidden" dir="ltr">
                        {guest.email ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-muted">{im.replaceHint}</p>
          </div>
        ) : null}

        {preview?.issues.length ? (
          <div className="rounded-card border border-[#fde68a] bg-warning-bg px-3 py-2.5 text-[13px]">
            <p className="flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle aria-hidden className="size-4" />
              {fmt(im.issues, { n: number(preview.issues.length) })}
            </p>
            <ul className="mt-1.5 flex flex-col gap-0.5 text-ink">
              {preview.issues.slice(0, SHOWN_ISSUES).map((issue) => (
                <li key={`${issue.row}-${issue.code}`}>
                  <span className="font-medium">{fmt(im.row, { n: issue.row })}</span> —{' '}
                  {im.issueCodes[issue.code]}
                  {issue.value ? (
                    <span className="text-muted" dir="auto">
                      {' '}
                      ({issue.value})
                    </span>
                  ) : null}
                </li>
              ))}
              {preview.issues.length > SHOWN_ISSUES ? (
                <li className="text-muted">{fmt(im.more, { n: preview.issues.length - SHOWN_ISSUES })}</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {limit !== null ? (
          <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {fmt(im.limit, { max: number(limit) })}{' '}
            <Link href="/app/billing" className="font-semibold underline">
              {im.upgrade}
            </Link>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
