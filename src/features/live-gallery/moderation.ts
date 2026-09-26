import { GALLERY, type MediaKind } from './config';

/**
 * Where a finished upload goes: the feed, the host's review queue ("waiting for approval"), or out
 * (rejected — the host still sees it and can bring it back). Decided on the server from the host's
 * mode, the browser's checks on the thumbnail (sharpness, darkness), a duplicate search and — when
 * the event has it — the automatic content check. Every threshold is in GALLERY.moderation.
 */

export type ItemStatus = 'uploading' | 'pending' | 'published' | 'hidden' | 'rejected';

/** Why an item is where it is (gallery_items.status_reason). */
export type Reason =
  | 'ok'
  | 'approval'
  | 'nsfw'
  | 'unsafe'
  | 'quality'
  | 'blurry'
  | 'dark'
  | 'duplicate'
  | 'unchecked'
  | 'no_preview'
  | 'host';

/** The automatic check's answer: its scores, a refusal to look, a failure, or not run (the day's ceiling). */
export type AiResult =
  | { status: 'ok'; nsfw: number; quality: number; reason: string }
  | { status: 'refused' }
  | { status: 'error'; error: string }
  | { status: 'skipped'; why: 'no_preview' | 'daily_limit' };

export interface ModerationInput {
  mode: 'instant' | 'approval';
  kind: MediaKind;
  /** the thumbnail and display version exist (a photo the phone couldn't open has none) */
  preview: boolean;
  /** the browser's checks on the thumbnail (photos) */
  metrics: { sharpness: number | null; brightness: number | null } | null;
  /** the closest perceptual-hash distance to another item of the gallery (null: nothing to compare) */
  nearest: number | null;
  /** null: the automatic check isn't on for this event */
  ai: AiResult | null;
}

/** One row of gallery_moderation. */
export interface CheckRecord {
  check: 'blur' | 'dark' | 'duplicate' | 'ai' | 'mode';
  result: 'pass' | 'flag' | 'error' | 'skipped' | 'pending' | 'published' | 'rejected';
  score: number | null;
  detail?: Record<string, unknown>;
  decidedBy: 'browser' | 'server' | 'ai';
}

export interface Decision {
  status: 'published' | 'pending' | 'rejected';
  reason: Reason;
  checks: CheckRecord[];
}

export type Thresholds = typeof GALLERY.moderation;

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

export function decide(input: ModerationInput, t: Thresholds = GALLERY.moderation): Decision {
  const checks: CheckRecord[] = [];
  const photo = input.kind === 'image';
  // the browser's checks: photos only (a video's first frame says little about the video)
  let quality: Reason | null = null;
  const sharpness = input.metrics?.sharpness;
  if (photo && finite(sharpness)) {
    const blurry = sharpness < t.blurHold;
    checks.push({ check: 'blur', result: blurry ? 'flag' : 'pass', score: sharpness, decidedBy: 'browser' });
    if (blurry) quality ??= 'blurry';
  }
  const brightness = input.metrics?.brightness;
  if (photo && finite(brightness)) {
    const dark = brightness < t.darkHold;
    checks.push({ check: 'dark', result: dark ? 'flag' : 'pass', score: brightness, decidedBy: 'browser' });
    if (dark) quality ??= 'dark';
  }
  let duplicate = false;
  if (photo && finite(input.nearest)) {
    duplicate = input.nearest <= t.duplicateDistance;
    checks.push({
      check: 'duplicate',
      result: duplicate ? 'flag' : 'pass',
      score: input.nearest,
      decidedBy: 'server',
    });
  }

  let unsafe = false;
  let aiHold: Reason | null = null;
  const ai = input.ai;
  if (ai) {
    if (ai.status === 'ok') {
      unsafe = ai.nsfw >= t.nsfwReject;
      const suspicious = !unsafe && ai.nsfw >= t.nsfwHold;
      if (suspicious) aiHold = 'nsfw';
      const poor = ai.quality < t.qualityHold;
      if (poor) quality ??= 'quality';
      checks.push({
        check: 'ai',
        result: unsafe || suspicious || poor ? 'flag' : 'pass',
        score: ai.nsfw,
        detail: { quality: ai.quality, reason: ai.reason },
        decidedBy: 'ai',
      });
    } else if (ai.status === 'refused') {
      // declining to look at a photo is a reason to let the host look first
      aiHold = 'nsfw';
      checks.push({ check: 'ai', result: 'flag', score: null, detail: { refused: true }, decidedBy: 'ai' });
    } else {
      if (t.aiUnavailable === 'hold') aiHold = 'unchecked';
      checks.push({
        check: 'ai',
        result: ai.status === 'error' ? 'error' : 'skipped',
        score: null,
        detail: ai.status === 'error' ? { error: ai.error.slice(0, 200) } : { why: ai.why },
        decidedBy: 'server',
      });
    }
  }

  const done = (status: Decision['status'], reason: Reason): Decision => {
    checks.push({
      check: 'mode',
      result: status,
      score: null,
      detail: { mode: input.mode, reason },
      decidedBy: 'server',
    });
    return { status, reason, checks };
  };
  if (unsafe) return done('rejected', 'unsafe');
  if (duplicate) return done('rejected', 'duplicate');
  if (aiHold) return done('pending', aiHold);
  // a photo nobody's phone could show: the host decides
  if (photo && !input.preview) return done('pending', 'no_preview');
  if (input.mode === 'approval') return done('pending', 'approval');
  if (quality) return done('pending', quality);
  return done('published', 'ok');
}
