'use client';

import { ArrowDown, ArrowUp, Copy, EyeOff, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button, Card, IconButton, Menu, Switch, useToast } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { borrowedCopy } from '../templates/seed-document';
import { LOCKED_TYPES } from './catalog';
import { sectionName, useFocusRequest } from './fields/fields';
import { GlobalPanel } from './panels/GlobalPanels';
import { ReviewTextsNote, SectionForm } from './panels/SectionForms';
import { insertAt, moveAt, uniqueId } from './paths';
import { useEditor, type PanelId } from './state/EditorProvider';
import { HelpFor, type HelpArea } from '../app/HelpFor';

/** Each design and settings panel's "?" (what each of its controls does). */
const PANEL_HELP: Record<PanelId, HelpArea> = {
  palette: 'designPalette',
  fonts: 'designFonts',
  style: 'designStyle',
  cover: 'designCover',
  music: 'designMusic',
  event: 'settingsEvent',
  languages: 'settingsLanguages',
  share: 'settingsShare',
};

/** The form panel (§9B.3-D): title + helper line, then the cards of the selected section or panel. */
export function FormPanel({ className }: { className?: string }) {
  const { doc, defaults, selection, select, apply, undo } = useEditor();
  const { t, locale } = useUi();
  const { toast } = useToast();
  const e = t.editor;
  const ref = useRef<HTMLDivElement>(null);
  useFocusRequest(ref);

  const index = selection.kind === 'section' ? doc.sections.findIndex((s) => s.id === selection.id) : -1;
  const section = index >= 0 ? doc.sections[index] : undefined;

  // The selected section disappeared (undo, delete): fall back to the hero.
  useEffect(() => {
    if (selection.kind === 'section' && !section) {
      const hero = doc.sections.find((s) => s.type === 'hero');
      if (hero) select({ kind: 'section', id: hero.id });
    }
  }, [selection, section, doc.sections, select]);

  // Scroll back to the top when another section/panel opens.
  const key = selection.kind === 'section' ? `s:${selection.id}` : `p:${selection.panel}`;
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [key]);

  let title: string;
  let sub: string;
  let body: React.ReactNode;
  let menu: React.ReactNode = null;
  if (selection.kind === 'panel') {
    title = e.names[selection.panel];
    sub = e.panels[selection.panel];
    body = <GlobalPanel panel={selection.panel} />;
  } else if (section) {
    title = sectionName(section, e, locale);
    sub = e.panels[section.type === 'text' ? 'text' : section.type];
    body = <SectionForm section={section} index={index} />;
    if (!LOCKED_TYPES.includes(section.type)) {
      const middle = doc.sections.filter((s) => !LOCKED_TYPES.includes(s.type));
      const pos = middle.indexOf(section);
      const m = e.sectionMenu;
      const moveTo = (other: number) => {
        const target = middle[other];
        if (!target) return;
        apply((d) => moveAt(d, 'sections', index, d.sections.indexOf(target)), null);
      };
      menu = (
        <Menu
          trigger={
            <IconButton label={m.label}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            ...(pos > 0 ? [{ label: m.moveUp, icon: <ArrowUp />, onSelect: () => moveTo(pos - 1) }] : []),
            ...(pos < middle.length - 1
              ? [{ label: m.moveDown, icon: <ArrowDown />, onSelect: () => moveTo(pos + 1) }]
              : []),
            ...(section.type !== 'rsvp'
              ? [
                  {
                    label: m.duplicate,
                    icon: <Copy />,
                    onSelect: () => {
                      const copy = {
                        ...structuredClone(section),
                        id: uniqueId(
                          section.id.replace(/-\d+$/, ''),
                          doc.sections.map((s) => s.id),
                        ),
                      };
                      apply((d) => insertAt(d, 'sections', copy, index + 1), null);
                      select({ kind: 'section', id: copy.id });
                      toast({ title: fmt(m.duplicated, { name: title }), variant: 'success' });
                    },
                  },
                ]
              : []),
            { type: 'separator' as const },
            {
              label: m.delete,
              icon: <Trash2 />,
              danger: true,
              onSelect: () => {
                const neighbour =
                  middle[pos + 1] ?? middle[pos - 1] ?? doc.sections.find((s) => s.type === 'hero');
                apply((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== section.id) }), null);
                if (neighbour) select({ kind: 'section', id: neighbour.id });
                toast({
                  title: fmt(m.deleted, { name: title }),
                  action: {
                    label: m.undo,
                    altText: t.editor.undo,
                    onClick: () => {
                      undo();
                      select({ kind: 'section', id: section.id });
                    },
                  },
                });
              },
            },
          ]}
        />
      );
    }
  } else {
    return <div ref={ref} className={className} />;
  }

  const reviewTexts = section?.type === 'hero' && borrowedCopy(defaults, doc.eventType);
  const setEnabled = (on: boolean) =>
    section &&
    apply(
      (d) => ({
        ...d,
        sections: d.sections.map((s) => (s.id === section.id ? { ...s, enabled: on } : s)),
      }),
      null,
    );

  return (
    <div ref={ref} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2 className="text-[18px] font-bold">{title}</h2>
            {selection.kind === 'panel' ? <HelpFor area={PANEL_HELP[selection.panel]} /> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{sub}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {section && !LOCKED_TYPES.includes(section.type) ? (
            // The compact tablet rail has no switches: the section's visibility is here instead.
            <span className="hidden lg:max-xl:inline-flex">
              <Switch
                label={fmt(e.rail.toggle, { name: title })}
                checked={section.enabled}
                onCheckedChange={setEnabled}
              />
            </span>
          ) : null}
          {menu}
        </div>
      </div>
      {section && !section.enabled ? (
        // hidden: nothing below shows on the invitation or blocks publishing (validateDocument skips it)
        <Card padding="sm" className="mt-4" data-testid="hidden-section-note">
          <div className="flex items-start gap-3">
            <EyeOff aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
            <div className="flex-1">
              <p className="text-[13px] text-muted">{e.hiddenSection.text}</p>
              <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => setEnabled(true)}>
                {e.hiddenSection.show}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      {reviewTexts ? <ReviewTextsNote /> : null}
      <div key={key}>{body}</div>
      <Card padding="sm" tone="info" className="mt-4">
        <div className="flex items-start gap-3">
          <Sparkles aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-[#1d4ed8]" />
          <p className="flex-1 text-[12px] text-[#1e3a8a]">{e.tip}</p>
        </div>
      </Card>
    </div>
  );
}
