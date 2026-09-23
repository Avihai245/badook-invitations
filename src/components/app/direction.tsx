'use client';

import { Direction } from 'radix-ui';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

export type Dir = 'ltr' | 'rtl';

const DirContext = createContext<Dir | undefined>(undefined);

/**
 * Declares the UI direction of a subtree — needed only for LTR/RTL islands (e.g. an English screen
 * rendered under `<html dir="rtl">`). In-flow primitives follow CSS `direction` on their own;
 * portalled ones (Drawer, Dialog, tooltips) leave the subtree, so they read the direction from here.
 * Also feeds Radix's DirectionProvider for any direction-aware Radix primitive.
 */
export function DirProvider({ dir, children }: { dir: Dir; children: ReactNode }) {
  return (
    <DirContext.Provider value={dir}>
      <Direction.Provider dir={dir}>{children}</Direction.Provider>
    </DirContext.Provider>
  );
}

// One MutationObserver on <html dir> shared by every useDir() subscriber.
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!observer) {
    observer = new MutationObserver(() => listeners.forEach((listener) => listener()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}
const getDocumentDir = (): Dir => (document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');
const getServerDir = (): Dir | undefined => undefined;

/**
 * Direction for portalled content: explicit prop → nearest `DirProvider` → `<html dir>` (client).
 * Returns `undefined` during SSR without a provider (portals never render on the server anyway).
 */
export function useDir(explicit?: Dir): Dir | undefined {
  const fromContext = useContext(DirContext);
  const fromDocument = useSyncExternalStore(subscribe, getDocumentDir, getServerDir);
  return explicit ?? fromContext ?? fromDocument;
}
