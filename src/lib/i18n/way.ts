import type { Locale } from '@/features/invitations/contracts/types';

/** The way to the event (/e/<slug>/way — the event reminder's button), in every invitation language. */
export const WAY_TEXT: Record<
  Locale,
  {
    title: string;
    waze: string;
    maps: string;
    calendar: string;
    invitation: string;
    noPlace: string;
    missing: string;
  }
> = {
  he: {
    title: 'הדרך לאירוע',
    waze: 'ניווט ב-Waze',
    maps: 'ניווט ב-Google Maps',
    calendar: 'הוספה ליומן',
    invitation: 'להזמנה',
    noPlace: 'המיקום המדויק נמצא בהזמנה.',
    missing: 'האירוע הזה לא נמצא.',
  },
  en: {
    title: 'The way to the event',
    waze: 'Navigate with Waze',
    maps: 'Navigate with Google Maps',
    calendar: 'Add to calendar',
    invitation: 'To the invitation',
    noPlace: 'The exact place is in the invitation.',
    missing: 'This event wasn’t found.',
  },
  ru: {
    title: 'Как добраться',
    waze: 'Маршрут в Waze',
    maps: 'Маршрут в Google Maps',
    calendar: 'Добавить в календарь',
    invitation: 'К приглашению',
    noPlace: 'Точное место указано в приглашении.',
    missing: 'Это мероприятие не найдено.',
  },
  ar: {
    title: 'الطريق إلى الحفل',
    waze: 'الملاحة عبر Waze',
    maps: 'الملاحة عبر Google Maps',
    calendar: 'إضافة إلى التقويم',
    invitation: 'إلى الدعوة',
    noPlace: 'المكان بالتفصيل موجود في الدعوة.',
    missing: 'لم يتم العثور على هذه المناسبة.',
  },
  fr: {
    title: 'Comment venir',
    waze: 'Itinéraire avec Waze',
    maps: 'Itinéraire avec Google Maps',
    calendar: 'Ajouter au calendrier',
    invitation: 'Voir l’invitation',
    noPlace: 'Le lieu exact figure dans l’invitation.',
    missing: 'Cet événement est introuvable.',
  },
  es: {
    title: 'Cómo llegar',
    waze: 'Navegar con Waze',
    maps: 'Navegar con Google Maps',
    calendar: 'Añadir al calendario',
    invitation: 'Ver la invitación',
    noPlace: 'El lugar exacto está en la invitación.',
    missing: 'No se encontró este evento.',
  },
  am: {
    title: 'ወደ ዝግጅቱ የሚወስደው መንገድ',
    waze: 'በWaze ይጓዙ',
    maps: 'በGoogle Maps ይጓዙ',
    calendar: 'ወደ ቀን መቁጠሪያ ያክሉ',
    invitation: 'ወደ ግብዣው',
    noPlace: 'ትክክለኛው ቦታ በግብዣው ላይ ይገኛል።',
    missing: 'ይህ ዝግጅት አልተገኘም።',
  },
};
