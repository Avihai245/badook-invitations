import type { Locale } from '@/features/invitations/contracts/types';

/**
 * The message a host sends a guest the gallery link with — from their own WhatsApp (wa.me, "send from
 * my WhatsApp") or copied to send any other way — in the guest's language: {name}, {hosts}, {url}
 * (their own gallery link, opening in that language). It says what the gallery's Meta template says
 * in that language (docs/whatsapp-setup.md §9, whatsapp/template-text.ts), with the link in the text.
 */
export const GALLERY_MESSAGE: Record<Locale, string> = {
  he: 'היי {name} 📸\nהגלריה של האירוע של {hosts} פתוחה: אפשר להעלות כאן את התמונות והסרטונים שצילמתם, ולראות את של כולם:\n{url}',
  en: 'Hi {name} 📸\nThe gallery of {hosts}’s event is open: upload the photos and videos you took here, and see everyone’s:\n{url}',
  ru: 'Здравствуйте, {name}! 📸\nГалерея праздника «{hosts}» открыта: загрузите сюда фото и видео, которые вы сняли, и посмотрите снимки всех гостей:\n{url}',
  ar: 'مرحبًا {name} 📸\nمعرض مناسبة {hosts} مفتوح الآن: ارفعوا هنا الصور والفيديوهات التي التقطتموها وشاهدوا صور الجميع:\n{url}',
  fr: 'Bonjour {name} 📸\nLa galerie de l’événement de {hosts} est ouverte : envoyez ici les photos et vidéos que vous avez prises, et découvrez celles de tout le monde :\n{url}',
  es: '¡Hola, {name}! 📸\nLa galería de la celebración de {hosts} ya está abierta: sube aquí las fotos y vídeos que hiciste y mira los de todos:\n{url}',
  am: 'ሰላም {name} 📸\nየ{hosts} ዝግጅት የፎቶ ማዕከል ተከፍቷል፦ ያነሷቸውን ፎቶዎችና ቪዲዮዎች እዚህ ይስቀሉ፤ የሁሉንም ይመልከቱ፦\n{url}',
};

/**
 * A guest's own gallery link: the gallery's link for guests (`…/upload?t=<link>`) with their personal
 * link's token — their uploads carry their name — and their language when it isn't the invitation's
 * default, so the gallery opens in it.
 */
export function guestGalleryLink(
  link: string,
  guestToken: string,
  language: Locale,
  defaultLocale: Locale,
): string {
  return `${link}&g=${encodeURIComponent(guestToken)}${language !== defaultLocale ? `&lang=${language}` : ''}`;
}
