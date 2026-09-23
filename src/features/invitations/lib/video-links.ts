/**
 * YouTube / Vimeo links as a hero background (§7.5): what a host pastes → the canonical link stored
 * in the document (`media.src`, an https AssetRef) → the embed the invitation plays (muted, looping,
 * no controls) and a still for the first paint and the link preview.
 */
export type VideoLink =
  | { provider: 'youtube'; id: string; vertical: boolean } // vertical: a Short (9:16)
  | { provider: 'vimeo'; id: string; hash: string | null };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

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

  if (host === 'youtu.be') return youtube(parts[0]);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') return youtube(url.searchParams.get('v'));
    if (parts[0] === 'shorts') return youtube(parts[1], true);
    if (['embed', 'live', 'v'].includes(parts[0] ?? '')) return youtube(parts[1]);
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/<id>[/<hash>] · vimeo.com/channels/<name>/<id> · player.vimeo.com/video/<id>?h=<hash>
    const at = parts.findIndex((p) => /^\d+$/.test(p));
    if (at < 0) return null;
    const next = parts[at + 1];
    const hash = url.searchParams.get('h') ?? (next && /^[0-9a-f]+$/i.test(next) ? next : null);
    return { provider: 'vimeo', id: parts[at]!, hash };
  }
  return null;
}

function youtube(id: string | null | undefined, vertical = false): VideoLink | null {
  return id && YOUTUBE_ID.test(id) ? { provider: 'youtube', id, vertical } : null;
}

/** The link stored in the document (one form per video, whatever was pasted). */
export function canonicalVideoLink(v: VideoLink): string {
  if (v.provider === 'vimeo') return `https://vimeo.com/${v.id}${v.hash ? `/${v.hash}` : ''}`;
  return v.vertical ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
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
  return `https://player.vimeo.com/video/${v.id}?${q.toString()}`;
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
