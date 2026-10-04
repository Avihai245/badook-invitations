import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CoreIcon, type CoreIconName } from '@/features/invitations/ui/core-icons';
import { Icon } from '@/features/invitations/ui/Icon';

const NAMES: CoreIconName[] = [
  'baby',
  'calendar-plus',
  'check',
  'chevron-down',
  'copy',
  'languages',
  'map-pin',
  'minus',
  'pause',
  'play',
  'plus',
  'send',
  'users',
  'volume-2',
  'volume-x',
];

// The invitation's eager client components draw with CoreIcon (a small set) instead of the whole registry:
// it must be the same picture, so nothing moves when one is swapped for the other.
describe('CoreIcon', () => {
  it.each(NAMES)('draws %s exactly as Icon does', (name) => {
    for (const props of [{}, { size: 14 }, { size: 18, strokeWidth: 2 }, { className: 'lang-chev' }]) {
      expect(renderToStaticMarkup(<CoreIcon name={name} {...props} />)).toBe(
        renderToStaticMarkup(<Icon name={name} {...props} />),
      );
    }
  });

  it('mirrors the directional ones in RTL (class "dir")', () => {
    expect(renderToStaticMarkup(<CoreIcon name="send" />)).toContain('ic dir');
    expect(renderToStaticMarkup(<CoreIcon name="check" />)).not.toContain('dir');
  });
});
