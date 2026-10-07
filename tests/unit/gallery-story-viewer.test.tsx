// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '@/features/live-gallery/types';
import { GuestTextProvider } from '@/features/live-gallery/ui/guest-text';
import { StoriesTray } from '@/features/live-gallery/ui/guest/StoriesTray';
import { StoryViewer } from '@/features/live-gallery/ui/guest/StoryViewer';
import { groupStories, type Story } from '@/features/live-gallery/ui/guest/stories';
import { galleryGuestHe as H } from '@/lib/i18n/gallery-guest.he';

// The stories on the guests' page: the tray of circles, and the full-screen viewer — a bar per item that
// fills while it shows, tap back / on (the start side is the right in Hebrew), hold to pause, swipe
// down to close, then the next person; and "reduce motion" leaves the moving to the guest.

// jsdom has no PointerEvent: a mouse event with the pointer's fields is enough for the handlers
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
  }
}

let n = 0;
const item = (at: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id: `item-${++n}`,
  kind: 'image',
  thumb: `https://t/${n}.jpg`,
  display: `https://d/${n}.jpg`,
  video: null,
  width: 800,
  height: 600,
  durationMs: null,
  takenAt: null,
  at,
  name: null,
  by: null,
  ...over,
});

/** Dana: three items; Yoav: two; the hosts: one — newest first like the feed */
function stories(): Story[] {
  const feed = [
    item('2026-10-03T18:50:00Z', { by: 'bbbb', name: 'יואב' }),
    item('2026-10-03T18:40:00Z', { by: 'bbbb', name: 'יואב' }),
    item('2026-10-03T18:30:00Z', { by: 'aaaa', name: 'דנה' }),
    item('2026-10-03T18:20:00Z', { by: 'aaaa', name: 'דנה' }),
    item('2026-10-03T18:10:00Z', { by: 'aaaa', name: 'דנה' }),
    item('2026-10-03T18:00:00Z', { by: 'host' }),
  ];
  return groupStories(feed);
}
const nameOf = (s: Story) => (s.host ? H.stories.host : (s.name ?? H.stories.anonymous.replace('{n}', '1')));

const STAGE_WIDTH = 300;
beforeEach(() => {
  window.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, right: STAGE_WIDTH, width: STAGE_WIDTH, top: 0, bottom: 600, height: 600 }) as DOMRect;
  vi.stubGlobal(
    'Image',
    class {
      src = '';
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Mounted {
  onClose: ReturnType<typeof vi.fn>;
  onWatched: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  all: Story[];
}
function mount(
  opts: { startKey?: string; suspended?: boolean; own?: string[]; reduce?: boolean } = {},
): Mounted {
  if (opts.reduce)
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  const all = stories();
  const onClose = vi.fn();
  const onWatched = vi.fn();
  const onDelete = vi.fn();
  render(
    <GuestTextProvider locale="he">
      <StoryViewer
        stories={all}
        startKey={opts.startKey ?? 'n:דנה'}
        nameOf={nameOf}
        onClose={onClose}
        onWatched={onWatched}
        canDelete={(i) => (opts.own ?? []).includes(i.id)}
        onDelete={onDelete}
        suspended={opts.suspended}
      />
    </GuestTextProvider>,
  );
  return { onClose, onWatched, onDelete, all };
}

const viewer = () => screen.getByTestId('story-viewer');
const segments = () =>
  within(screen.getByTestId('story-progress'))
    .getAllByText('', { selector: 'span[data-state]' })
    .map((e) => e.getAttribute('data-state'));
const shownImage = () =>
  Array.from(viewer().querySelectorAll('img'))
    .map((i) => i.getAttribute('src'))
    .filter((s) => s?.startsWith('https://d/'))[0];
const pointer = (type: string, init: { x: number; y: number; id?: number }) =>
  fireEvent(
    viewer(),
    new FakePointerEvent(type, { clientX: init.x, clientY: init.y, pointerId: init.id ?? 1, bubbles: true }),
  );
const tap = (x: number) => {
  pointer('pointerdown', { x, y: 300 });
  pointer('pointerup', { x, y: 300 });
};

describe('the viewer', () => {
  it('is a dialog for one person: their name, a bar per item, the first one playing', () => {
    mount();
    const dialog = screen.getByRole('dialog', { name: 'הסטורי של דנה' });
    expect(within(dialog).getByText('דנה')).toBeTruthy();
    expect(segments()).toEqual(['active', 'todo', 'todo']);
    // the oldest first
    expect(shownImage()).toMatch(/^https:\/\/d\//);
    expect(screen.getByText('פריט 1 מתוך 3')).toBeTruthy();
  });

  it('goes on when a photo’s bar has filled, and fills the ones behind', () => {
    mount();
    // the photo must have shown before its time starts: it loads, then the bar runs
    const first = shownImage();
    fireEvent.load(viewer().querySelector('img[src^="https://d/"]')!);
    expect(screen.getByTestId('story-fill').style.animationPlayState).toBe('running');
    fireEvent.animationEnd(screen.getByTestId('story-fill'));
    expect(segments()).toEqual(['done', 'active', 'todo']);
    expect(shownImage()).not.toBe(first);
    expect(screen.getByText('פריט 2 מתוך 3')).toBeTruthy();
  });

  it('waits while the photo is still loading, while it is held and while it is paused', () => {
    mount();
    const fill = () => screen.getByTestId('story-fill');
    // not loaded yet: the bar is not running
    expect(fill().style.animationPlayState).toBe('paused');
    fireEvent.load(viewer().querySelector('img[src^="https://d/"]')!);
    expect(fill().style.animationPlayState).toBe('running');
    // the pause button, and the button says so
    fireEvent.click(screen.getByRole('button', { name: H.stories.pause }));
    expect(fill().style.animationPlayState).toBe('paused');
    expect(screen.getByRole('button', { name: H.stories.play }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: H.stories.play }));
    expect(fill().style.animationPlayState).toBe('running');
  });

  it('holds still while the screen is held, and goes on when it is let go', () => {
    vi.useFakeTimers();
    try {
      mount();
      fireEvent.load(viewer().querySelector('img[src^="https://d/"]')!);
      pointer('pointerdown', { x: 150, y: 300 });
      act(() => void vi.advanceTimersByTime(300));
      expect(screen.getByTestId('story-fill').style.animationPlayState).toBe('paused');
      pointer('pointerup', { x: 150, y: 300 });
      // a hold is not a tap: it did not move on
      expect(segments()).toEqual(['active', 'todo', 'todo']);
      expect(screen.getByTestId('story-fill').style.animationPlayState).toBe('running');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits while something is on top of it (a confirmation)', () => {
    mount({ suspended: true });
    fireEvent.load(viewer().querySelector('img[src^="https://d/"]')!);
    expect(screen.getByTestId('story-fill').style.animationPlayState).toBe('paused');
  });

  it('tapping the end side goes on and the start side (the right, in Hebrew) goes back', () => {
    mount();
    tap(50); // the left: on
    expect(segments()).toEqual(['done', 'active', 'todo']);
    tap(280); // the right: back
    expect(segments()).toEqual(['active', 'todo', 'todo']);
    tap(150); // the middle: on
    expect(segments()).toEqual(['done', 'active', 'todo']);
  });

  it('goes on to the next person after the last item, and marks the story watched at the last item', () => {
    const m = mount();
    expect(m.onWatched).not.toHaveBeenCalled();
    tap(50);
    tap(50);
    expect(segments()).toEqual(['done', 'done', 'active']);
    expect(m.onWatched).toHaveBeenCalledTimes(1);
    expect(m.onWatched.mock.calls[0]![0]).toMatchObject({ key: 'n:דנה' });
    // the order when it opened was Yoav, Dana, the hosts: after Dana come the hosts, then it closes
    tap(50);
    expect(screen.getByRole('dialog', { name: 'הסטורי של המארחים' })).toBeTruthy();
    expect(m.onClose).not.toHaveBeenCalled();
    tap(50);
    expect(m.onClose).toHaveBeenCalledTimes(1);
  });

  it('plays the people in the order they stood in when it opened', () => {
    const m = mount({ startKey: 'n:יואב' });
    expect(screen.getByRole('dialog', { name: 'הסטורי של יואב' })).toBeTruthy();
    tap(50);
    tap(50); // Yoav's two done: Dana is next
    expect(screen.getByRole('dialog', { name: 'הסטורי של דנה' })).toBeTruthy();
    expect(segments()).toEqual(['active', 'todo', 'todo']);
    expect(m.onWatched).toHaveBeenCalledWith(expect.objectContaining({ key: 'n:יואב' }));
    // back at the first item of Dana goes to the person before her, from their start
    tap(280);
    expect(screen.getByRole('dialog', { name: 'הסטורי של יואב' })).toBeTruthy();
  });

  it('closes with a tap beside the story, a swipe down, Escape and the button', () => {
    const m = mount();
    pointer('pointerdown', { x: 150, y: 100 });
    pointer('pointermove', { x: 150, y: 260 });
    pointer('pointerup', { x: 150, y: 260 });
    expect(m.onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(m.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: H.stories.close }));
    expect(m.onClose).toHaveBeenCalledTimes(3);
    tap(-40); // the dark beside the story
    expect(m.onClose).toHaveBeenCalledTimes(4);
  });

  it('swipes sideways to another person, towards the reading direction’s end for the next', () => {
    mount({ startKey: 'n:יואב' });
    // Hebrew: the next person comes from the left, so a swipe to the right brings them
    pointer('pointerdown', { x: 100, y: 300 });
    pointer('pointermove', { x: 220, y: 305 });
    pointer('pointerup', { x: 220, y: 305 });
    expect(screen.getByRole('dialog', { name: 'הסטורי של דנה' })).toBeTruthy();
    // and back
    pointer('pointerdown', { x: 220, y: 300 });
    pointer('pointermove', { x: 100, y: 305 });
    pointer('pointerup', { x: 100, y: 305 });
    expect(screen.getByRole('dialog', { name: 'הסטורי של יואב' })).toBeTruthy();
  });

  it('answers the arrow keys the way the page reads, and Space pauses', () => {
    mount();
    fireEvent.keyDown(window, { key: 'ArrowLeft' }); // Hebrew: left is on
    expect(segments()).toEqual(['done', 'active', 'todo']);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(segments()).toEqual(['active', 'todo', 'todo']);
    fireEvent.load(viewer().querySelector('img[src^="https://d/"]')!);
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByTestId('story-fill').style.animationPlayState).toBe('paused');
  });

  it('offers deleting only the guest’s own, and asks the page to', () => {
    const all = stories();
    const own = all.find((s) => s.name === 'דנה')!.items[0]!;
    const onDelete = vi.fn();
    render(
      <GuestTextProvider locale="he">
        <StoryViewer
          stories={all}
          startKey="n:דנה"
          nameOf={nameOf}
          onClose={() => undefined}
          onWatched={() => undefined}
          canDelete={(i) => i.id === own.id}
          onDelete={onDelete}
        />
      </GuestTextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: H.mine.delete }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: own.id }));
    // the next item is not theirs
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.queryByRole('button', { name: H.mine.delete })).toBeNull();
  });

  it('mutes a video until asked, and its bar follows the video', () => {
    const video = item('2026-10-03T18:00:00Z', {
      by: 'aaaa',
      name: 'דנה',
      kind: 'video',
      video: 'https://v/1.mp4',
    });
    const all = groupStories([video]);
    render(
      <GuestTextProvider locale="he">
        <StoryViewer
          stories={all}
          startKey="n:דנה"
          nameOf={nameOf}
          onClose={() => undefined}
          onWatched={() => undefined}
        />
      </GuestTextProvider>,
    );
    const el = viewer().querySelector('video')!;
    expect(el.muted).toBe(true);
    expect(el.hasAttribute('controls')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: H.stories.sound }));
    expect(viewer().querySelector('video')!.muted).toBe(false);
    expect(screen.getByRole('button', { name: H.stories.mute })).toBeTruthy();
    // no timer bar for a video: it plays to its end
    expect(screen.queryByTestId('story-fill')).toBeNull();
  });

  it('with "reduce motion" nothing moves by itself: no timer, no pause button, the next is a tap away', () => {
    mount({ reduce: true });
    expect(screen.queryByTestId('story-fill')).toBeNull();
    expect(screen.queryByRole('button', { name: H.stories.pause })).toBeNull();
    expect(segments()).toEqual(['active', 'todo', 'todo']);
    tap(50);
    expect(segments()).toEqual(['done', 'active', 'todo']);
  });

  it('leaves the page where it was, and gives the focus back', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    document.body.style.overflow = 'auto';
    const { unmount } = render(
      <GuestTextProvider locale="he">
        <StoryViewer
          stories={stories()}
          startKey="n:דנה"
          nameOf={nameOf}
          onClose={() => undefined}
          onWatched={() => undefined}
        />
      </GuestTextProvider>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: H.stories.close }));
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('the tray', () => {
  const mountTray = (seen: Record<string, string> = {}, onAdd?: () => void, all: Story[] = stories()) => {
    const onOpen = vi.fn();
    render(
      <GuestTextProvider locale="he">
        <StoriesTray stories={all} seen={seen} nameOf={nameOf} onOpen={onOpen} onAdd={onAdd} />
      </GuestTextProvider>,
    );
    return onOpen;
  };

  it('has a circle for each person, newest first, saying how many items and that it is new', () => {
    mountTray();
    const circles = within(screen.getByTestId('gallery-stories')).getAllByRole('button');
    expect(circles.map((c) => c.getAttribute('aria-label'))).toEqual([
      'צפייה בסטורי של יואב: 2 פריטים, חדש',
      'צפייה בסטורי של דנה: 3 פריטים, חדש',
      'צפייה בסטורי של המארחים: פריט אחד, חדש',
    ]);
    expect(screen.getByText(H.stories.hint)).toBeTruthy();
  });

  it('opens a person’s story, and shows the ones already watched as watched', () => {
    const all = stories();
    const dana = all.find((s) => s.name === 'דנה')!;
    const onOpen = mountTray({ [dana.key]: dana.newestId }, undefined, all);
    const danaCircle = screen.getByRole('button', { name: /דנה/ });
    expect(danaCircle.hasAttribute('data-unseen')).toBe(false);
    expect(danaCircle.getAttribute('aria-label')).not.toContain(H.stories.newLabel);
    expect(screen.getByRole('button', { name: /יואב/ }).hasAttribute('data-unseen')).toBe(true);
    fireEvent.click(danaCircle);
    expect(onOpen).toHaveBeenCalledWith('n:דנה');
  });

  it('has "your story" with a "+" to add to it when the gallery takes uploads', () => {
    const onAdd = vi.fn();
    mountTray({}, onAdd);
    expect(screen.getByText(H.stories.yours)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `${H.stories.yours}: ${H.stories.addLabel}` }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('has no "+" when it does not', () => {
    mountTray();
    expect(screen.queryByRole('button', { name: new RegExp(H.stories.addLabel) })).toBeNull();
  });
});
