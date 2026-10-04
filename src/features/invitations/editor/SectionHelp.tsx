'use client';

import { Eye, Info, Lightbulb } from 'lucide-react';
import { AreaHelp } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { Section } from '../contracts/types';

type HelpKey = keyof ReturnType<typeof useUi>['t']['sectionHelp']['types'];

/** The section's "?" entry: a text section by its kind, the v2 picture-and-text section as its own. */
export function sectionHelpKey(section: Section): string {
  if (section.type === 'text') return section.data.kind;
  if (section.type === 'custom') return 'custom_media';
  return section.type;
}

/**
 * A section's "?" (in the sections list and beside its form's title): what it is, what the guests see,
 * and a tip — the host's own answer to "what does this part do?" (lib/i18n/section-help).
 */
export function SectionHelp({
  helpKey,
  name,
  className,
}: {
  helpKey: string;
  name: string;
  className?: string;
}) {
  const { t, fmt } = useUi();
  const H = t.sectionHelp;
  const entry = H.types[helpKey as HelpKey];
  if (!entry) return null;
  const title = fmt(H.labels.title, { name });
  return (
    <AreaHelp
      label={title}
      title={title}
      items={[
        { icon: <Info />, label: H.labels.what, text: entry.what },
        { icon: <Eye />, label: H.labels.guests, text: entry.guests },
        { icon: <Lightbulb />, label: H.labels.tip, text: entry.tip },
      ]}
      className={className}
    />
  );
}
