'use client';

import { Armchair, Check, ClipboardList, PartyPopper, Send, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { TOOLS, type ToolKey } from '../../lib/tools';

export const TOOL_ICONS: Record<ToolKey, LucideIcon> = {
  invite: Send,
  plan: ClipboardList,
  seating: Armchair,
  day: PartyPopper,
};

/**
 * The event's tools as big cards to tick (lib/tools): each with its icon, name and one line on what it
 * does; any mix, at least one. The start wizard asks with it, and the event's home changes them with it.
 * A tool the event isn't offered (not in `offered`) isn't shown; one only a higher package gives says so.
 */
export function ToolsPicker({
  value,
  onChange,
  offered = TOOLS,
  locked = [],
  popular = null,
  columns = 2,
}: {
  value: readonly ToolKey[];
  onChange: (tools: ToolKey[]) => void;
  offered?: readonly ToolKey[];
  /** offered with an upgrade */
  locked?: readonly ToolKey[];
  /** a "most popular" mark on one card */
  popular?: ToolKey | null;
  columns?: 2 | 4;
}) {
  const { t } = useUi();
  const T = t.eventHome.tools;
  const toggle = (k: ToolKey) =>
    onChange(TOOLS.filter((x) => (x === k ? !value.includes(k) : value.includes(x))));
  return (
    <div
      role="group"
      aria-label={T.title}
      className={cn('grid gap-3', columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2')}
      data-testid="tools-picker"
    >
      {TOOLS.filter((k) => offered.includes(k)).map((k) => {
        const on = value.includes(k);
        const Icon = TOOL_ICONS[k];
        return (
          <button
            key={k}
            type="button"
            role="checkbox"
            aria-checked={on}
            data-tool={k}
            onClick={() => toggle(k)}
            className={cn(
              'relative flex items-start gap-3 rounded-[20px] border-2 bg-surface p-4 text-start shadow-sm transition-[box-shadow,border-color] hover:shadow-md motion-reduce:transition-none sm:p-5',
              on ? 'border-brand bg-brand-soft/40' : 'border-transparent ring-1 ring-line',
            )}
          >
            {popular === k ? (
              <span className="absolute -top-2.5 end-4 rounded-full bg-brand-deep px-2.5 py-0.5 text-[11px] font-bold text-white dark:text-[#1c1917]">
                {t.start.needs.popular}
              </span>
            ) : null}
            <span
              aria-hidden
              className={cn(
                'grid size-12 shrink-0 place-items-center rounded-[15px] [&_svg]:size-6',
                on ? 'bg-brand text-white' : 'bg-brand-soft text-brand-deep',
              )}
            >
              <Icon strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] leading-snug font-bold">{T.items[k].title}</span>
              <span className="mt-1 block text-[13.5px] text-muted">{T.items[k].body}</span>
              {locked.includes(k) ? (
                <span className="mt-2 inline-block rounded-full bg-subtle px-2 py-0.5 text-[11.5px] font-semibold text-muted">
                  {T.upgrade}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface',
              )}
            >
              {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Stores the event's tools (PUT /api/invitations/:id/tools); false when it didn't work. */
export async function saveEventTools(id: string, tools: readonly ToolKey[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/invitations/${id}/tools`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tools }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
