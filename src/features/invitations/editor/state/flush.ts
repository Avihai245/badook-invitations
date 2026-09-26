'use client';

import { createContext, useContext } from 'react';

/**
 * Saves the editor's pending changes now (EditorShell's autosave) — for actions the server bases on
 * the stored draft (keeping a copy before a design concept, a restore). Resolves true once saved.
 */
export const FlushContext = createContext<() => Promise<boolean>>(async () => true);
export const useFlush = () => useContext(FlushContext);
