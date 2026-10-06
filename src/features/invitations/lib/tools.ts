/**
 * The event's tools: what the host said they need for this event. Not every host wants everything — one
 * only wants a digital invitation and the RSVPs, another plans the whole wedding, a third only seats the
 * guests. The host picks them when the event starts (onboarding/StartWizard) and can add or remove one
 * at any time (the event's home, its settings). The tools only shape what the event's screens show: the
 * sidebar's stages, the event's home (its steps and widgets) and the card on the list; what the event
 * may use is still the features' (flags/features). Stored in invitations.features.tools
 * (invitation_tools_set). Pure: the server and the browser share it.
 */

export const TOOLS = ['invite', 'plan', 'seating', 'day'] as const;
export type ToolKey = (typeof TOOLS)[number];
export const isTool = (v: unknown): v is ToolKey => TOOLS.includes(v as ToolKey);

/** What a new event starts with when the host didn't say: the invitation (the product's heart). */
export const DEFAULT_TOOLS: readonly ToolKey[] = ['invite'];

/** The stored list (null: the host never chose — an event from before the tools, or a stray value). */
export function readTools(raw: unknown): ToolKey[] | null {
  if (!Array.isArray(raw)) return null;
  const list = TOOLS.filter((t) => raw.includes(t));
  return list.length ? list : null;
}

/** A host's choice, cleaned: known tools, each once, in their order; never empty (the invitation then). */
export function cleanTools(raw: readonly unknown[]): ToolKey[] {
  const list = TOOLS.filter((t) => raw.includes(t));
  return list.length ? list : [...DEFAULT_TOOLS];
}

/**
 * The tools an event shows. A host who chose: exactly those. An event from before the choice existed:
 * what it was already using — the invitation, seating and the event day as they were, and the planning
 * only once it was set up (an empty plan of thirty tasks is what made the first screen look heavy).
 */
export function eventTools(chosen: readonly ToolKey[] | null, ctx: { planned: boolean }): Set<ToolKey> {
  if (chosen) return new Set(chosen);
  const out = new Set<ToolKey>(['invite', 'seating', 'day']);
  if (ctx.planned) out.add('plan');
  return out;
}

/**
 * The tools an event shows that it can also use: planning only where it's offered (not for a
 * save-the-date), seating and the event day where offered (or offered with an upgrade). Never empty.
 */
export function shownTools(
  tools: ReadonlySet<ToolKey>,
  offered: { planning: boolean; seating: boolean; day: boolean },
): ToolKey[] {
  const list = TOOLS.filter(
    (t) =>
      tools.has(t) &&
      (t === 'invite' ||
        (t === 'plan' && offered.planning) ||
        (t === 'seating' && offered.seating) ||
        (t === 'day' && offered.day)),
  );
  return list.length ? list : ['invite'];
}
