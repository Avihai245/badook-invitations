import { CircleAlert, Lock } from 'lucide-react';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';

/** An album link that opens nothing (wrong, replaced, or the album was closed): said kindly. */
export function AlbumUnavailable({ locale, off = false }: { locale: Locale; off?: boolean }) {
  const t = ALBUM_GUEST[locale];
  const text = off ? t.off : t.invalid;
  const Icon = off ? Lock : CircleAlert;
  return (
    <main
      className="mx-auto grid min-h-svh max-w-[520px] place-items-center px-4"
      lang={locale}
      dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'}
      data-testid="album-unavailable"
    >
      <div className="w-full rounded-[20px] border border-line bg-surface px-5 py-8 text-center shadow-sm">
        <span
          aria-hidden
          className="mx-auto grid size-12 place-items-center rounded-full bg-subtle text-muted"
        >
          <Icon className="size-6" />
        </span>
        <h1 className="mt-3 text-[20px] font-bold">{text.title}</h1>
        <p className="mt-1 text-[14px] text-muted">{text.body}</p>
      </div>
    </main>
  );
}
