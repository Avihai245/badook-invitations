'use client';

import { Download, FileSpreadsheet, MessageCircle, Send, Upload, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/**
 * The guest list's two main actions, side by side at the top: upload the list from Excel (or add
 * guests by hand), and send the invitation on WhatsApp to everyone — with what it costs, or why it
 * can't be sent yet.
 */
export function GuestsActions({
  onImport,
  onAdd,
  onSend,
  sendHint,
  sendBlocked,
}: {
  onImport: () => void;
  onAdd: () => void;
  onSend: () => void;
  /** who is left and what it costs */
  sendHint: string;
  /** why sending can't start now (the button is disabled), or null */
  sendBlocked: string | null;
}) {
  const { t } = useUi();
  const g = t.guests;
  return (
    <Card className="mt-5 grid overflow-hidden md:grid-cols-2" data-testid="guests-actions">
      <section className="flex flex-col gap-3 p-5 sm:p-6">
        <StepLabel icon={<FileSpreadsheet />} tone="brand">
          {g.start.importStep}
        </StepLabel>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" icon={<Upload />} onClick={onImport} className="max-sm:w-full">
            {g.actions.import}
          </Button>
          <Button size="lg" variant="secondary" icon={<UserPlus />} onClick={onAdd} className="max-sm:w-full">
            {g.actions.addManual}
          </Button>
        </div>
        <p className="text-[13px] leading-[1.55] text-muted">{g.start.importHint}</p>
      </section>
      <section className="flex flex-col gap-3 border-t border-line p-5 sm:p-6 md:border-t-0 md:border-s">
        <StepLabel icon={<MessageCircle />} tone="whatsapp">
          {g.start.sendStep}
        </StepLabel>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            variant="whatsapp"
            icon={<Send className="icon-dir" />}
            onClick={onSend}
            disabled={!!sendBlocked}
            aria-describedby="guests-send-note"
            className="max-sm:w-full"
          >
            {g.actions.whatsappAll}
          </Button>
        </div>
        <p
          id="guests-send-note"
          className={cn(
            'text-[13px] leading-[1.55]',
            sendBlocked ? 'font-medium text-warning' : 'text-muted',
          )}
        >
          {sendBlocked ?? sendHint}
        </p>
      </section>
    </Card>
  );
}

function StepLabel({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: 'brand' | 'whatsapp';
  children: ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
      <span
        aria-hidden
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-[15px]',
          tone === 'brand' ? 'bg-brand-soft text-brand-deep' : 'bg-[#e7f8ee] text-[#128c4a]',
        )}
      >
        {icon}
      </span>
      {children}
    </p>
  );
}

/** No guests yet: three steps, a big "upload an Excel file", adding by hand, and the sample file. */
export function GuestsGuide({
  onImport,
  onAdd,
  onSample,
}: {
  onImport: () => void;
  onAdd: () => void;
  onSample: () => void;
}) {
  const { t, number } = useUi();
  const guide = t.guests.guide;
  return (
    <Card className="mt-5 overflow-hidden" data-testid="guests-guide">
      <div className="px-5 pt-8 text-center sm:px-10">
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand-deep"
        >
          <Users className="size-7" strokeWidth={1.6} />
        </span>
        <h2 className="mt-4 text-[20px] font-bold tracking-[-0.01em] text-balance">{guide.title}</h2>
        <p className="mt-1 text-[14px] text-muted text-balance">{guide.body}</p>
      </div>
      <ol className="mt-6 grid gap-3 px-5 sm:grid-cols-3 sm:px-8">
        {guide.steps.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-card border border-line bg-canvas p-4 sm:flex-col"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-bold text-primary-ink tabular-nums"
            >
              {number(i + 1)}
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold">{step.title}</span>
              <span className="mt-1 block text-[13px] leading-[1.55] text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col items-center gap-3 px-5 pt-7 pb-8">
        <Button size="lg" icon={<Upload />} onClick={onImport} className="max-sm:w-full sm:min-w-[260px]">
          {guide.upload}
        </Button>
        <div className="flex w-full flex-wrap justify-center gap-2">
          <Button variant="secondary" icon={<UserPlus />} onClick={onAdd} className="max-sm:flex-1">
            {guide.manual}
          </Button>
          <Button variant="ghost" icon={<Download />} onClick={onSample} className="max-sm:flex-1">
            {guide.sample}
          </Button>
        </div>
      </div>
    </Card>
  );
}
