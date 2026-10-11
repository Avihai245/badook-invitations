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

/**
 * The album's thank-you template (badook_album, docs/whatsapp-setup.md §10) in each language, as the
 * "send guests the album" dialog previews it: {{1}} guest · {{2}} where they celebrated
 * (album/phrases.ts: "בחתונה שלנו") · {{3}} hosts; the button opens the album in the guest's language.
 */
export const ALBUM_TEMPLATE_TEXT: Record<Locale, { body: string; button: string; footer: string }> = {
  he: {
    body: 'היי {{1}} 💛\nתודה שחגגתם איתנו {{2}}!\nאספנו את הרגעים היפים שצילמתם לאלבום אחד — מוזמנים להיכנס, להיזכר ולשתף.\nבאהבה, {{3}}\nלאלבום בכפתור 👇',
    button: 'לאלבום',
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 💛\nThank you for celebrating with us {{2}}!\nWe gathered the beautiful moments you captured into one album — come relive them and share.\nWith love, {{3}}\nTap the button for the album 👇',
    button: 'To the album',
    footer: 'Sent with Badook',
  },
  ru: {
    body: 'Здравствуйте, {{1}}! 💛\nСпасибо, что праздновали вместе с нами {{2}}!\nМы собрали красивые моменты, которые вы сняли, в один альбом — заходите вспомнить и поделиться.\nС любовью, {{3}}\nАльбом — по кнопке ниже 👇',
    button: 'К альбому',
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 💛\nشكرًا لأنكم احتفلتم معنا {{2}}!\nجمعنا اللحظات الجميلة التي التقطتموها في ألبوم واحد — ادخلوا لتستعيدوا الذكريات وتشاركوها.\nمع الحب، {{3}}\nللألبوم اضغطوا على الزر 👇',
    button: 'إلى الألبوم',
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 💛\nMerci d’avoir fêté avec nous {{2}} !\nNous avons réuni les beaux moments que vous avez capturés dans un seul album — venez les revivre et les partager.\nAvec amour, {{3}}\nL’album, c’est par le bouton ci-dessous 👇',
    button: 'Voir l’album',
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 💛\n¡Gracias por celebrar con nosotros {{2}}!\nReunimos en un solo álbum los momentos bonitos que capturaste: entra a revivirlos y compartirlos.\nCon cariño, {{3}}\nToca el botón para ver el álbum 👇',
    button: 'Ver el álbum',
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 💛\nከእኛ ጋር {{2}} ስላከበሩ እናመሰግናለን!\nያነሷቸውን ውብ ጊዜያት በአንድ አልበም ሰብስበናል — ገብተው ያስታውሱ፤ ያጋሩም።\nበፍቅር፣ {{3}}\nወደ አልበሙ ለመሄድ ከታች ያለውን ቁልፍ ይጫኑ 👇',
    button: 'ወደ አልበሙ',
    footer: 'በBadook የተላከ',
  },
};

/** A template's body with its values: {{1}} is values[0], {{2}} values[1]… */
export function fillTemplate(body: string, values: readonly string[]): string {
  return body.replace(/\{\{([1-9])\}\}/g, (_, n: string) => values[Number(n) - 1] ?? '');
}

/** A template as the screens preview it: its body, its footer, and its button's label (null: none). */
export interface TemplateText {
  body: string;
  button: string | null;
  footer: string;
}

/**
 * The RSVP follow-up (badook_rsvp_reminder, docs/whatsapp-setup.md §11) to guests who got the
 * invitation and haven't answered: the invitation's own values — {{1}} guest · {{2}} hosts · {{3}} the
 * event with its preposition · {{4}} the date — and the same button to their personal link.
 */
export const REMINDER_TEMPLATE_TEXT: Record<Locale, TemplateText> = {
  he: {
    body: 'שלום {{1}} 👋\nרק מזכירים: {{2}} מזמינים אותך {{3}} ב{{4}}, ועוד לא קיבלנו ממך תשובה.\nנשמח לדעת אם תגיעו — זה לוקח רגע בכפתור 👇',
    button: 'לאישור הגעה',
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 👋\nJust a reminder: {{2}} invite you {{3}} on {{4}}, and we haven’t heard from you yet.\nLet us know if you’re coming — it takes a moment with the button 👇',
    button: 'RSVP',
    footer: 'Sent with Badook',
  },
  ru: {
    body: 'Здравствуйте, {{1}}! 👋\nНапоминаем: вас приглашают {{3}}: {{2}}.\n📅 {{4}}\nМы ещё не получили ваш ответ — подтвердите участие по кнопке ниже 👇',
    button: 'Ответить',
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 👋\nتذكير لطيف: يسرّ {{2}} دعوتكم {{3}} يوم {{4}}، ولم يصلنا ردّكم بعد.\nيسعدنا أن نعرف إن كنتم ستحضرون — اضغطوا على الزر 👇',
    button: 'تأكيد الحضور',
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 👋\nPetit rappel : vous êtes invités {{3}} : {{2}}.\n📅 {{4}}\nNous n’avons pas encore votre réponse — un clic sur le bouton ci-dessous suffit 👇',
    button: 'Répondre',
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 👋\nTe recordamos que tienes una invitación {{3}} de {{2}}.\n📅 {{4}}\nAún no hemos recibido tu respuesta: confírmala con el botón de abajo 👇',
    button: 'Confirmar',
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 👋\nማስታወሻ፦ ግብዣ {{3}}፦ {{2}}።\n📅 {{4}}\nእስካሁን ምላሽዎ አልደረሰንም — ከታች ያለውን ቁልፍ በመጫን ያረጋግጡ 👇',
    button: 'ምላሽ ይስጡ',
    footer: 'በBadook የተላከ',
  },
};

/**
 * The reminder before the event (badook_event_reminder, docs/whatsapp-setup.md §12) to the guests who
 * are coming: {{1}} guest · {{2}} hosts · {{3}} the event with its preposition · {{4}} when and where
 * ("יום שלישי, 17 בנובמבר · 19:30 · גן האירועים"); the button opens the way there (/e/<slug>/way:
 * Waze, Google Maps, the calendar). Says no "today", so it fits the day itself and the days before it.
 */
export const EVENT_TEMPLATE_TEXT: Record<Locale, TemplateText> = {
  he: {
    body: 'שלום {{1}} 🎉\n{{2}} מחכים לראות אותך {{3}}!\n📅 {{4}}\nהדרך לאירוע, עם ניווט ב-Waze או ב-Google Maps, בכפתור 👇',
    button: 'ניווט לאירוע',
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 🎉\nYou’re invited {{3}} — {{2}} can’t wait to see you!\n📅 {{4}}\nTap the button for the way there, with Waze or Google Maps 👇',
    button: 'Directions',
    footer: 'Sent with Badook',
  },
  ru: {
    body: 'Здравствуйте, {{1}}! 🎉\nЖдём вас {{3}}: {{2}}.\n📅 {{4}}\nМаршрут (Waze или Google Maps) — по кнопке ниже 👇',
    button: 'Маршрут',
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 🎉\nيتطلّع {{2}} لرؤيتكم {{3}}!\n📅 {{4}}\nللطريق إلى الحفل عبر Waze أو Google Maps اضغطوا على الزر 👇',
    button: 'الطريق إلى الحفل',
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 🎉\nOn vous attend {{3}} : {{2}}.\n📅 {{4}}\nL’itinéraire (Waze ou Google Maps), c’est par le bouton ci-dessous 👇',
    button: 'Itinéraire',
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 🎉\nTe esperamos {{3}} de {{2}}.\n📅 {{4}}\nToca el botón para ver cómo llegar con Waze o Google Maps 👇',
    button: 'Cómo llegar',
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 🎉\nእንጠብቅዎታለን {{3}}፦ {{2}}።\n📅 {{4}}\nአቅጣጫ (Waze ወይም Google Maps) ከታች ባለው ቁልፍ 👇',
    button: 'አቅጣጫ',
    footer: 'በBadook የተላከ',
  },
};

/**
 * The thank-you after the event without an album (badook_thanks, docs/whatsapp-setup.md §13): the
 * album thank-you's values — {{1}} guest · {{2}} where they celebrated (album/phrases.ts) · {{3}}
 * hosts — and no button.
 */
export const THANKS_TEMPLATE_TEXT: Record<Locale, TemplateText> = {
  he: {
    body: 'היי {{1}} 💛\nתודה שחגגתם איתנו {{2}}!\nהיה מרגש לחגוג יחד, ושמחנו מאוד שהייתם חלק מהיום הזה.\nבאהבה, {{3}}',
    button: null,
    footer: 'נשלח באמצעות Badook',
  },
  en: {
    body: 'Hi {{1}} 💛\nThank you for celebrating with us {{2}}!\nIt was so special to celebrate together, and we’re so glad you were part of the day.\nWith love, {{3}}',
    button: null,
    footer: 'Sent with Badook',
  },
  ru: {
    body: 'Здравствуйте, {{1}}! 💛\nСпасибо, что праздновали вместе с нами {{2}}!\nМы очень рады, что вы были с нами в этот день.\nС любовью, {{3}}',
    button: null,
    footer: 'Отправлено через Badook',
  },
  ar: {
    body: 'مرحبًا {{1}} 💛\nشكرًا لأنكم احتفلتم معنا {{2}}!\nسعدنا جدًا بوجودكم معنا في هذا اليوم.\nمع الحب، {{3}}',
    button: null,
    footer: 'أُرسلت عبر Badook',
  },
  fr: {
    body: 'Bonjour {{1}} 💛\nMerci d’avoir fêté avec nous {{2}} !\nNous sommes si heureux que vous ayez partagé cette journée avec nous.\nAvec amour, {{3}}',
    button: null,
    footer: 'Envoyé via Badook',
  },
  es: {
    body: '¡Hola, {{1}}! 💛\n¡Gracias por celebrar con nosotros {{2}}!\nNos alegró muchísimo compartir este día contigo.\nCon cariño, {{3}}',
    button: null,
    footer: 'Enviado con Badook',
  },
  am: {
    body: 'ሰላም {{1}} 💛\nከእኛ ጋር {{2}} ስላከበሩ እናመሰግናለን!\nይህን ቀን ከእኛ ጋር ስላሳለፉ በጣም ደስ ብሎናል።\nበፍቅር፣ {{3}}',
    button: null,
    footer: 'በBadook የተላከ',
  },
};

/**
 * The alert to a host whose scheduled send didn't go out (badook_host_alert, docs/whatsapp-setup.md §14;
 * features/scheduler): {{1}} what it was · {{2}} when it was for, on the clock the host picked, with
 * that zone's city · {{3}} why. The button opens the invitation's gallery tab, where its dialog sends it
 * again (URL https://<site>/app/invitations/{{1}}: the suffix is "<id>/gallery"). Hebrew and English —
 * the host's language.
 */
export const HOST_ALERT_TEMPLATE_TEXT: Record<'he' | 'en', TemplateText> = {
  he: {
    body: '⚠️ השליחה המתוזמנת לא יצאה\n{{1}} שתוזמן ל־{{2}} לא נשלח לאורחים: {{3}}.\nאף אורח לא קיבל הודעה ולא ירדו קרדיטים. אפשר לשלוח שוב בכפתור למטה.',
    button: 'לשליחה מחדש',
    footer: 'הודעת מערכת מ־Badook',
  },
  en: {
    body: '⚠️ Your scheduled send didn’t go out\n{{1}} scheduled for {{2}} wasn’t sent to your guests: {{3}}.\nNo guest got a message and no credits were used. Tap the button below to send it again.',
    button: 'Send it again',
    footer: 'A system message from Badook',
  },
};
