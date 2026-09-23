import Link from 'next/link';
import { devRoutesEnabled } from '@/lib/dev-routes';

// Placeholder home until the host app lands (P1: auth, P2: /app/invitations).
export default function HomePage() {
  const dev = devRoutesEnabled();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[26px] font-bold tracking-tight">Badook · הזמנות דיגיטליות</h1>
      <p className="text-muted">בקרוב: הזמנות דיגיטליות עם אישורי הגעה — בעברית ובאנגלית.</p>
      {dev && (
        <nav className="mt-4 flex gap-3 text-[13px]">
          <Link
            className="rounded-full border border-line bg-surface px-4 py-2 shadow-sm"
            href="/dev/invitations"
          >
            Kitchen sink
          </Link>
          <Link className="rounded-full border border-line bg-surface px-4 py-2 shadow-sm" href="/dev/app-ui">
            App UI
          </Link>
        </nav>
      )}
    </main>
  );
}
