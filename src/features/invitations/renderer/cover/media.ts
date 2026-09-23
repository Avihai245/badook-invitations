import type { InvitationDocument, TemplateManifest } from '../../contracts/types';
import { resolveAsset, templateFileUrl, type AssetBases } from '../assets';

/** Resolved cover media (§2.2.1). null = not produced yet → the CSS fallback draws it. */
export interface CoverMedia {
  /** closed state, 9:16, no text baked in */
  poster: string | null;
  /** first frame == poster */
  video: string | null;
  /** landscape pair, used together or not at all */
  posterDesktop: string | null;
  videoDesktop: string | null;
  /** blank seal / medallion / tag PNG (no letters) */
  overlay: string | null;
}

/**
 * The video-first cover needs the poster and the opening video (a `renderer: 'css3d'` template never
 * plays one); the desktop pair only counts when both files exist, so the first frame always matches.
 */
export function coverMedia(template: Pick<TemplateManifest, 'id' | 'cover'>, bases: AssetBases): CoverMedia {
  const file = (path: string | null) => templateFileUrl(template.id, path, bases);
  const { cover } = template;
  const video = cover.renderer === 'video' ? file(cover.openVideo) : null;
  const poster = file(cover.poster);
  const posterDesktop = file(cover.posterDesktop);
  const videoDesktop = cover.renderer === 'video' ? file(cover.openVideoDesktop) : null;
  const desktop = poster && video && posterDesktop && videoDesktop;
  return {
    poster,
    video: poster ? video : null,
    posterDesktop: desktop ? posterDesktop : null,
    videoDesktop: desktop ? videoDesktop : null,
    overlay: file(cover.overlay.image),
  };
}

/** The music the invitation plays after the cover opens: the host's upload, else the template track. */
export function musicUrl(
  doc: Pick<InvitationDocument, 'music'>,
  template: Pick<TemplateManifest, 'id' | 'assets' | 'music'>,
  bases: AssetBases,
): string | null {
  const { music } = doc;
  if (!music.enabled) return null;
  if (music.customUrl) return resolveAsset(music.customUrl, template, bases);
  const track = template.music.tracks.find((t) => t.id === (music.trackId ?? template.music.defaultTrackId));
  return track ? templateFileUrl(template.id, track.url, bases) : null;
}
