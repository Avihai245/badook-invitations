'use client';

import { Check, Crown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Dialog, cn, useToast } from '@/components/app';
import { rethemeDocument } from '@/features/art-direction/apply';
import { hostApi } from '@/features/invitations/app/api';
import { TemplatePoster } from '@/features/invitations/app/TemplatePoster';
import { useFlush } from '@/features/invitations/editor/state/flush';
import { useEditor } from '@/features/invitations/editor/state/EditorProvider';
import { TEMPLATES, getTemplate } from '@/features/invitations/templates/registry';
import type { TemplateManifest } from '@/features/invitations/contracts/types';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';

const nameOf = (m: TemplateManifest, loc: string) =>
  m.name[loc as keyof typeof m.name] ?? Object.values(m.name).find(Boolean) ?? m.id;

/**
 * "Another design" in the editor's design tab: the gallery's designs for this kind of event, each with
 * the host's own names and date; choosing one moves the invitation onto it — names, dates, places,
 * texts and RSVP stay, the design's palette, fonts, pictures and music become the new design's
 * (art-direction/apply.ts, rethemeDocument). One undo step, and the draft as it was is kept in the
 * history first. A premium design can be chosen on any plan and published on the plans that have it,
 * as in the gallery.
 */
export function TemplatePanel() {
  const { doc, meta, template, features, locale, apply } = useEditor();
  const flush = useFlush();
  const { t, date } = useUi();
  const { toast } = useToast();
  const T = t.editor.templatePanel;
  const [asked, setAsked] = useState<TemplateManifest | null>(null);
  const [busy, setBusy] = useState(false);

  const designs = useMemo(
    () =>
      [...TEMPLATES.values()]
        .map((e) => e.manifest)
        .filter((m) => m.listed && m.categories.includes(doc.eventType))
        // the current one first, then the gallery's order
        .sort((a, b) => Number(b.id === template.id) - Number(a.id === template.id)),
    [doc.eventType, template.id],
  );

  const loc = doc.locales.includes(locale) ? locale : doc.defaultLocale;
  const text = {
    eyebrow: null,
    primary: doc.hosts.primary[loc] ?? '',
    secondary: doc.hosts.secondary?.[loc] ?? null,
    date: doc.event.date
      ? date(doc.event.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
      : null,
  };

  const use = async (to: TemplateManifest) => {
    const target = getTemplate(to.id);
    if (!target) return;
    setBusy(true);
    try {
      // the draft as it is now is kept in the history first (the server copies what it has)
      await flush();
      await hostApi(`/api/invitations/${meta.id}/snapshot`, { method: 'POST', body: { reason: 'concept' } });
      // one undo step: the whole design at once
      apply((d) => {
        const from = getTemplate(d.templateId);
        return from ? rethemeDocument(d, from, target) : d;
      }, null);
      setAsked(null);
      toast({ title: T.applied, variant: 'success' });
    } catch {
      toast({ title: t.common.error, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4" data-testid="template-panel">
      <p className="text-[13px] leading-relaxed text-muted">{T.intro}</p>
      <ul className="grid grid-cols-2 gap-3" aria-label={T.listLabel}>
        {designs.map((m) => {
          const current = m.id === template.id;
          const premium = m.tier === 'premium';
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={current}
                aria-current={current ? 'true' : undefined}
                onClick={() => setAsked(m)}
                data-template={m.id}
                className={cn(
                  'group flex w-full flex-col gap-1.5 rounded-[14px] p-1.5 text-start transition-colors',
                  current ? 'bg-brand-soft ring-2 ring-brand' : 'hover:bg-subtle',
                )}
              >
                <TemplatePoster
                  template={m}
                  locale={m.supportsLocales.includes(loc) ? loc : m.supportsLocales[0]!}
                  text={text}
                  joiner={doc.hosts.joiner?.[loc] || '&'}
                  className="w-full"
                  badge={
                    premium ? (
                      <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-black/60 px-2 text-[11px] font-semibold text-white">
                        <Crown aria-hidden size={12} className="text-[#F3D98B]" />
                        {t.gallery.premium}
                      </span>
                    ) : null
                  }
                />
                <span className="flex items-center gap-1 px-1 text-[12.5px] font-semibold">
                  {current ? <Check aria-hidden className="size-3.5 text-brand-deep" /> : null}
                  <span className="truncate">{nameOf(m, loc)}</span>
                  {current ? <span className="sr-only">{T.current}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!asked}
        onOpenChange={(o) => !o && !busy && setAsked(null)}
        title={asked ? fmt(T.confirmTitle, { name: nameOf(asked, loc) }) : ''}
        description={T.confirmBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsked(null)} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button loading={busy} onClick={() => asked && void use(asked)} data-testid="template-confirm">
              {T.confirm}
            </Button>
          </>
        }
      >
        {asked?.tier === 'premium' && !features.premiumTemplates ? (
          <p className="flex items-start gap-2 rounded-[12px] bg-brand-soft p-3 text-[13px] text-brand-deep">
            <Crown aria-hidden className="mt-0.5 size-4 shrink-0" />
            {T.premiumNote}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
