import {
  Baby,
  Bus,
  Cake,
  CalendarPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Citrus,
  Clock,
  Copy,
  Footprints,
  Gift,
  Heart,
  Languages,
  MapPin,
  Martini,
  Minus,
  Music,
  Navigation,
  PartyPopper,
  Plane,
  Plus,
  ScrollText,
  Send,
  Smile,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wine,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { TimelineIcon } from '../contracts/types';
import { CUSTOM_ICON_PATHS, CustomIcon, type CustomIconName } from './custom-icons';
import { ORNAMENT_PATHS, type OrnamentIconName } from './ornament-icons';

const LUCIDE = {
  baby: Baby,
  bus: Bus,
  cake: Cake,
  'calendar-plus': CalendarPlus,
  camera: Camera,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-check-big': CircleCheckBig,
  citrus: Citrus,
  clock: Clock,
  copy: Copy,
  footprints: Footprints,
  gift: Gift,
  heart: Heart,
  languages: Languages,
  'map-pin': MapPin,
  martini: Martini,
  minus: Minus,
  music: Music,
  navigation: Navigation,
  'party-popper': PartyPopper,
  plane: Plane,
  plus: Plus,
  'scroll-text': ScrollText,
  send: Send,
  smile: Smile,
  sparkles: Sparkles,
  star: Star,
  users: Users,
  'utensils-crossed': UtensilsCrossed,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  wine: Wine,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof LUCIDE | CustomIconName | OrnamentIconName;

/** Directional icons are mirrored in RTL (§8); pins, clocks, hearts… never are. */
const DIRECTIONAL = new Set<IconName>(['navigation', 'send', 'chevron-left', 'chevron-right']);

/** §9A.5 TimelineIcon → icon. */
export const TIMELINE_ICON: Record<TimelineIcon, IconName> = {
  glass: 'wine',
  chuppah: 'chuppah',
  rings: 'rings',
  heart: 'heart',
  walk: 'footprints',
  dinner: 'utensils-crossed',
  music: 'music',
  party: 'party-popper',
  cake: 'cake',
  camera: 'camera',
  bus: 'bus',
  toast: 'toast',
  star: 'star',
  gift: 'gift',
  baby: 'baby',
  torah: 'scroll-text',
};

interface IconProps {
  name: IconName;
  size?: number;
  /** 1.5 on invitations (§9A.5) */
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 20, strokeWidth = 1.5, className }: IconProps) {
  const cls = ['ic', DIRECTIONAL.has(name) ? 'dir' : '', className ?? ''].filter(Boolean).join(' ');
  if (name in CUSTOM_ICON_PATHS) {
    return <CustomIcon name={name as CustomIconName} size={size} strokeWidth={strokeWidth} className={cls} />;
  }
  if (name in ORNAMENT_PATHS) {
    return <Ornament name={name as OrnamentIconName} size={size} strokeWidth={strokeWidth} className={cls} />;
  }
  const Lucide = LUCIDE[name as keyof typeof LUCIDE];
  return <Lucide size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" />;
}

/** A scene template's ornament (ornament-icons.ts): line art, dots filled. */
function Ornament({
  name,
  size,
  strokeWidth,
  className,
}: {
  name: OrnamentIconName;
  size: number;
  strokeWidth: number;
  className: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ORNAMENT_PATHS[name].map((p, i) =>
        typeof p === 'string' ? (
          <path key={i} d={p} />
        ) : 'circle' in p ? (
          <circle key={i} {...p.circle} />
        ) : (
          <circle key={i} {...p.dot} fill="currentColor" stroke="none" />
        ),
      )}
    </svg>
  );
}
