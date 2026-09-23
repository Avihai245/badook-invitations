'use client';

import { Copy } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Card,
  CardTitle,
  Field,
  Input,
  L10nTabs,
  Segmented,
  Select,
  Switch,
  Textarea,
  cn,
  type SegmentedOption,
} from '@/components/app';
import type { EditorDict } from '@/lib/i18n/editor.he';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { HHMM_RE } from '../../contracts/schemas';
import type { InvitationDocument, L10n, Locale, Section } from '../../contracts/types';
import { dirOf } from '../../contracts/types';
import type { Issue } from '../../contracts/validate';
import { cappedLength } from '../../lib/l10n';
import { getAt } from '../paths';
import { useEditor } from '../state/EditorProvider';

// ─── preview highlight (a focused field outlines its node in the preview) ─────────────────────────

export interface PreviewControls {
  highlight: (path: string | null, label?: string) => void;
  /** play the cover opening again in the preview */
  replay: () => void;
}
const PreviewControlsContext = createContext<PreviewControls>({ highlight: () => {}, replay: () => {} });
export const PreviewControlsProvider = PreviewControlsContext.Provider;
export const usePreviewControls = () => useContext(PreviewControlsContext);
const useHighlight = () => useContext(PreviewControlsContext).highlight;

// ─── issues ────────────────────────────────────────────────────────────────────────────────────

/**
 * Human text of a validation issue ("חסר תרגום לאנגלית ב'שורת מיקום'"). Date params (YYYY-MM-DD —
 * which dates clash) are written by `date`, the UI language's formatter.
 */
export function issueText(
  issue: Issue,
  e: EditorDict,
  fieldName?: string,
  date?: (iso: string) => string,
): string {
  const field = fieldName ?? (issue.field ? e.fieldLabels[issue.field] : '');
  const locale = issue.params?.locale as Locale | undefined;
  const params = Object.fromEntries(
    Object.entries(issue.params ?? {}).map(([k, v]) => [
      k,
      date && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? date(v) : v,
    ]),
  );
  return fmt(e.issues[issue.code], {
    ...params,
    field,
    language: locale ? e.languageIn[locale] : '',
  });
}

/** Issues on `path` itself or on one of its languages ('…label' / '…label.en'). */
export function issuesAt(issues: readonly Issue[], path: string): Issue[] {
  return issues.filter(
    (i) =>
      i.path === path || (i.path.startsWith(`${path}.`) && /^(he|en)$/.test(i.path.slice(path.length + 1))),
  );
}

/** The rail/panel name of a section: its kind for text sections (a custom one by its title). */
export function sectionName(section: Section, e: EditorDict, locale: Locale): string {
  if (section.type === 'text') {
    const title = section.data.kind === 'custom' ? section.data.title?.[locale]?.trim() : '';
    return title || e.names[section.data.kind];
  }
  return e.names[section.type];
}

export function hostsText(doc: InvitationDocument, locale: Locale): string {
  const p = doc.hosts.primary[locale]?.trim() ?? '';
  const s = doc.hosts.secondary?.[locale]?.trim();
  return s ? `${p} ${doc.hosts.joiner?.[locale]?.trim() || '&'} ${s}` : p;
}

// ─── layout ────────────────────────────────────────────────────────────────────────────────────

/** A card of the form panel (app.html `.pcard`): 16px padding, 13px/700 muted title, fields 14px apart. */
export function PanelCard({
  title,
  children,
  className,
  aside,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <Card padding="sm" className={cn('mt-4', className)}>
      {title != null || aside != null ? (
        <div className="flex items-start justify-between gap-3">
          {title != null ? <CardTitle>{title}</CardTitle> : <span />}
          {aside}
        </div>
      ) : null}
      <div className="flex flex-col gap-3.5">{children}</div>
    </Card>
  );
}

/**
 * Wrapper of every editor field: `data-field-path` (the editor focuses/reveals it when the host clicks
 * its node in the preview or an issue in the publish dialog) + the preview highlight while focused.
 */
export function FieldFrame({
  path,
  label,
  children,
  className,
}: {
  path: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const highlight = useHighlight();
  return (
    <div
      data-field-path={path}
      className={className}
      onFocusCapture={() => highlight(path, label)}
      onBlurCapture={() => highlight(null)}
    >
      {children}
    </div>
  );
}

function useIssueMessage(path: string, label: string, locale?: Locale): string | undefined {
  const { issues, showIssues } = useEditor();
  const { t, date } = useUi();
  const found = issuesAt(issues.issues, path).filter(
    (i) => i.severity === 'error' && (showIssues || i.code === 'too_long' || i.code === 'monogram_too_long'),
  );
  const pick =
    (locale && found.find((i) => i.path === `${path}.${locale}` || i.params?.locale === locale)) ?? found[0];
  return pick ? issueText(pick, t.editor, label, (iso) => date(iso)) : undefined;
}

// ─── localized text ────────────────────────────────────────────────────────────────────────────

/**
 * An L10n field (§7.4): `עב | EN` tabs beside the label when the invitation has two languages (an
 * amber dot marks a missing translation), the input's dir/lang follow the language, a live counter
 * against the §3 cap, and "copy from the other language". The language tab is shared by every field
 * and the preview, so the host edits and sees one language at a time.
 */
export function L10nField({
  path,
  label,
  cap,
  multiline = false,
  rows,
  help,
  nullable = false,
  required = false,
  maxLength,
  count = cappedLength,
  className,
}: {
  path: string;
  label: string;
  cap?: number;
  /** how the counter measures the text (default: §3 caps with a 12-char budget per live token) */
  count?: (text: string) => number;
  multiline?: boolean;
  rows?: number;
  help?: ReactNode;
  /** an empty value in every language becomes `null` (the element is hidden) instead of an error */
  nullable?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const { doc, locale, setLocale, update } = useEditor();
  const { t } = useUi();
  const e = t.editor;
  const value = (getAt(doc, path) as L10n | null | undefined) ?? null;
  const text = value?.[locale] ?? '';
  const locales = doc.locales;
  const other = locales.find((l) => l !== locale && value?.[l]?.trim());
  const error = useIssueMessage(path, label, locale);
  // in a hidden section nothing shows, so an empty language isn't flagged (as in validateDocument)
  const hidden = /^sections\.(\d+)\./.exec(path);
  const inHiddenSection = !!hidden && doc.sections[Number(hidden[1])]?.enabled === false;

  const change = (next: string) => {
    let v: L10n | null = { ...(value ?? {}), [locale]: next };
    if (nullable && locales.every((l) => !(v?.[l] ?? '').trim())) v = null;
    update(path, v, `${path}.${locale}`);
  };
  const dir = dirOf(locale);
  const control = multiline ? (
    <Textarea
      value={text}
      rows={rows ?? 4}
      onChange={(ev) => change(ev.target.value)}
      dir={dir}
      lang={locale}
      textAlign="start"
      maxLength={maxLength ?? (cap ? cap * 2 : 2000)}
    />
  ) : (
    <Input
      value={text}
      onChange={(ev) => change(ev.target.value)}
      dir={dir}
      lang={locale}
      textAlign="start"
      maxLength={maxLength ?? (cap ? cap * 2 : 300)}
    />
  );

  return (
    <FieldFrame path={path} label={label} className={className}>
      <Field
        label={label}
        required={required}
        help={
          !text.trim() && other ? (
            <button
              type="button"
              onClick={() => change(value?.[other] ?? '')}
              className="inline-flex items-center gap-1 font-medium text-ink underline-offset-2 hover:underline"
            >
              <Copy aria-hidden size={12} strokeWidth={1.75} />
              {e.copyFrom[other]}
            </button>
          ) : (
            help
          )
        }
        error={error}
        counter={cap ? { value: count(text), max: cap } : undefined}
        labelAside={
          locales.length > 1 ? (
            <L10nTabs<Locale>
              label={e.fieldLanguage}
              missingLabel={e.missingTranslation}
              value={locale}
              onValueChange={setLocale}
              options={locales.map((l) => ({
                value: l,
                label: e.languageShort[l],
                ariaLabel: e.languageFull[l],
                lang: l,
                missing: !inHiddenSection && !(value?.[l] ?? '').trim() && (!nullable || !!value),
              }))}
            />
          ) : undefined
        }
      >
        {control}
      </Field>
    </FieldFrame>
  );
}

// ─── plain values ──────────────────────────────────────────────────────────────────────────────

/**
 * A text input whose document value only changes when the typed text is acceptable (`accept`), so
 * the draft always passes the structural schema — e.g. a URL can't be emptied into an invalid state.
 */
export function TextField({
  path,
  label,
  help,
  accept = () => true,
  toValue = (s: string) => s,
  fromValue = (v: unknown) => (typeof v === 'string' ? v : ''),
  invalidText,
  dir,
  placeholder,
  type = 'text',
  inputMode,
  className,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  accept?: (text: string) => boolean;
  toValue?: (text: string) => unknown;
  fromValue?: (value: unknown) => string;
  invalidText?: string;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  type?: 'text' | 'url' | 'email';
  inputMode?: 'text' | 'url' | 'email' | 'numeric';
  className?: string;
}) {
  const { doc, update } = useEditor();
  const stored = fromValue(getAt(doc, path));
  const [draft, setDraft] = useState(stored);
  const [focused, setFocused] = useState(false);
  // Follow outside changes (undo, another field) while the host isn't typing here.
  useEffect(() => {
    if (!focused) setDraft(stored);
  }, [stored, focused]);
  const ok = accept(draft);
  const error = useIssueMessage(path, label) ?? (!ok && invalidText ? invalidText : undefined);
  return (
    <FieldFrame path={path} label={label} className={className}>
      <Field label={label} help={help} error={error}>
        <Input
          type={type}
          inputMode={inputMode}
          value={draft}
          dir={dir}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (!accept(draft)) setDraft(stored);
          }}
          onChange={(ev) => {
            setDraft(ev.target.value);
            if (accept(ev.target.value)) update(path, toValue(ev.target.value));
          }}
        />
      </Field>
    </FieldFrame>
  );
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Native date input; an empty value is `null` when `nullable`, otherwise ignored until a date is picked. */
export function DateField({
  path,
  label,
  help,
  nullable = false,
  className,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  nullable?: boolean;
  className?: string;
}) {
  const { doc, update } = useEditor();
  const stored = (getAt(doc, path) as string | null) ?? '';
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);
  const error = useIssueMessage(path, label);
  return (
    <FieldFrame path={path} label={label} className={className}>
      <Field label={label} help={help} error={error}>
        <Input
          type="date"
          dir="ltr"
          value={draft}
          onChange={(ev) => {
            const v = ev.target.value;
            setDraft(v);
            if (ISO_DATE_RE.test(v)) update(path, v);
            else if (!v && nullable) update(path, null);
          }}
          onBlur={() => setDraft(stored)}
        />
      </Field>
    </FieldFrame>
  );
}

/**
 * The RSVP deadline with the event's date beside it: the two are set in different panels, and a
 * deadline later than the event is almost always an event date that wasn't moved along.
 */
export function RsvpDeadlineField() {
  const { doc } = useEditor();
  const { t, date } = useUi();
  const ev = t.editor.f.event;
  const eventDate = date(doc.event.date);
  const after = doc.event.rsvpDeadline !== null && doc.event.rsvpDeadline > doc.event.date;
  return (
    <DateField
      path="event.rsvpDeadline"
      label={ev.rsvpDeadline}
      help={
        after ? (
          <span className="text-warning">{fmt(ev.deadlineAfterEvent, { date: eventDate })}</span>
        ) : (
          fmt(ev.deadlineHelp, { date: eventDate })
        )
      }
      nullable
    />
  );
}

/** Native time input (HH:mm, 24h value); an empty value is `null` when `nullable`. */
export function TimeField({
  path,
  label,
  help,
  nullable = false,
  className,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  nullable?: boolean;
  className?: string;
}) {
  const { doc, update } = useEditor();
  const stored = (getAt(doc, path) as string | null) ?? '';
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);
  return (
    <FieldFrame path={path} label={label} className={className}>
      <Field label={label} help={help}>
        <Input
          type="time"
          dir="ltr"
          step={300}
          value={draft}
          onChange={(ev) => {
            const v = ev.target.value;
            setDraft(v);
            if (HHMM_RE.test(v)) update(path, v);
            else if (!v && nullable) update(path, null);
          }}
          onBlur={() => setDraft(stored)}
        />
      </Field>
    </FieldFrame>
  );
}

/** Label + help at the start, switch at the end (app.html `.fld.row`). */
export function SwitchRow({
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
  path,
  className,
}: {
  label: string;
  help?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** document path, for focus/reveal */
  path?: string;
  className?: string;
}) {
  const id = useId();
  const row = (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <div id={`${id}l`} className="text-[13px] font-semibold">
          {label}
        </div>
        {help != null ? (
          <p id={`${id}h`} className="text-[12px] text-muted">
            {help}
          </p>
        ) : null}
      </div>
      <Switch
        label={label}
        aria-describedby={help != null ? `${id}h` : undefined}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
  return path ? (
    <FieldFrame path={path} label={label}>
      {row}
    </FieldFrame>
  ) : (
    row
  );
}

/** A boolean at `path` as a SwitchRow. */
export function BoolField({
  path,
  label,
  help,
  disabled,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  disabled?: boolean;
}) {
  const { doc, update } = useEditor();
  return (
    <SwitchRow
      path={path}
      label={label}
      help={help}
      checked={!!getAt(doc, path)}
      onCheckedChange={(v) => update(path, v, null)}
      disabled={disabled}
    />
  );
}

/** A value at `path` picked from a native select. */
export function SelectField<V extends string>({
  path,
  label,
  help,
  options,
  toValue = (s) => s,
  fromValue = (v) => String(v ?? ''),
  className,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  options: readonly { value: V; label: string }[];
  toValue?: (s: V) => unknown;
  fromValue?: (v: unknown) => string;
  className?: string;
}) {
  const { doc, update } = useEditor();
  const error = useIssueMessage(path, label);
  return (
    <FieldFrame path={path} label={label} className={className}>
      <Field label={label} help={help} error={error}>
        <Select
          value={fromValue(getAt(doc, path))}
          onChange={(ev) => update(path, toValue(ev.target.value as V), null)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </FieldFrame>
  );
}

/** A small choice as a full-width Segmented control. */
export function SegmentedField<V extends string>({
  label,
  value,
  onValueChange,
  options,
  help,
  path,
}: {
  label: string;
  value: V;
  onValueChange: (v: V) => void;
  options: readonly SegmentedOption<V>[];
  help?: ReactNode;
  path?: string;
}) {
  const field = (
    <Field label={label} help={help}>
      <Segmented<V> fullWidth value={value} onValueChange={onValueChange} options={options} />
    </Field>
  );
  return path ? (
    <FieldFrame path={path} label={label}>
      {field}
    </FieldFrame>
  ) : (
    field
  );
}

/** A range slider with its value on the label row (app.html "הכהיית רקע ── 35%"). */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  path,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  path?: string;
}) {
  const id = useId();
  const field = (
    <Field
      id={id}
      label={label}
      labelAside={
        <span dir="ltr" className="text-[12px] text-muted tabular-nums">
          {format(value)}
        </span>
      }
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className="w-full accent-ink"
      />
    </Field>
  );
  return path ? (
    <FieldFrame path={path} label={label}>
      {field}
    </FieldFrame>
  ) : (
    field
  );
}

/** Focuses (and scrolls to) the field of a focus request once the panel shows it. */
export function useFocusRequest(container: RefObject<HTMLElement | null>) {
  const { focusRequest } = useEditor();
  const handled = useRef(0);
  useEffect(() => {
    if (!focusRequest || handled.current === focusRequest.nonce) return;
    // Wait a frame: collapsed list items open in response to the same request.
    const raf = requestAnimationFrame(() => {
      const root = container.current;
      if (!root) return;
      const parts = focusRequest.path.split('.');
      for (let n = parts.length; n > 0; n--) {
        const candidate = parts.slice(0, n).join('.');
        const el = root.querySelector<HTMLElement>(`[data-field-path="${CSS.escape(candidate)}"]`);
        if (!el) continue;
        handled.current = focusRequest.nonce;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.querySelector<HTMLElement>('input, textarea, select, button[role="switch"], button')?.focus({
          preventScroll: true,
        });
        return;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [focusRequest, container]);
}
