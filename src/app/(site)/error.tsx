'use client';

import { LayoutGrid, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { Button, StatusPage } from '@/components/app';
import { BrokenSealArt } from '@/features/invitations/app/status-art';
import { useUi } from '@/lib/i18n/client';

/**
 * "Something went wrong" for the site and the host app (a server error while loading a page): in the
 * UI language, with "try again" (the page's data is fetched anew), the way back to the invitations,
 * a contact link and the error's reference for support.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, fmt } = useUi();
  const e = t.errorPages.error;
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      brand={t.brand}
      homeHref="/app/invitations"
      illustration={<BrokenSealArt />}
      title={e.title}
      description={e.body}
      actions={
        <>
          <Button
            size="lg"
            icon={<RotateCcw />}
            loading={pending}
            onClick={() =>
              start(() => {
                router.refresh();
                reset();
              })
            }
          >
            {e.retry}
          </Button>
          <Button size="lg" variant="secondary" icon={<LayoutGrid />} asChild>
            <Link href="/app/invitations">{e.toInvitations}</Link>
          </Button>
        </>
      }
      footer={
        <>
          <Link href="/contact" className="font-semibold text-brand-deep underline-offset-2 hover:underline">
            {e.contact}
          </Link>
          {error.digest ? (
            <span className="mt-1 block" dir="auto">
              {fmt(e.code, { code: error.digest })}
            </span>
          ) : null}
        </>
      }
    />
  );
}
