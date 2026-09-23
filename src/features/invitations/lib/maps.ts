import type { Venue } from '../contracts/types';

type VenueLocation = Pick<Venue, 'geo' | 'mapsQuery'> & { fallbackQuery?: string };

function query(v: VenueLocation): string {
  return v.geo ? `${v.geo.lat},${v.geo.lng}` : (v.mapsQuery ?? v.fallbackQuery ?? '').trim();
}

export function hasLocation(v: VenueLocation): boolean {
  return query(v) !== '';
}

export function googleMapsUrl(v: VenueLocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(v))}`;
}

/** `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes` or `?q=<query>` (§5). */
export function wazeUrl(v: VenueLocation): string {
  return v.geo
    ? `https://waze.com/ul?ll=${v.geo.lat},${v.geo.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(query(v))}&navigate=yes`;
}

/** Key-less embed; loaded lazily only once the map placeholder scrolls into view (P3). */
export function googleMapsEmbedUrl(v: VenueLocation, locale: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query(v))}&hl=${locale}&z=15&output=embed`;
}
