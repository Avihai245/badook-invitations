'use client';

import { createContext, useContext, type ReactNode } from 'react';

const Active = createContext(false);

/**
 * Whether version 2 of the legal documents is in force (legalStatus().active), for the host app's client
 * components: the app layout reads it on the server once and every collection notice below asks here.
 * False without a provider, so a screen rendered on its own (a test, a preview) shows nothing new.
 */
export function LegalNoticesProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <Active.Provider value={active}>{children}</Active.Provider>;
}

export function useLegalNotices(): boolean {
  return useContext(Active);
}
