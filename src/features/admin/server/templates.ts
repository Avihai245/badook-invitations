import 'server-only';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import type { UiLocale } from '@/lib/i18n/app';

/** The designs' names in the console's language, by id (a design no longer in the code: its id). */
export function templateNames(locale: UiLocale): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [id, { manifest }] of TEMPLATES) {
    const name = manifest.name as Partial<Record<string, string>>;
    names[id] = name[locale] ?? name.en ?? name.he ?? id;
  }
  return names;
}
