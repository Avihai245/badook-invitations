'use client';

import { createContext, useContext } from 'react';

/**
 * Set by an invitation's workspace layout (its header and tabs): the pages inside it don't draw their
 * own invitation header (InvitationNav).
 */
export const InWorkspace = createContext(false);

export const useInWorkspace = () => useContext(InWorkspace);

/**
 * Opens the event's tools (invitations/lib/tools) from any of its screens: the sidebar's "add or
 * remove tools", the event home's "need something else?". A no-op outside an event's workspace.
 */
export const OpenTools = createContext<() => void>(() => undefined);

export const useOpenTools = () => useContext(OpenTools);
