import type { IntegrationMode, Integrations } from './plan';

/** The three levels the host picks from: standalone, recommended (the default) and full. */
export function integrationsForMode(mode: IntegrationMode): Integrations {
  switch (mode) {
    case 'standalone':
      return {
        mode,
        vendors: false,
        tasks: false,
        guests: false,
        seating: false,
        eventDay: false,
        overview: false,
      };
    case 'full':
      return {
        mode,
        vendors: true,
        tasks: true,
        guests: true,
        seating: true,
        eventDay: true,
        overview: true,
      };
    case 'recommended':
      return {
        mode,
        vendors: true,
        tasks: true,
        guests: false,
        seating: false,
        eventDay: false,
        overview: true,
      };
  }
}

/** The integrations as stored (an old or partial value), with every switch decided. */
export function readIntegrations(raw: Partial<Integrations> | null | undefined): Integrations {
  const mode = raw?.mode ?? 'recommended';
  const base = integrationsForMode(mode);
  return {
    mode,
    vendors: raw?.vendors ?? base.vendors,
    tasks: raw?.tasks ?? base.tasks,
    guests: raw?.guests ?? base.guests,
    seating: raw?.seating ?? base.seating,
    eventDay: raw?.eventDay ?? base.eventDay,
    overview: raw?.overview ?? base.overview,
  };
}
