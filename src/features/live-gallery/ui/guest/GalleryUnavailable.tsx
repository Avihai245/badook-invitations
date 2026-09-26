import { CircleAlert } from 'lucide-react';
import { galleryGuestEn } from '@/lib/i18n/gallery-guest.en';
import { galleryGuestHe } from '@/lib/i18n/gallery-guest.he';

/** A gallery link that opens nothing (wrong, or replaced by a new one): say so kindly. */
export function GalleryUnavailable({
  locale,
  projector = false,
}: {
  locale: 'he' | 'en';
  projector?: boolean;
}) {
  const t = locale === 'en' ? galleryGuestEn : galleryGuestHe;
  if (projector)
    return (
      <div
        className="fixed inset-0 grid place-items-center bg-black p-8 text-center text-white"
        lang={locale}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        <p className="max-w-[40ch] text-[3vmin]">{t.projector.invalid}</p>
      </div>
    );
  return (
    <main
      className="mx-auto grid min-h-svh max-w-[520px] place-items-center px-4"
      lang={locale}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="w-full rounded-[20px] border border-line bg-surface px-5 py-8 text-center shadow-sm">
        <span
          aria-hidden
          className="mx-auto grid size-12 place-items-center rounded-full bg-subtle text-muted"
        >
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-3 text-[20px] font-bold">{t.invalid.title}</h1>
        <p className="mt-1 text-[14px] text-muted">{t.invalid.body}</p>
      </div>
    </main>
  );
}
