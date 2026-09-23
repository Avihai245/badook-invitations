'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { rovingKeyDown } from './roving';
import { cn, iconSlot } from './utils';

type TabsContextValue = { baseId: string; value: string };
const TabsContext = createContext<TabsContextValue | null>(null);

const tabId = (baseId: string, value: string) => `${baseId}tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}panel-${value}`;

export type TabsItem<V extends string> = {
  value: V;
  label: ReactNode;
  /** 15px icon before the label. */
  icon?: ReactNode;
  disabled?: boolean;
};

export type TabsProps<V extends string> = {
  value: V;
  onValueChange: (value: V) => void;
  items: readonly TabsItem<V>[];
  /** Accessible name of the tab list. */
  label: string;
  /** Items share the width equally (app.html `.rail-tabs`). Default true. */
  stretch?: boolean;
  className?: string;
  /** Class for the tablist row (padding/border live with the layout, e.g. `px-3 py-2.5 border-b`). */
  listClassName?: string;
  /** `<TabsPanel>`s. */
  children?: ReactNode;
};

/**
 * Rail tabs (app.html `.rail-tabs`): 32px buttons, 13px muted, icon + label; active = subtle bg +
 * ink/600. WAI-ARIA tabs with automatic activation; arrows follow the visual order (RTL-aware).
 */
export function Tabs<V extends string>({
  value,
  onValueChange,
  items,
  label,
  stretch = true,
  className,
  listClassName,
  children,
}: TabsProps<V>) {
  const baseId = useId();
  const enabled = items.filter((i) => !i.disabled);
  const tabStop = enabled.some((i) => i.value === value) ? value : enabled[0]?.value;

  return (
    <TabsContext.Provider value={{ baseId, value }}>
      <div className={className}>
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={rovingKeyDown}
          className={cn('flex gap-1', listClassName)}
        >
          {items.map((item) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={tabId(baseId, item.value)}
                aria-selected={selected}
                aria-controls={panelId(baseId, item.value)}
                disabled={item.disabled}
                tabIndex={item.value === tabStop ? 0 : -1}
                data-roving-item=""
                onClick={() => onValueChange(item.value)}
                className={cn(
                  'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-btn px-3 text-[13px] whitespace-nowrap',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  stretch && 'flex-1',
                  selected ? 'bg-subtle font-semibold text-ink' : 'text-muted',
                  item.disabled ? 'cursor-not-allowed opacity-50' : !selected && 'hover:text-ink',
                )}
              >
                {item.icon != null && (
                  <span aria-hidden className={cn(iconSlot, '[&_svg]:size-[15px]')}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsPanelProps = {
  value: string;
  children: ReactNode;
  className?: string;
  /** Keep the panel in the DOM (hidden) while another tab is active, to preserve its state. */
  keepMounted?: boolean;
};

export function TabsPanel({ value, children, className, keepMounted = false }: TabsPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('<TabsPanel> must be rendered inside <Tabs>.');
  const selected = context.value === value;
  if (!selected && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(context.baseId, value)}
      aria-labelledby={tabId(context.baseId, value)}
      hidden={!selected}
      tabIndex={0}
      className={cn('focus-visible:outline-offset-[-2px]', className)}
    >
      {children}
    </div>
  );
}
