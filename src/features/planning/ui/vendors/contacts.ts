/**
 * The phone's contact picker (the Contact Picker API: Chrome on Android, Safari on iOS 18+), only when it
 * is there. Everything here answers "nothing" rather than throw: a cancelled picker, a refused permission
 * and a browser without it all look the same to the screen.
 */

interface ContactsManager {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<{ name?: string[]; tel?: string[] }[]>;
}

const manager = (): ContactsManager | null => {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
    const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
    return contacts && typeof contacts.select === 'function' && 'ContactsManager' in window ? contacts : null;
  } catch {
    return null;
  }
};

export const contactPickerAvailable = () => manager() !== null;

export interface PickedContact {
  name: string | null;
  phone: string | null;
}

/** One contact's name and first phone, or null (cancelled, refused, or not supported). */
export async function pickContact(): Promise<PickedContact | null> {
  try {
    const m = manager();
    if (!m) return null;
    const [first] = await m.select(['name', 'tel'], { multiple: false });
    if (!first) return null;
    return { name: first.name?.[0]?.trim() || null, phone: first.tel?.[0]?.trim() || null };
  } catch {
    return null;
  }
}
