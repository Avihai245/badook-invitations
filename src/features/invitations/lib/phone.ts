import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/**
 * A guest's phone in E.164 (`+972501234567`) when it parses: Israeli numbers typed without a country
 * code included; a number with `+`/`00` only has to be possible for its country. Anything else stays
 * as typed (the form's own check already accepted it).
 */
export function toE164(raw: string, defaultCountry: CountryCode = 'IL'): string {
  const typed = raw.trim();
  const international = /^(\+|00)/.test(typed);
  const parsed = parsePhoneNumberFromString(
    international ? typed.replace(/^00/, '+') : typed,
    defaultCountry,
  );
  if (parsed && (parsed.isValid() || (international && parsed.isPossible()))) return parsed.number;
  return typed;
}

/** For hosts: Israeli numbers in the national format (050-123-4567), others international. */
export function formatPhone(value: string): string {
  const parsed = value.startsWith('+') ? parsePhoneNumberFromString(value) : undefined;
  if (!parsed) return value;
  return parsed.country === 'IL' ? parsed.formatNational() : parsed.formatInternational();
}
