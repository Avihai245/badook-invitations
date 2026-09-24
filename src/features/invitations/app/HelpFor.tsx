'use client';

import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Bell,
  ChartColumn,
  Check,
  Copy,
  CreditCard,
  Crown,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  GripVertical,
  History,
  KeyRound,
  Languages,
  ListChecks,
  ListFilter,
  MailPlus,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareText,
  MousePointerClick,
  Palette,
  PanelRightOpen,
  PencilLine,
  Plus,
  QrCode,
  Save,
  Search,
  Send,
  Settings2,
  Smartphone,
  ToggleRight,
  Trash2,
  Undo2,
  Users,
  WandSparkles,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react';
import { AreaHelp } from '@/components/app';
import type { AppDict } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';

type Help = AppDict['help'];
export type HelpArea = keyof Help;

const ICONS: { [A in HelpArea]: Record<keyof Help[A]['items'], LucideIcon> } = {
  list: {
    newInvitation: Plus,
    card: PencilLine,
    menu: Ellipsis,
    guests: Users,
    responses: ListChecks,
    duplicate: Copy,
    archive: Archive,
    followUp: MailPlus,
    status: BadgeCheck,
  },
  gallery: {
    filter: ListFilter,
    language: Languages,
    preview: Eye,
    premium: Crown,
    demo: ExternalLink,
    use: WandSparkles,
  },
  editor: {
    back: ArrowLeft,
    save: Check,
    undo: Undo2,
    device: Smartphone,
    language: Languages,
    versions: History,
    preview: Eye,
    publish: Send,
    assistant: MessageCircleQuestion,
  },
  rail: {
    select: MousePointerClick,
    drag: GripVertical,
    toggle: ToggleRight,
    add: Plus,
    issues: CircleAlert,
    menu: Ellipsis,
    design: Palette,
    settings: Settings2,
  },
  responses: {
    kpis: Users,
    notify: Bell,
    export: Download,
    search: Search,
    row: PanelRightOpen,
    charts: ChartColumn,
  },
  share: {
    open: ExternalLink,
    copyLink: Copy,
    message: MessageSquareText,
    whatsapp: MessageCircle,
    guests: Users,
    qr: QrCode,
    preview: Smartphone,
  },
  account: { save: Save, password: KeyRound, plan: CreditCard, delete: Trash2 },
};

/** The "?" of an area: what each of its buttons does (lib/i18n/help.*.ts), with the button's icon. */
export function HelpFor({ area, className }: { area: HelpArea; className?: string }) {
  const { t } = useUi();
  const help = t.help[area];
  const icons = ICONS[area] as Record<string, LucideIcon>;
  const items = Object.entries(help.items as Record<string, { label: string; text: string }>).map(
    ([key, item]) => {
      const Icon = icons[key];
      return { icon: Icon ? <Icon /> : undefined, label: item.label, text: item.text };
    },
  );
  return <AreaHelp label={t.common.helpLabel} title={help.title} items={items} className={className} />;
}
