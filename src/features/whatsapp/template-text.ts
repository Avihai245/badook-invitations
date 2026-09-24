/**
 * The fixed WhatsApp template (what the platform submits to Meta for approval — docs/whatsapp-setup.md)
 * as the send dialog previews it. {{1}} guest · {{2}} hosts · {{3}} event phrase · {{4}} date.
 */
export const TEMPLATE_TEXT = {
  he: {
    body: 'שלום {{1}} 👋\n{{2}} מזמינים אותך {{3}} ב{{4}}.\nלכל הפרטים ולאישור הגעה לחצו על הכפתור 👇',
    button: 'להזמנה ולאישור הגעה',
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 👋\n{{2}} invite you {{3}} on {{4}}.\nTap the button for all the details and to RSVP 👇',
    button: 'Invitation & RSVP',
    footer: 'Sent with Badook',
  },
} as const;

export function fillTemplate(body: string, values: [string, string, string, string]): string {
  return body.replace(/\{\{([1-4])\}\}/g, (_, n: string) => values[Number(n) - 1] ?? '');
}
