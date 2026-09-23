import { describe, expect, it } from 'vitest';
import {
  canonicalVideoLink,
  parseVideoLink,
  videoEmbedUrl,
  videoStillUrl,
} from '../../src/features/invitations/lib/video-links';

describe('video links', () => {
  it('reads every common YouTube address', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ])
      expect(parseVideoLink(url), url).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ', vertical: false });
    expect(parseVideoLink('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
      vertical: true,
    });
  });

  it('reads Vimeo addresses, with the private-link hash', () => {
    expect(parseVideoLink('https://vimeo.com/76979871')).toEqual({
      provider: 'vimeo',
      id: '76979871',
      hash: null,
    });
    expect(parseVideoLink('https://vimeo.com/76979871/8272103f6e')).toEqual({
      provider: 'vimeo',
      id: '76979871',
      hash: '8272103f6e',
    });
    expect(parseVideoLink('https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0')).toEqual({
      provider: 'vimeo',
      id: '76979871',
      hash: '8272103f6e',
    });
    expect(parseVideoLink('https://vimeo.com/channels/staffpicks/76979871')).toEqual({
      provider: 'vimeo',
      id: '76979871',
      hash: null,
    });
  });

  it('rejects anything else', () => {
    for (const url of [
      '',
      'not a link',
      'https://example.com/video.mp4',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/@channel',
      'https://vimeo.com/about',
      'javascript:alert(1)',
      'ftp://youtu.be/dQw4w9WgXcQ',
    ])
      expect(parseVideoLink(url), url).toBeNull();
  });

  it('stores one canonical link per video, which reads back the same', () => {
    for (const url of [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
      'https://player.vimeo.com/video/76979871?h=8272103f6e',
    ]) {
      const v = parseVideoLink(url)!;
      expect(parseVideoLink(canonicalVideoLink(v))).toEqual(v);
    }
    expect(canonicalVideoLink(parseVideoLink('youtu.be/dQw4w9WgXcQ')!)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it('embeds muted, looping, without controls; YouTube stills', () => {
    const yt = new URL(videoEmbedUrl(parseVideoLink('https://youtu.be/dQw4w9WgXcQ')!, 'https://x.test'));
    expect(yt.origin + yt.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(Object.fromEntries(yt.searchParams)).toMatchObject({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: 'dQw4w9WgXcQ',
      controls: '0',
      playsinline: '1',
      enablejsapi: '1',
      origin: 'https://x.test',
    });
    const vimeo = new URL(videoEmbedUrl(parseVideoLink('https://vimeo.com/76979871/8272103f6e')!));
    expect(vimeo.origin + vimeo.pathname).toBe('https://player.vimeo.com/video/76979871');
    expect(Object.fromEntries(vimeo.searchParams)).toMatchObject({
      h: '8272103f6e',
      background: '1',
      muted: '1',
    });
    expect(videoStillUrl(parseVideoLink('https://youtu.be/dQw4w9WgXcQ')!)).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(videoStillUrl(parseVideoLink('https://vimeo.com/76979871')!)).toBeNull();
  });

  it('subtitles are off unless the host turns them on; a start second for YouTube', () => {
    const yt = parseVideoLink('https://youtu.be/dQw4w9WgXcQ')!;
    const vimeo = parseVideoLink('https://vimeo.com/76979871')!;
    const params = (url: string) => Object.fromEntries(new URL(url).searchParams);
    expect(params(videoEmbedUrl(yt))).toMatchObject({ cc_load_policy: '0' });
    expect(params(videoEmbedUrl(yt, undefined, { captions: true }))).toMatchObject({ cc_load_policy: '1' });
    expect(params(videoEmbedUrl(vimeo))).toMatchObject({ texttrack: 'false' });
    expect(params(videoEmbedUrl(vimeo, undefined, { captions: true }))).not.toHaveProperty('texttrack');
    expect(params(videoEmbedUrl(yt, undefined, { start: 207 }))).toMatchObject({ start: '207' });
    expect(params(videoEmbedUrl(yt))).not.toHaveProperty('start');
  });
});
