'use client';

import { ArrowDown, ArrowUp, LoaderCircle, Lock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Field,
  IconButton,
  Select,
  Textarea,
  useToast,
} from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { Locale } from '../../contracts/types';
import { isFreeLocale, nativeName } from '../../lib/locales';
import { showsHebrewDate } from '../../lib/hebrew-date';
import { textFields } from '../../translate/fields';
import { PanelCard } from '../fields/fields';
import { addLocale, removeLocale } from '../locales';
import { moveAt } from '../paths';
import { useEditor } from '../state/EditorProvider';
import { useTranslations } from '../translations';

/**
 * The invitation's languages (§7.4, seven languages): the ones it has, in the order its language
 * menu lists them — move, remove, the one it opens in — and the ones to add (beyond Hebrew and
 * English only with the `languages` feature: the others aren't offered when it's off). Each other
 * language shows what is missing or waits for review, with the machine translation (translate_ai)
 * and the side-by-side review; and the glossary the machine never translates.
 */
export function LanguagesPanel() {
  const { doc, template, defaults, apply, update, setLocale, features } = useEditor();
  const tr = useTranslations();
  const { t, plural, number } = useUi();
  const { toast } = useToast();
  const e = t.editor;
  const l = e.f.languages;
  const [removing, setRemoving] = useState<Locale | null>(null);
  const moreLanguages = features.languages ?? true;
  const addable = template.supportsLocales.filter(
    (locale) => !doc.locales.includes(locale) && (moreLanguages || isFreeLocale(locale)),
  );
  const fields = textFields(doc);
  const missingIn = (locale: Locale) =>
    fields.filter((f) => !(f.value[locale] ?? '').trim() && Object.values(f.value).some((v) => v?.trim()))
      .length;

  const move = (from: number, to: number) => apply((d) => moveAt(d, 'locales', from, to), null);

  return (
    <>
      <PanelCard title={e.cards.active}>
        <p className="-mt-1 text-[12px] text-muted">{l.order}</p>
        <ul className="flex flex-col gap-2" data-testid="invitation-languages">
          {doc.locales.map((locale, i) => {
            const missing = locale === doc.defaultLocale ? 0 : missingIn(locale);
            const pending = tr?.pending(locale).length ?? 0;
            return (
              <li
                key={locale}
                data-language={locale}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span lang={locale} className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {nativeName(locale)}
                  </span>
                  {locale === doc.defaultLocale ? <Badge variant="neutral">{l.defaultBadge}</Badge> : null}
                  <IconButton
                    label={fmt(l.moveUp, { language: e.languageIn[locale] })}
                    size="sm"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={fmt(l.moveDown, { language: e.languageIn[locale] })}
                    size="sm"
                    disabled={i === doc.locales.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  {doc.locales.length > 1 ? (
                    <IconButton
                      label={fmt(l.remove, { language: e.languageIn[locale] })}
                      size="sm"
                      onClick={() => setRemoving(locale)}
                    >
                      <Trash2 />
                    </IconButton>
                  ) : null}
                </div>
                {locale !== doc.defaultLocale ? (
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className={missing || pending ? 'text-warning' : 'text-success'}>
                      {[
                        missing ? plural(l.missingCount, missing, { n: number(missing) }) : null,
                        pending ? plural(l.reviewCount, pending, { n: number(pending) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || l.complete}
                    </span>
                    <span className="ms-auto flex gap-1.5">
                      {tr?.available && missing ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={tr.busy === locale ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                          disabled={!!tr.busy}
                          onClick={() => void tr.translate(locale)}
                        >
                          {tr.busy === locale
                            ? fmt(l.translating, { language: e.languageIn[locale] })
                            : fmt(l.translate, { language: e.languageIn[locale] })}
                        </Button>
                      ) : null}
                      {tr ? (
                        <Button size="sm" variant="ghost" onClick={() => tr.review(locale)}>
                          {l.review}
                        </Button>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {doc.locales.length > 1 ? (
          <>
            <Field label={l.default}>
              <Select
                value={doc.defaultLocale}
                onChange={(ev) => update('defaultLocale', ev.target.value as Locale, null)}
                data-testid="default-language"
              >
                {doc.locales.map((v) => (
                  <option key={v} value={v} lang={v}>
                    {nativeName(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-[12px] text-muted">{l.switcherNote}</p>
          </>
        ) : null}
      </PanelCard>

      {addable.length || !moreLanguages ? (
        <PanelCard title={l.more}>
          <ul className="flex flex-col gap-2">
            {addable.map((locale) => (
              <li
                key={locale}
                className="flex h-12 items-center gap-3 rounded-card border border-line bg-surface px-3"
              >
                <span lang={locale} className="flex-1 text-[14px] font-semibold">
                  {nativeName(locale)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus />}
                  onClick={() => {
                    apply((d) => addLocale(d, locale, template, defaults), null);
                    setLocale(locale);
                    toast({ title: fmt(l.added, { language: e.languageIn[locale] }), variant: 'success' });
                  }}
                >
                  {fmt(l.add, { language: e.languageIn[locale] })}
                </Button>
              </li>
            ))}
          </ul>
          {!moreLanguages ? (
            <p className="flex items-start gap-2 text-[12.5px] text-muted">
              <Lock aria-hidden size={14} className="mt-0.5 shrink-0" />
              {l.locked}
            </p>
          ) : null}
        </PanelCard>
      ) : null}

      {tr?.available && doc.locales.length > 1 ? <GlossaryCard /> : null}

      {removing ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fmt(l.removeTitle, { language: e.languageIn[removing] })}
          description={fmt(l.removeBody, { language: e.languageIn[removing] })}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = removing;
                  apply((d) => removeLocale(d, target), null);
                  setRemoving(null);
                }}
              >
                {fmt(l.remove, { language: e.languageIn[removing] })}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

/** The words the machine translation keeps as they are: one per line. */
function GlossaryCard() {
  const tr = useTranslations()!;
  const { t } = useUi();
  const { toast } = useToast();
  const l = t.editor.f.languages;
  const saved = tr.glossary.join('\n');
  const [text, setText] = useState<string | null>(null);
  const value = text ?? saved;
  const terms = value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <PanelCard title={l.glossary}>
      <Field label={l.glossary} help={l.glossaryHelp}>
        <Textarea value={value} onChange={(ev) => setText(ev.target.value)} rows={4} maxLength={100 * 81} />
      </Field>
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        disabled={terms.join('\n') === saved || terms.length > 100 || terms.some((s) => s.length > 80)}
        onClick={() =>
          void tr.saveGlossary(terms).then((ok) => {
            if (!ok) return;
            setText(null);
            toast({ title: l.glossarySaved, variant: 'success' });
          })
        }
      >
        {l.glossarySave}
      </Button>
    </PanelCard>
  );
}

/**
 * Which languages show the Hebrew date (event.hebrewDateLocales): by default Hebrew and English; any
 * of the invitation's languages can.
 */
export function HebrewDateLanguages() {
  const { doc, update } = useEditor();
  const { t } = useUi();
  const l = t.editor.f.languages;
  if (doc.event.hebrewDate === 'off' || doc.locales.length < 2) return null;
  const on = doc.locales.filter((locale) => showsHebrewDate(doc.event, locale));
  const set = (locale: Locale, checked: boolean) => {
    const next = checked ? [...on, locale] : on.filter((x) => x !== locale);
    update(
      'event.hebrewDateLocales',
      doc.locales.filter((x) => next.includes(x)),
      null,
    );
  };
  return (
    <fieldset className="-mt-1 flex flex-col gap-1.5">
      <legend className="mb-1 text-[13px] font-semibold">{l.hebrewDateIn}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {doc.locales.map((locale) => (
          <Checkbox
            key={locale}
            checked={on.includes(locale)}
            onCheckedChange={(checked) => set(locale, checked)}
            label={<span lang={locale}>{nativeName(locale)}</span>}
          />
        ))}
      </div>
    </fieldset>
  );
}
