import { CircleAlert } from 'lucide-react';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { GALLERY_GUEST } from '@/lib/i18n/gallery-guest';

/** A gallery link that opens nothing (wrong, or replaced by a new one): say so kindly. */
export function GalleryUnavailable({ locale, projector = false }: { locale: Locale; projector?: boolean }) {
  const t = GALLERY_GUEST[locale];
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  if (projector)
    return (
      <div
        className="fixed inset-0 grid place-items-center bg-black p-8 text-center text-white"
        lang={locale}
        dir={dir}
      >
        <p className="max-w-[40ch] text-[3vmin]">{t.projector.invalid}</p>
      </div>
    );
  return (
    <main className="mx-auto grid min-h-svh max-w-[520px] place-items-center px-4" lang={locale} dir={dir}>
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
