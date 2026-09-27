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

/**
 * The gallery link's template (badook_gallery, docs/whatsapp-setup.md §9) in each language, as the
 * "send guests the gallery link" dialog previews it: {{1}} guest · {{2}} hosts; the button opens the
 * guest's own gallery link. Amharic has no Meta template (Amharic guests get the invitation's
 * language); its text is here for the day Meta adds it.
 */
export const GALLERY_TEMPLATE_TEXT: Record<Locale, { body: string; button: string; footer: string }> = {
  he: {
    body: 'שלום {{1}} 📸\nהגלריה של האירוע של {{2}} פתוחה: אפשר להעלות את התמונות והסרטונים שצילמתם ולראות את של כולם.\nלגלריה בכפתור 👇',
    button: 'לגלריה',
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 📸\nThe gallery of {{2}}’s event is open: upload the photos and videos you took and see everyone’s.\nTap the button for the gallery 👇',
    button: 'To the gallery',
    footer: 'Sent with Badook',
  },
  ru: {
    body: 'Здравствуйте, {{1}}! 📸\nГалерея праздника «{{2}}» открыта: загрузите фото и видео, которые вы сняли, и посмотрите снимки всех гостей.\nГалерея — по кнопке ниже 👇',
    button: 'В галерею',
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 📸\nمعرض مناسبة {{2}} مفتوح الآن: ارفعوا الصور والفيديوهات التي التقطتموها وشاهدوا صور الجميع.\nللدخول إلى المعرض اضغطوا على الزر 👇',
    button: 'إلى المعرض',
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 📸\nLa galerie de l’événement de {{2}} est ouverte : envoyez les photos et vidéos que vous avez prises, et découvrez celles de tout le monde.\nLa galerie, c’est par le bouton ci-dessous 👇',
    button: 'Vers la galerie',
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 📸\nLa galería de la celebración de {{2}} ya está abierta: sube las fotos y vídeos que hiciste y mira los de todos.\nToca el botón para ir a la galería 👇',
    button: 'Ir a la galería',
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 📸\nየ{{2}} ዝግጅት የፎቶ ማዕከል ተከፍቷል፦ ያነሷቸውን ፎቶዎችና ቪዲዮዎች ይስቀሉ፤ የሁሉንም ይመልከቱ።\nወደ ፎቶ ማዕከሉ ለመሄድ ከታች ያለውን ቁልፍ ይጫኑ 👇',
    button: 'ወደ ፎቶ ማዕከሉ',
    footer: 'በBadook የተላከ',
  },
};

/** A template's body with its values: {{1}} is values[0], {{2}} values[1]… */
export function fillTemplate(body: string, values: readonly string[]): string {
  return body.replace(/\{\{([1-9])\}\}/g, (_, n: string) => values[Number(n) - 1] ?? '');
}
