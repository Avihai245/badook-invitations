/** Addresses of an invitation's workspace (plain functions: pages on the server use them too). */

export type WorkspaceTab = 'overview' | 'guests' | 'responses' | 'seating' | 'share' | 'edit';

/** The tab a path is on (`/app/invitations/<id>/…`). */
export function workspaceTab(path: string, id: string): WorkspaceTab | null {
  const base = `/app/invitations/${id}`;
  if (path === base || path === `${base}/`) return 'overview';
  for (const tab of ['guests', 'responses', 'seating', 'share', 'edit'] as const)
    if (path === `${base}/${tab}` || path.startsWith(`${base}/${tab}/`)) return tab;
  return null;
}

/** Where "publish" goes: the editor, with its publish window open (EditorShell reads `?publish=1`). */
export const publishHref = (id: string) => `/app/invitations/${id}/edit?publish=1`;
