import { Home, LayoutGrid, LogIn, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button, StatusPage } from '@/components/app';
import { LostLetterArt } from '@/features/invitations/app/status-art';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser } from '@/lib/supabase/session';

/**
 * "Not found" for the site and the host app (an unknown invitation id on its editor, guests, RSVPs or
 * share page, and every other notFound()): in the visitor's UI language, with the way back — their
 * invitations when signed in, the home page and sign-in otherwise.
 */
export default async function SiteNotFound() {
  const [{ t }, user] = await Promise.all([getUi(), getSessionUser().catch(() => null)]);
  const e = t.errorPages.notFound;
  return (
    <StatusPage
      brand={t.brand}
      homeHref={user ? '/app/invitations' : '/'}
      illustration={<LostLetterArt />}
      code={e.code}
      title={e.title}
      description={e.body}
      actions={
        user ? (
          <>
            <Button size="lg" icon={<LayoutGrid />} asChild>
              <Link href="/app/invitations">{e.toInvitations}</Link>
            </Button>
            <Button size="lg" variant="secondary" icon={<Plus />} asChild>
              <Link href="/app/invitations/new">{e.newInvitation}</Link>
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" icon={<Home />} asChild>
              <Link href="/">{e.home}</Link>
            </Button>
            <Button size="lg" variant="secondary" icon={<LogIn className="icon-dir" />} asChild>
              <Link href="/login">{e.login}</Link>
            </Button>
          </>
        )
      }
    />
  );
}
