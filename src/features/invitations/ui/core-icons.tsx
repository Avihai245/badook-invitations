import {
  Baby,
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  Languages,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Send,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icons of the invitation's own client components — the language pill and the music button, the RSVP
 * form, the copy and calendar buttons: a small set, so the page's first JavaScript doesn't carry the whole
 * registry (ui/Icon.tsx — the timeline's, the ornaments', the custom ones; ~12 KB) that the server-rendered
 * sections and the live language switch's chunk use. The same markup as `Icon` for these names
 * (tests/unit/core-icons.test.tsx keeps it so).
 */
const CORE = {
  baby: Baby,
  'calendar-plus': CalendarPlus,
  check: Check,
  'chevron-down': ChevronDown,
  copy: Copy,
  languages: Languages,
  'map-pin': MapPin,
  minus: Minus,
  pause: Pause,
  play: Play,
  plus: Plus,
  send: Send,
  users: Users,
  'volume-2': Volume2,
  'volume-x': VolumeX,
} satisfies Record<string, LucideIcon>;

export type CoreIconName = keyof typeof CORE;

/** Directional icons are mirrored in RTL (§8). */
const DIRECTIONAL = new Set<CoreIconName>(['send']);

export function CoreIcon({
  name,
  size = 20,
  strokeWidth = 1.5,
  className,
}: {
  name: CoreIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const cls = ['ic', DIRECTIONAL.has(name) ? 'dir' : '', className ?? ''].filter(Boolean).join(' ');
  const Lucide = CORE[name];
  return <Lucide size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" />;
}
