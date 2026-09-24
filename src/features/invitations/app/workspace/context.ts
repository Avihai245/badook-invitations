'use client';

import { createContext, useContext } from 'react';

/**
 * Set by an invitation's workspace layout (its header and tabs): the pages inside it don't draw their
 * own invitation header (InvitationNav).
 */
export const InWorkspace = createContext(false);

export const useInWorkspace = () => useContext(InWorkspace);
