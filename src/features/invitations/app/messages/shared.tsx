'use client';

import { Eye, Link2, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, cn, Dialog, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import {
  MESSAGE_CATEGORY,
  MESSAGE_KINDS,
  renderMessage,
  type EventValues,
  type MessageKind,
} from '@/features/whatsapp/catalog';
import type { HubData } from '@/features/whatsapp/hub';
import type { EstimateGuest } from '@/features/whatsapp/schedule';
import { WhatsAppChat } from '@/features/whatsapp/ui/WhatsAppChat';
import type { Locale } from '../../contracts/types';
import { whatsappReach } from '../../lib/guest-list';
import { wasSent } from '../../lib/guest-status';
import { nativeName } from '../../lib/locales';
import type { GuestRecord, GuestsPageData } from '../../server/guests';

/** Where a message stands here: approved, waiting for WhatsApp's approval, or kept off by the album. */
export type Availability = 'approved' | 'pending' | 'albumPlan' | 'albumOff';

export function availability(
  kind: MessageKind,
  hub: Pick<HubData, 'approved' | 'album' | 'albumFeature'>,
): Availability {
  if (kind === 'album' && !hub.albumFeature) return 'albumPlan';
  if (kind === 'album' && !hub.album) return 'albumOff';
  return hub.approved.includes(kind) ? 'approved' : 'pending';
}

/** A guest as the estimates see them (features/whatsapp/schedule.ts). */
export const estimateGuest = (g: GuestRecord): EstimateGuest => ({
  reachable: whatsappReach(g) === 'ok',
  received: wasSent(g),
  answer: g.response ? (g.response.attending ? 'yes' : 'no') : null,
});

/** The languages a message can go out in here (approved templates), the invitation's own first. */
export function previewLanguages(data: GuestsPageData): Locale[] {
  const langs = data.whatsapp.langs.map((l) => l.locale);
  const first = [data.locale, ...data.locales].find((l) => langs.includes(l));
  return first ? [first, ...langs.filter((l) => l !== first)] : langs;
}

/**
 * A message as the guest will see it on their phone (WhatsAppChat), with the language to look at
 * and what the button does. `frame`: the phone around it (off inside a dialog).
 */
export function MessagePreview({
  kind,
  values,
  languages,
  sampleName,
  time,
  day,
  frame = true,
  className,
}: {
  kind: MessageKind;
  values: Partial<Record<Locale, EventValues>>;
  languages: readonly Locale[];
  /** the guest the preview greets (a chosen guest, else a sample name) */
  sampleName?: string | null;
  time?: string;
  day?: string;
  frame?: boolean;
  className?: string;
}) {
  const { t, fmt } = useUi();
  const w = t.waMessages;
  const [chosen, setChosen] = useState<Locale | null>(null);
  const lang = chosen && languages.includes(chosen) ? chosen : (languages[0] ?? 'he');
  const v = values[lang] ?? Object.values(values)[0];
  const name = sampleName?.trim() || w.preview.sampleName;
  const message = renderMessage(
    kind,
    lang,
    name,
    v ?? { hosts: '', event: '', date: '', when: '', phrase: '' },
  );
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {languages.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-muted">{w.preview.language}</span>
          <Segmented<Locale>
            label={w.preview.language}
            value={lang}
            onValueChange={setChosen}
            options={languages.map((l) => ({
              value: l,
              label: t.editor.languageShort[l],
              ariaLabel: nativeName(l),
            }))}
          />
        </div>
      ) : null}
      <WhatsAppChat
        message={message}
        locale={lang}
        business={w.preview.business}
        businessHint={w.preview.businessHint}
        day={day ?? w.preview.today}
        time={time ?? '10:00'}
        placeholder={w.preview.placeholder}
        label={fmt(w.preview.label, { name })}
        frame={frame}
      />
      <ul className="flex flex-col gap-1 text-[12.5px] text-muted">
        <li className="flex items-start gap-1.5">
          <Link2 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {message.link ? w.preview.link[message.link] : w.preview.link.none}
        </li>
        <li className="flex items-start gap-1.5">
          <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {w.template.fixed}
        </li>
      </ul>
    </div>
  );
}

/** On a phone: the preview behind a button (on a wide screen it stands beside the form). */
export function PreviewButton(props: Parameters<typeof MessagePreview>[0] & { title: string }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const { title, ...preview } = props;
  return (
    <>
      <Button variant="secondary" icon={<Eye />} onClick={() => setOpen(true)} className="lg:hidden">
        {t.waMessages.preview.open}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={setOpen}
          title={title}
          closeLabel={t.common.close}
          className="max-w-[420px]"
        >
          <MessagePreview {...preview} frame={false} />
        </Dialog>
      ) : null}
    </>
  );
}

const AVAILABILITY_BADGE = {
  approved: 'live',
  pending: 'warning',
  albumPlan: 'draft',
  albumOff: 'draft',
} as const;

/**
 * The approved messages by what they are for, as cards to choose from: each with what it says, whether
 * it can be sent here (approved, waiting for WhatsApp, the album's plan) — any of them can be
 * previewed, only what's available can be sent.
 */
export function TemplatePicker({
  value,
  onChange,
  hub,
  kinds = MESSAGE_KINDS,
  name = 'wa-message',
}: {
  value: MessageKind;
  onChange: (k: MessageKind) => void;
  hub: Pick<HubData, 'approved' | 'album' | 'albumFeature'>;
  kinds?: readonly MessageKind[];
  name?: string;
}) {
  const { t } = useUi();
  const w = t.waMessages;
  return (
    <div
      role="radiogroup"
      aria-label={w.template.pick}
      className="grid gap-2 sm:grid-cols-2"
      data-testid="template-picker"
    >
      {kinds.map((k) => {
        const a = availability(k, hub);
        const on = value === k;
        return (
          <label
            key={k}
            className={cn(
              'relative flex cursor-pointer flex-col gap-1 rounded-card border px-3.5 py-3 transition-colors',
              on
                ? 'border-brand bg-brand-soft/50 ring-1 ring-brand'
                : 'border-line bg-surface hover:border-line-strong',
            )}
            data-kind={k}
          >
            <input
              type="radio"
              name={name}
              value={k}
              checked={on}
              onChange={() => onChange(k)}
              className="sr-only"
            />
            <span className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
              {w.categories[MESSAGE_CATEGORY[k]]}
            </span>
            <span className="text-[14px] font-semibold">{w.kinds[k]}</span>
            <span className="text-[12.5px] leading-snug text-muted">{w.kindHints[k]}</span>
            <Badge
              variant={AVAILABILITY_BADGE[a]}
              icon={a === 'albumPlan' ? <Lock /> : undefined}
              className="mt-1 self-start"
            >
              {w.template[a]}
            </Badge>
          </label>
        );
      })}
    </div>
  );
}
