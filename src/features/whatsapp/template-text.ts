import type { Locale } from '@/features/invitations/contracts/types';

/**
 * The fixed WhatsApp template in each language (what the platform submits to Meta for approval, one
 * language at a time — docs/whatsapp-setup.md) as the send dialog previews it. {{1}} guest · {{2}}
 * hosts · {{3}} event phrase (lib/event-phrases) · {{4}} date. Each language's sentence keeps text
 * between its variables (Meta refuses templates with variables side by side) and never needs the
 * hosts' names declined or a verb to agree with them.
 */
export const TEMPLATE_TEXT: Record<Locale, { body: string; button: string; footer: string }> = {
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
  ru: {
    body: 'Здравствуйте, {{1}}! 👋\nВас приглашают {{3}}: {{2}}.\n📅 {{4}}\nВсе подробности и подтверждение участия — по кнопке ниже 👇',
    button: 'Приглашение и ответ',
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 👋\nيسرّ {{2}} دعوتكم {{3}} يوم {{4}}.\nلكل التفاصيل ولتأكيد الحضور اضغطوا على الزر 👇',
    button: 'الدعوة وتأكيد الحضور',
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 👋\nVous êtes invités {{3}} : {{2}}.\n📅 {{4}}\nTous les détails et la réponse en un clic ci-dessous 👇',
    button: 'Invitation et réponse',
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 👋\nTienes una invitación {{3}} de {{2}}.\n📅 {{4}}\nToca el botón para ver todos los detalles y confirmar 👇',
    button: 'Invitación y respuesta',
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 👋\nግብዣ {{3}}፦ {{2}}።\n📅 {{4}}\nለሁሉም ዝርዝሮችና ለመገኘት ማረጋገጫ ከታች ያለውን ቁልፍ ይጫኑ 👇',
    button: 'ግብዣና ምላሽ',
    footer: 'በBadook የተላከ',
  },
};

export function fillTemplate(body: string, values: [string, string, string, string]): string {
  return body.replace(/\{\{([1-4])\}\}/g, (_, n: string) => values[Number(n) - 1] ?? '');
}
