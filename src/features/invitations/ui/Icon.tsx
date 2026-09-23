import {
  Baby,
  Bus,
  Cake,
  CalendarPlus,
  Camera,
  Check,
  ChevronDown,
  CircleCheckBig,
  Clock,
  Footprints,
  Gift,
  Heart,
  Languages,
  MapPin,
  Minus,
  Music,
  Navigation,
  PartyPopper,
  Plus,
  ScrollText,
  Send,
  Smile,
  Star,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { TimelineIcon } from '../contracts/types';
import { CustomIcon, type CustomIconName } from './custom-icons';

const LUCIDE = {
  baby: Baby,
  bus: Bus,
  cake: Cake,
  'calendar-plus': CalendarPlus,
  camera: Camera,
  check: Check,
  'chevron-down': ChevronDown,
  'circle-check-big': CircleCheckBig,
  clock: Clock,
  footprints: Footprints,
  gift: Gift,
  heart: Heart,
  languages: Languages,
  'map-pin': MapPin,
  minus: Minus,
  music: Music,
  navigation: Navigation,
  'party-popper': PartyPopper,
  plus: Plus,
  'scroll-text': ScrollText,
  send: Send,
  smile: Smile,
  star: Star,
  users: Users,
  'utensils-crossed': UtensilsCrossed,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  wine: Wine,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof LUCIDE | CustomIconName;

/** Directional icons are mirrored in RTL (§8); pins, clocks, hearts… never are. */
const DIRECTIONAL = new Set<IconName>(['navigation', 'send']);

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
  if (name === 'chuppah' || name === 'rings' || name === 'toast') {
    return <CustomIcon name={name} size={size} strokeWidth={strokeWidth} className={cls} />;
  }
  const Lucide = LUCIDE[name];
  return <Lucide size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" />;
}
