import 'server-only';
import { unstable_cache } from 'next/cache';
import { videoStillUrl, type VideoLink } from '@/features/invitations/lib/video-links';

/**
 * The home page's background still: YouTube's full-size frame when the video has one, else its
 * always-present smaller one — chosen on the server (checked once a day), so the browser asks for one
 * picture that exists instead of trying one that may answer 404 (a console error) and falling back.
 */
export const heroStill = (link: VideoLink): Promise<string | null> =>
  unstable_cache(
    async () => {
      const maxres = videoStillUrl(link, 'maxres');
      if (!maxres) return null;
      try {
        const res = await fetch(maxres, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
        return res.ok ? maxres : videoStillUrl(link, 'hq');
      } catch {
        // YouTube unreachable from here: an HD video (this one) has its full-size frame
        return maxres;
      }
    },
    ['site-hero-still', link.provider, link.id],
    { revalidate: 86_400 },
  )();
