import {
  Baby,
  Briefcase,
  Cake,
  CalendarHeart,
  Flower2,
  Gem,
  Gift,
  Heart,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { EventType } from '../contracts/types';

/** §9B.3-C: the event-type tiles' icons. */
export const EVENT_ICONS: Record<EventType, LucideIcon> = {
  wedding: Heart,
  engagement: Gem,
  henna: Flower2,
  bar_mitzvah: ScrollText,
  bat_mitzvah: ScrollText,
  brit: Baby,
  birthday: Cake,
  baby_shower: Gift,
  save_the_date: CalendarHeart,
  corporate: Briefcase,
  other: Sparkles,
};
