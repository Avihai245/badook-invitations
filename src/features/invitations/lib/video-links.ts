/**
 * YouTube / Vimeo links as a hero background (§7.5): what a host pastes → the canonical link stored
 * in the document (`media.src`, an https AssetRef) → the embed the invitation plays (muted, looping,
 * no controls) and a still for the first paint and the link preview.
 */
export type VideoLink =
  // vertical: a Short (9:16); start: the second the host's link starts at (…?t=207), looped back to
  | { provider: 'youtube'; id: string; vertical: boolean; start?: number }
  | { provider: 'vimeo'; id: string; hash: string | null; start?: number };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** Twelve hours: anything later is a typo, not a start time. */
const MAX_START = 12 * 3600;

/** "207" · "207s" · "3m27s" · "1h2m3s" · "3:27" → seconds (null when it isn't a time, or is 0). */
export function parseStartTime(value: string | null | undefined): number | null {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return null;
  let seconds: number | null = null;
  const units = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (units && units.slice(1).some(Boolean))
    seconds = Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  const clock = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) seconds = Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  return seconds && seconds > 0 && seconds <= MAX_START ? seconds : null;
}

/** "3:27" / "1:02:03" — how the editor shows a start time. */
export function formatStartTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The start time in a pasted address: ?t= / ?start= (YouTube), #t= (YouTube and Vimeo). */
function startOf(url: URL): number | null {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return parseStartTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hash.get('t'));
}

/** A pasted YouTube or Vimeo address (watch, share, shorts, embed, player…) → the video, or null. */
export function parseVideoLink(input: string): VideoLink | null {
  let url: URL;
  try {
    const text = input.trim();
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  const start = startOf(url);
  if (host === 'youtu.be') return youtube(parts[0], false, start);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') return youtube(url.searchParams.get('v'), false, start);
    if (parts[0] === 'shorts') return youtube(parts[1], true, start);
    if (['embed', 'live', 'v'].includes(parts[0] ?? '')) return youtube(parts[1], false, start);
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/<id>[/<hash>] · vimeo.com/channels/<name>/<id> · player.vimeo.com/video/<id>?h=<hash>
    const at = parts.findIndex((p) => /^\d+$/.test(p));
    if (at < 0) return null;
    const next = parts[at + 1];
    const hash = url.searchParams.get('h') ?? (next && /^[0-9a-f]+$/i.test(next) ? next : null);
    return { provider: 'vimeo', id: parts[at]!, hash, ...(start ? { start } : {}) };
  }
  return null;
}

function youtube(id: string | null | undefined, vertical: boolean, start: number | null): VideoLink | null {
  return id && YOUTUBE_ID.test(id)
    ? { provider: 'youtube', id, vertical, ...(start ? { start } : {}) }
    : null;
}

/** The link stored in the document (one form per video and start time, whatever was pasted). */
export function canonicalVideoLink(v: VideoLink): string {
  if (v.provider === 'vimeo')
    return `https://vimeo.com/${v.id}${v.hash ? `/${v.hash}` : ''}${v.start ? `#t=${v.start}s` : ''}`;
  const base = v.vertical
    ? `https://www.youtube.com/shorts/${v.id}`
    : `https://www.youtube.com/watch?v=${v.id}`;
  return v.start ? `${base}${v.vertical ? '?' : '&'}t=${v.start}` : base;
}

/**
 * The background player: autoplaying muted (browsers allow no other autoplay), looping, no controls.
 * YouTube's `enablejsapi` (with the page's `origin`) and Vimeo's player API let the page turn the
 * sound on through postMessage — the host's "video sound" option.
 */
export function videoEmbedUrl(
  v: VideoLink,
  origin?: string,
  { captions = false, start }: { captions?: boolean; start?: number } = {},
): string {
  if (v.provider === 'youtube') {
    const q = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: v.id, // YouTube loops a single video only as a playlist of itself
      controls: '0',
      playsinline: '1',
      rel: '0',
      disablekb: '1',
      iv_load_policy: '3',
      // subtitles: forced on, or off as far as the URL can say (HeroEmbed also unloads the module —
      // a viewer whose YouTube account always shows them would otherwise still get them)
      cc_load_policy: captions ? '1' : '0',
      enablejsapi: '1',
      ...(start ? { start: String(Math.round(start)) } : {}),
      ...(origin ? { origin } : {}),
    });
    return `https://www.youtube-nocookie.com/embed/${v.id}?${q.toString()}`;
  }
  const q = new URLSearchParams({
    ...(v.hash ? { h: v.hash } : {}),
    background: '1',
    autoplay: '1',
    muted: '1',
    loop: '1',
    autopause: '0',
    dnt: '1',
    ...(captions ? {} : { texttrack: 'false' }),
  });
  // Vimeo takes the start time in the fragment
  return `https://player.vimeo.com/video/${v.id}?${q.toString()}${start ? `#t=${Math.round(start)}s` : ''}`;
}

/**
 * A still of the video (YouTube only — Vimeo's needs its API): `hq` always exists (4:3, letterboxed —
 * fine for the landscape link preview, which crops the bars away); `maxres` (16:9) exists for HD
 * uploads — the hero tries it first.
 */
export function videoStillUrl(v: VideoLink, size: 'hq' | 'maxres' = 'hq'): string | null {
  if (v.provider !== 'youtube') return null;
  return `https://i.ytimg.com/vi/${v.id}/${size === 'maxres' ? 'maxresdefault' : 'hqdefault'}.jpg`;
}
