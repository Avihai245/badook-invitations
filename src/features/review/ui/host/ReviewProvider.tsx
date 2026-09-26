'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { hostApi, type ApiResponse } from '@/features/invitations/app/api';
import type { StudioAccess } from '@/features/invitations/editor/state/EditorProvider';
import { useEditor } from '@/features/invitations/editor/state/EditorProvider';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { useLiveRefresh, type LiveStatus } from '@/lib/live/client';
import { REVIEW } from '../../config';
import { pinsOf, type HostReview, type LabeledPin, type ReviewComment } from '../../model';

/**
 * The family's review in the host's editor (feature `draft_review`): the link and the comments, kept
 * live through the link's channel (the family's comments and replies, the host's other tabs), the
 * open ones per section for the rail, and the pins the preview draws. The drawer (ReviewDrawer) acts
 * through it.
 */

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Answer = HostReview & { ok: boolean; code?: string };

export interface ReviewContextValue {
  /** null: the feature isn't shown for this event */
  access: StudioAccess | null;
  review: HostReview | null;
  failed: boolean;
  /** turned off meanwhile (the settings, the plan) */
  refused: boolean;
  live: LiveStatus;
  openCount: number;
  openBySection: ReadonlyMap<string, number>;
  showPins: boolean;
  setShowPins: (on: boolean) => void;
  /** the comment being looked at (its pin stands out) */
  active: string | null;
  setActive: (id: string | null) => void;
  /** the drawer, and the comment it opens at */
  drawer: { focus: string | null } | null;
  openDrawer: (focus?: string | null) => void;
  closeDrawer: () => void;
  /** a call that answers with the whole review (the link's changes) */
  linkCall: (path: string, method: Method, body?: unknown) => Promise<boolean>;
  /** a call about one comment (answers with it) */
  commentCall: (commentId: string, path: string, method: Method, body?: unknown) => Promise<boolean>;
  /** the pins for the preview (null: none to draw) */
  previewPins: { pins: LabeledPin[]; label: string } | null;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

/** The review's state in the editor (null outside ReviewProvider, e.g. in tests of other screens). */
export const useReview = () => useContext(ReviewContext);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const { meta, features } = useEditor();
  const { t } = useUi();
  const r = t.studio.review;
  const access = features.draftReview ?? null;
  const [review, setReview] = useState<HostReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ focus: string | null } | null>(null);
  const base = `/api/invitations/${meta.id}/review`;

  const take = useCallback((res: ApiResponse<Answer>) => {
    if (res.ok && res.body?.ok) {
      const { link, comments, updatedAt, realtime } = res.body;
      setReview({ link, comments, updatedAt, realtime });
      setFailed(false);
      setRefused(false);
      return true;
    }
    if (res.status === 403) setRefused(true);
    return false;
  }, []);

  const inFlight = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++inFlight.current;
    const res = await hostApi<Answer>(base);
    // an older answer never overwrites a newer one
    if (n !== inFlight.current) return;
    if (!take(res) && res.status !== 403) setFailed(true);
  }, [base, take]);

  useEffect(() => {
    if (access === 'on') void refresh();
  }, [access, refresh]);

  // the family's comments as they come (the host's own saves on this channel change nothing here)
  const live = useLiveRefresh(
    access === 'on' && review?.link ? review.realtime : null,
    (kind) => {
      if (access === 'on' && kind !== 'draft') void refresh();
    },
    review?.link ? REVIEW.pollMs : 5 * 60_000,
  );

  const linkCall = useCallback(
    async (path: string, method: Method, body?: unknown) =>
      take(await hostApi<Answer>(`${base}${path}`, { method, body })),
    [base, take],
  );

  const commentCall = useCallback(
    async (commentId: string, path: string, method: Method, body?: unknown) => {
      const res = await hostApi<{ ok: boolean; comment?: ReviewComment }>(
        `${base}/comments/${commentId}${path}`,
        { method, body },
      );
      if (!res.ok || !res.body?.ok) {
        if (res.status === 403) setRefused(true);
        if (res.status === 404) void refresh();
        return false;
      }
      const updated = res.body.comment;
      setReview((prev) =>
        prev
          ? {
              ...prev,
              comments: updated
                ? prev.comments.map((c) => (c.id === updated.id ? updated : c))
                : prev.comments.filter((c) => c.id !== commentId),
            }
          : prev,
      );
      return true;
    },
    [base, refresh],
  );

  const comments = review?.comments;
  const openBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments ?? [])
      if (c.status === 'open') map.set(c.sectionId, (map.get(c.sectionId) ?? 0) + 1);
    return map;
  }, [comments]);
  const openCount = useMemo(() => (comments ?? []).filter((c) => c.status === 'open').length, [comments]);

  // the open comments, and the one looked at even when handled
  const previewPins = useMemo(() => {
    if (access !== 'on' || !showPins || !comments?.length) return null;
    const shown = comments.filter((c) => c.status === 'open' || c.id === active);
    if (!shown.length) return null;
    const byId = new Map(shown.map((c) => [c.id, c]));
    return {
      pins: pinsOf(shown, active).map((p) => ({
        ...p,
        label: fmt(r.pinLabel, { n: p.number, name: byId.get(p.id)?.name ?? '' }),
      })),
      label: r.pins,
    };
  }, [access, showPins, comments, active, r.pinLabel, r.pins]);

  const value = useMemo<ReviewContextValue>(
    () => ({
      access,
      review,
      failed,
      refused,
      live,
      openCount,
      openBySection,
      showPins,
      setShowPins,
      active,
      setActive,
      drawer,
      openDrawer: (focus = null) => {
        setDrawer({ focus });
        if (focus) setActive(focus);
        if (access === 'on') void refresh();
      },
      closeDrawer: () => setDrawer(null),
      linkCall,
      commentCall,
      previewPins,
    }),
    [
      access,
      review,
      failed,
      refused,
      live,
      openCount,
      openBySection,
      showPins,
      active,
      drawer,
      refresh,
      linkCall,
      commentCall,
      previewPins,
    ],
  );
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}
