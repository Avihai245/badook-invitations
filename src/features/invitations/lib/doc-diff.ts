/**
 * What restoring an entry of the history would change in the draft, in the host's terms: the design
 * (another template, the colors, fonts, type scale / motion, the opening, the cover, the music), the
 * event's details, languages and sharing, the order of the sections — and per section: brought back,
 * removed, shown, hidden, or changed (its text, picture, layout, motion, colors or settings). The
 * versions drawer puts these into words. Pure and isomorphic.
 */
import { LOCALES, type InvitationDocument, type Section } from '../contracts/types';

export type ChangeField = 'text' | 'media' | 'layout' | 'motion' | 'colors' | 'settings';

export type DocChange =
  | { kind: 'template'; templateId: string }
  | {
      kind:
        | 'palette'
        | 'fonts'
        | 'style'
        | 'opening'
        | 'cover'
        | 'music'
        | 'hosts'
        | 'event'
        | 'languages'
        | 'share'
        | 'order';
    }
  | { kind: 'added' | 'removed' | 'shown' | 'hidden'; section: Section }
  | { kind: 'changed'; section: Section; fields: ChangeField[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const LOCALE_SET = new Set<string>(LOCALES);
/** A user text: an object whose keys are languages (L10n). */
const isL10n = (v: unknown): boolean =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => LOCALE_SET.has(k) || /^[a-z]{2,3}$/.test(k)) &&
  Object.values(v).every((x) => typeof x === 'string');

/** Whether `a` and `b` differ in their texts, in anything else, or both. */
function dataFields(a: unknown, b: unknown, out: Set<ChangeField>): void {
  if (same(a, b)) return;
  if (isL10n(a) || isL10n(b)) {
    out.add('text');
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) {
      out.add('settings');
      return;
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
      // an item added or removed: its texts, and the list itself
      out.add('settings');
      if ([...a, ...b].some((x) => x && typeof x === 'object' && Object.values(x).some(isL10n)))
        out.add('text');
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys)
      dataFields((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], out);
    return;
  }
  out.add('settings');
}

/** How a section differs between two documents (empty: it doesn't). */
export function sectionFields(from: Section, to: Section): ChangeField[] {
  const out = new Set<ChangeField>();
  dataFields(from.data, to.data, out);
  if (!same(from.media, to.media)) out.add('media');
  if (!same(from.layout, to.layout)) out.add('layout');
  if (!same(from.animation, to.animation)) out.add('motion');
  if (!same(from.themeOverrides, to.themeOverrides)) out.add('colors');
  if (!same(from.variant, to.variant)) out.add('settings');
  const order: ChangeField[] = ['text', 'media', 'layout', 'motion', 'colors', 'settings'];
  return order.filter((f) => out.has(f));
}

/** What replacing `current` with `target` changes (target's point of view: what the host would get). */
export function describeChanges(current: InvitationDocument, target: InvitationDocument): DocChange[] {
  const out: DocChange[] = [];
  if (current.templateId !== target.templateId) out.push({ kind: 'template', templateId: target.templateId });
  if (!same(current.theme.palette, target.theme.palette)) out.push({ kind: 'palette' });
  if (current.theme.fontPairId !== target.theme.fontPairId) out.push({ kind: 'fonts' });
  if (!same(current.theme.tokens, target.theme.tokens)) out.push({ kind: 'style' });
  if (!same(current.cover.opening, target.cover.opening)) out.push({ kind: 'opening' });
  const { opening: _a, ...coverA } = current.cover;
  const { opening: _b, ...coverB } = target.cover;
  if (!same(coverA, coverB)) out.push({ kind: 'cover' });
  if (!same(current.music, target.music)) out.push({ kind: 'music' });
  if (!same(current.hosts, target.hosts)) out.push({ kind: 'hosts' });
  if (
    !same(current.event, target.event) ||
    current.timezone !== target.timezone ||
    current.eventType !== target.eventType
  )
    out.push({ kind: 'event' });
  if (!same(current.locales, target.locales) || current.defaultLocale !== target.defaultLocale)
    out.push({ kind: 'languages' });
  if (!same(current.share, target.share)) out.push({ kind: 'share' });

  const now = new Map(current.sections.map((s) => [s.id, s]));
  const then = new Map(target.sections.map((s) => [s.id, s]));
  const common = (list: readonly Section[], other: Map<string, Section>) =>
    list.filter((s) => other.has(s.id)).map((s) => s.id);
  if (!same(common(current.sections, then), common(target.sections, now))) out.push({ kind: 'order' });
  for (const s of target.sections) {
    const was = now.get(s.id);
    if (!was) {
      out.push({ kind: 'added', section: s });
      continue;
    }
    if (was.enabled !== s.enabled) out.push({ kind: s.enabled ? 'shown' : 'hidden', section: s });
    const fields = sectionFields(was, s);
    if (fields.length) out.push({ kind: 'changed', section: s, fields });
  }
  for (const s of current.sections) if (!then.has(s.id)) out.push({ kind: 'removed', section: s });
  return out;
}
