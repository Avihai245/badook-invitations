/** The time zone a new invitation starts with (§7.2: Asia/Jerusalem for Hebrew, else the browser's). */
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Every IANA zone the engine knows, labelled "Asia/Jerusalem (GMT+3)"; `ensure` is always included. */
export function timezoneOptions(
  ensure: readonly string[] = [DEFAULT_TIMEZONE],
): { id: string; label: string }[] {
  const ids = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const all = [...ensure.filter((z) => !ids.includes(z)), ...ids];
  const now = new Date();
  return all.map((id) => {
    let offset = '';
    try {
      offset =
        new Intl.DateTimeFormat('en', { timeZone: id, timeZoneName: 'shortOffset' })
          .formatToParts(now)
          .find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
      // unknown to this engine: listed without an offset
    }
    return { id, label: `${id.replace(/_/g, ' ')}${offset ? ` (${offset})` : ''}` };
  });
}
