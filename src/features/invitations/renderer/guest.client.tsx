'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * The guest behind a personal link (/i/<slug>?g=<token>). The page itself is static (ISR), so the
 * browser asks who the token belongs to, then the greeting shows their name and the RSVP form comes
 * prefilled — and the reply is linked to them. Kept for the visit (sessionStorage), so the live
 * language switch and a reload keep it.
 */
export interface GuestInfo {
  token: string;
  name: string;
  phone: string | null;
  partySize: number | null;
}

let current: GuestInfo | null = null;
const listeners = new Set<() => void>();

export function setGuest(guest: GuestInfo | null) {
  current = guest;
  for (const listener of listeners) listener();
}

export function useGuest(): GuestInfo | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => null,
  );
}

export const GUEST_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const storageKey = (slug: string) => `badook:guest:${slug}`;

function readStored(slug: string): GuestInfo | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey(slug)) ?? 'null') as GuestInfo | null;
    return value && typeof value.token === 'string' && typeof value.name === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** Mounted once on the live page: resolves ?g= (and counts the visit). */
export function GuestLink({ slug }: { slug: string }) {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('g');
    const stored = readStored(slug);
    if (!token || !GUEST_TOKEN.test(token)) {
      if (stored) setGuest(stored);
      return;
    }
    if (stored?.token === token) setGuest(stored);
    const ctrl = new AbortController();
    fetch('/api/invitations/guest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, token }),
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { guest?: Omit<GuestInfo, 'token'> } | null) => {
        if (!body?.guest) return;
        const guest: GuestInfo = { token, ...body.guest };
        setGuest(guest);
        try {
          window.sessionStorage.setItem(storageKey(slug), JSON.stringify(guest));
        } catch {
          // private mode: the greeting still shows for this page view
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [slug]);
  return null;
}

/**
 * The host's greeting line with the guest's name (`{guest}`): shown only when a guest is known — or,
 * in the editor, with a sample name so the host sees it.
 */
export function GuestGreeting({
  text,
  sample,
  editPath,
}: {
  text: string;
  sample?: string;
  editPath?: string;
}) {
  const guest = useGuest();
  const name = guest?.name ?? sample;
  if (!name || !text.trim()) return null;
  const at = text.indexOf('{guest}');
  const before = at >= 0 ? text.slice(0, at) : `${text} `;
  const after = at >= 0 ? text.slice(at + '{guest}'.length).replaceAll('{guest}', name) : '';
  return (
    <p className="hero-greeting" data-guest-greeting="" data-edit-path={editPath}>
      {before}
      <bdi data-guest-name="">{name}</bdi>
      {after}
    </p>
  );
}
