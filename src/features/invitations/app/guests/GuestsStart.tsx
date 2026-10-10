'use client';

import { Download, Upload, UserPlus, Users } from 'lucide-react';
import { Button, Card } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

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
