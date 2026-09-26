'use client';

import { Captions, Keyboard, Plus, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button, Checkbox, Dialog, Hint, IconButton, Input } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { Locale, Media } from '../../contracts/types';
import {
  CAPTIONS,
  parseCaptionsFile,
  parseTimestamp,
  parseVtt,
  shortTimestamp,
  toVtt,
  type Cue,
} from '../../lib/captions';
import { getAt } from '../paths';
import { useEditor } from '../state/EditorProvider';

/**
 * A video's captions in the editor (lib/captions): for each language of the invitation — a .vtt or
 * .srt uploaded (read on the device; an .srt converted), or typed cue by cue, or removed — and "the
 * video has speech", which makes a missing language a publish warning. Kept in the document.
 */
export function CaptionsField({ path }: { path: string }) {
  const { doc, update } = useEditor();
  const { t, plural } = useUi();
  const c = t.studio.captions;
  const media = getAt(doc, path) as Media;
  const [typing, setTyping] = useState<Locale | null>(null);
  const [error, setError] = useState<Locale | null>(null);
  const files = useRef<Partial<Record<Locale, HTMLInputElement | null>>>({});
  const titleId = useId();

  const set = (locale: Locale, vtt: string | null) => {
    const next = { ...(media.captions ?? {}) };
    if (vtt) next[locale] = vtt;
    else delete next[locale];
    update(`${path}.captions`, Object.keys(next).length ? next : null, null);
  };

  const onFile = async (locale: Locale, file: File | undefined) => {
    setError(null);
    if (!file) return;
    const text = file.size <= CAPTIONS.maxChars * 4 ? await file.text() : '';
    const cues = text ? parseCaptionsFile(text, file.name) : null;
    const vtt = cues?.length ? toVtt(cues) : null;
    if (!vtt || vtt.length > CAPTIONS.maxChars) return setError(locale);
    set(locale, vtt);
  };

  return (
    <section
      aria-labelledby={titleId}
      className="mt-3 rounded-card border border-line p-3"
      data-testid="captions"
    >
      <h4 id={titleId} className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Captions aria-hidden className="size-4 text-muted" />
        {c.title}
      </h4>
      <p className="mt-0.5 text-[12px] text-muted">{c.help}</p>
      <Checkbox
        className="mt-2"
        checked={media.speech === true}
        onCheckedChange={(on) => update(`${path}.speech`, on ? true : null, null)}
        label={
          <span>
            {c.speech}
            <span className="block text-[11.5px] text-muted">{c.speechHelp}</span>
          </span>
        }
      />
      <ul className="mt-2 flex flex-col gap-2">
        {doc.locales.map((locale) => {
          const vtt = media.captions?.[locale] ?? null;
          const count = vtt ? (parseVtt(vtt)?.length ?? 0) : 0;
          const language = t.editor.languageFull[locale];
          return (
            <li key={locale} className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-locale={locale}>
              <span className="min-w-16 text-[12.5px] font-semibold" lang={locale}>
                {language}
              </span>
              <span className="text-[12px] text-muted" data-testid="captions-state">
                {count ? plural(c.count, count) : c.none}
              </span>
              <span className="ms-auto flex flex-wrap gap-1">
                <input
                  ref={(el) => {
                    files.current[locale] = el;
                  }}
                  type="file"
                  accept=".vtt,.srt,text/vtt,application/x-subrip"
                  hidden
                  data-testid={`captions-file-${locale}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    void onFile(locale, file);
                  }}
                />
                <Hint text={c.uploadHint}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Upload />}
                    onClick={() => files.current[locale]?.click()}
                    aria-label={`${c.upload} · ${language}`}
                  >
                    {c.upload}
                  </Button>
                </Hint>
                <Hint text={c.typeHint}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Keyboard />}
                    onClick={() => setTyping(locale)}
                    aria-label={`${count ? c.edit : c.type} · ${language}`}
                  >
                    {count ? c.edit : c.type}
                  </Button>
                </Hint>
                {vtt ? (
                  <Hint text={c.removeHint}>
                    <IconButton label={`${c.remove} · ${language}`} onClick={() => set(locale, null)}>
                      <Trash2 />
                    </IconButton>
                  </Hint>
                ) : null}
              </span>
              {error === locale ? (
                <p role="alert" className="w-full text-[12px] text-danger">
                  {c.invalid}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {typing ? (
        <CueEditor
          locale={typing}
          initial={parseVtt(media.captions?.[typing] ?? '') ?? []}
          onClose={() => setTyping(null)}
          onSave={(cues) => {
            set(typing, cues.length ? toVtt(cues) : null);
            setTyping(null);
          }}
        />
      ) : null}
    </section>
  );
}

interface Row {
  key: number;
  start: string;
  end: string;
  text: string;
}

let rowKey = 0;
const rowOf = (c: Cue): Row => ({
  key: ++rowKey,
  start: shortTimestamp(c.start),
  end: shortTimestamp(c.end),
  text: c.text,
});

/** Captions typed cue by cue: when each appears, when it goes, its words. */
function CueEditor({
  locale,
  initial,
  onClose,
  onSave,
}: {
  locale: Locale;
  initial: Cue[];
  onClose: () => void;
  onSave: (cues: Cue[]) => void;
}) {
  const { t } = useUi();
  const c = t.studio.captions;
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length ? initial.map(rowOf) : [rowOf({ start: 0, end: 3, text: '' })],
  );
  const [error, setError] = useState<string | null>(null);
  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    const cues: Cue[] = [];
    for (const [i, r] of rows.entries()) {
      if (!r.text.trim()) continue;
      const start = parseTimestamp(r.start);
      const end = parseTimestamp(r.end);
      if (start === null || end === null || end <= start) return setError(fmt(c.badTime, { n: i + 1 }));
      cues.push({ start, end, text: r.text.trim().slice(0, CAPTIONS.maxCueChars) });
    }
    if (!cues.length && rows.some((r) => r.text.trim())) return setError(c.empty);
    onSave(cues);
  };

  const last = rows.at(-1);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(c.editorTitle, { language: t.editor.languageIn[locale] })}
      description={c.editorIntro}
      closeLabel={t.common.close}
      className="max-w-[640px]!"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} data-testid="captions-save">
            {c.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2" data-testid="captions-editor">
        <div
          aria-hidden
          className="grid grid-cols-[64px_64px_1fr_32px] gap-2 text-[11.5px] font-semibold text-muted"
        >
          <span>{c.start}</span>
          <span>{c.end}</span>
          <span>{c.text}</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[64px_64px_1fr_32px] items-center gap-2">
            <Input
              value={r.start}
              onChange={(e) => setRow(r.key, { start: e.target.value })}
              dir="ltr"
              inputMode="decimal"
              aria-label={`${c.start} ${i + 1}`}
            />
            <Input
              value={r.end}
              onChange={(e) => setRow(r.key, { end: e.target.value })}
              dir="ltr"
              inputMode="decimal"
              aria-label={`${c.end} ${i + 1}`}
            />
            <Input
              value={r.text}
              lang={locale}
              maxLength={CAPTIONS.maxCueChars}
              onChange={(e) => setRow(r.key, { text: e.target.value })}
              aria-label={`${c.text} ${i + 1}`}
            />
            <IconButton
              label={fmt(c.removeCue, { n: i + 1 })}
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              <Trash2 />
            </IconButton>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus />}
          className="self-start"
          disabled={rows.length >= CAPTIONS.maxCues}
          onClick={() => {
            const from = parseTimestamp(last?.end ?? '0') ?? 0;
            setRows((rs) => [...rs, rowOf({ start: from, end: from + 3, text: '' })]);
          }}
        >
          {c.add}
        </Button>
        {error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
