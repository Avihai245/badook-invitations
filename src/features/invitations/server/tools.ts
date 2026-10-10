import 'server-only';
import { whyOff, type FeatureInput } from '@/features/flags/features';
import { deploymentFeatures } from '@/features/flags/server';
import { TOOLS, eventTools, shownTools, type ToolKey } from '../lib/tools';

/**
 * An event's tools as its screens need them (lib/tools): the ones it shows, the ones it could have
 * (offered here — some only with a higher package: `locked`).
 */
export function toolsView(
  item: { eventType: string },
  input: (FeatureInput & { tools: ToolKey[] | null }) | null,
  planned: boolean,
): { tools: ToolKey[]; offered: ToolKey[]; locked: ToolKey[] } {
  const why = (f: Parameters<typeof whyOff>[0]) => (input ? whyOff(f, input) : 'unavailable');
  const gallery = deploymentFeatures().has('live_gallery');
  const planning = item.eventType !== 'save_the_date' && why('planning') === null;
  const seating = why('seating');
  const day = why('checkin');
  const has = {
    planning,
    seating: seating === null || seating === 'plan',
    day: day === null || day === 'plan' || gallery,
  };
  const offered = TOOLS.filter(
    (k) =>
      k === 'invite' ||
      (k === 'plan' && has.planning) ||
      (k === 'seating' && has.seating) ||
      (k === 'day' && has.day),
  );
  const locked = [
    ...(seating === 'plan' ? (['seating'] as const) : []),
    ...(day === 'plan' && !gallery ? (['day'] as const) : []),
  ];
  return { tools: shownTools(eventTools(input?.tools ?? null, { planned }), has), offered, locked };
}
