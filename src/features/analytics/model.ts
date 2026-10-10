import { z } from 'zod';

/**
 * The host's path through the app, measured first party (no cookie, no third party): a few named steps
 * that tell where new hosts stop — the list seen, an event entered, the next step taken, the tools
 * chosen, publishing, the first send, help opened. The browser sends them (track.ts), the server keeps
 * them for a signed-in host (host_events, 400 days). Nothing under Global Privacy Control or Do Not
 * Track. Pure: the route and the tests share it.
 */

export const HOST_EVENTS = [
  /** the list of events was seen */
  'list_view',
  /** an event was entered — from its card, its button, or straight on (one event: redirect) */
  'event_enter',
  /** the event's home was seen */
  'home_view',
  /** a step of the event's path was taken (props.step, props.source: home | list | sidebar) */
  'step_click',
  /** the event's tools were chosen or changed (props.tools, props.source: start | home | settings) */
  'tools_set',
  /** the publish dialog was opened from a next step */
  'publish_open',
  /** the help panel was opened */
  'help_open',
  /** the first-visit tour: skipped or finished */
  'tour_skip',
  'tour_done',
] as const;
export type HostEventName = (typeof HOST_EVENTS)[number];

const PropValue = z.union([z.string().max(60), z.number().finite(), z.boolean()]);

export const TrackSchema = z.strictObject({
  name: z.enum(HOST_EVENTS),
  invitationId: z.uuid().optional(),
  props: z.record(z.string().regex(/^[a-z_]{1,24}$/), PropValue).optional(),
});
export type TrackInput = z.infer<typeof TrackSchema>;

export interface TrackDeps {
  /** the invitation is this host's (an event step is only kept for the host's own event) */
  owns(userId: string, invitationId: string): Promise<boolean>;
  insert(row: {
    user_id: string;
    invitation_id: string | null;
    name: HostEventName;
    props: Record<string, string | number | boolean>;
  }): Promise<void>;
}

export type TrackResult = { status: 204 | 400; code?: string };

/** One step: checked, at most 8 props, kept for the host — or quietly dropped (204 either way). */
export async function recordHostEvent(
  userId: string,
  raw: unknown,
  privacy: { gpc: boolean; dnt: boolean },
  deps: TrackDeps,
): Promise<TrackResult> {
  if (privacy.gpc || privacy.dnt) return { status: 204 };
  const parsed = TrackSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, code: 'invalid' };
  const { name, invitationId, props = {} } = parsed.data;
  if (Object.keys(props).length > 8) return { status: 400, code: 'invalid' };
  if (invitationId && !(await deps.owns(userId, invitationId))) return { status: 204 };
  await deps.insert({ user_id: userId, invitation_id: invitationId ?? null, name, props });
  return { status: 204 };
}
