'use client';

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bell,
  Clapperboard,
  Columns2,
  Contrast,
  Crosshair,
  DoorOpen,
  Gauge,
  ImagePlus,
  Images,
  Layers,
  Maximize,
  MoveUp,
  MoveVertical,
  Pipette,
  RectangleVertical,
  Ruler,
  StretchVertical,
  Wind,
  CalendarClock,
  CalendarDays,
  CaseSensitive,
  ChartColumn,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  GripVertical,
  Hash,
  History,
  Image,
  KeyRound,
  Languages,
  LayoutDashboard,
  Link2,
  ListChecks,
  ListFilter,
  ListOrdered,
  Mail,
  MailPlus,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareText,
  MousePointerClick,
  Music,
  Palette,
  PanelBottom,
  PanelRightOpen,
  PencilLine,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ScanEye,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Stamp,
  Tags,
  ToggleRight,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  Upload,
  Users,
  Volume2,
  WandSparkles,
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
    card: MousePointerClick,
    quick: Users,
    nextStep: Sparkles,
    countdown: CalendarClock,
    menu: Ellipsis,
    guests: Users,
    responses: ListChecks,
    duplicate: Copy,
    archive: Archive,
    archiveView: ArchiveRestore,
    followUp: MailPlus,
    status: BadgeCheck,
  },
  overview: {
    tabs: LayoutDashboard,
    stats: ChartColumn,
    import: FileSpreadsheet,
    send: MessageCircle,
    steps: ListOrdered,
    link: Link2,
    publish: Send,
  },
  gallery: {
    filter: ListFilter,
    language: Languages,
    preview: Eye,
    premium: Crown,
    demo: ExternalLink,
    use: WandSparkles,
  },
  preview: {
    phone: Smartphone,
    language: Languages,
    palettes: Palette,
    fonts: CaseSensitive,
    demo: ExternalLink,
    use: WandSparkles,
  },
  wizard: {
    eventType: Sparkles,
    names: PencilLine,
    date: CalendarDays,
    timezone: Globe,
    languages: Languages,
    steps: ListOrdered,
    create: Check,
  },
  editor: {
    back: ArrowLeft,
    save: Check,
    undo: Undo2,
    device: Smartphone,
    language: Languages,
    replay: Play,
    openTab: ExternalLink,
    versions: History,
    preview: Eye,
    publish: Send,
    premium: Crown,
    mobileTabs: PanelBottom,
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
  designPalette: {
    presets: Palette,
    swatch: SlidersHorizontal,
    hex: Hash,
    contrast: ScanEye,
    reset: RotateCcw,
    fromPhoto: ImagePlus,
  },
  designFonts: { suggested: Sparkles, pairs: CaseSensitive, more: Plus, live: Eye },
  designStyle: { typeScale: Type, spacing: StretchVertical, motion: Wind, reset: RotateCcw },
  sectionMedia: {
    upload: Upload,
    library: Images,
    focal: Crosshair,
    overlay: Contrast,
    alt: MessageSquareText,
    remove: Trash2,
  },
  sectionLayout: {
    stack: RectangleVertical,
    full: Maximize,
    split: Columns2,
    parallax: Layers,
    video: Clapperboard,
    disabled: Ban,
  },
  sectionMotion: {
    entrance: MoveUp,
    play: Play,
    scroll: MoveVertical,
    text: Type,
    intensity: Gauge,
    fineTune: SlidersHorizontal,
    reset: RotateCcw,
  },
  sectionColors: {
    bands: Palette,
    custom: Pipette,
    contrast: ScanEye,
    fromPhoto: ImagePlus,
    size: Ruler,
    reset: RotateCcw,
  },
  designCover: {
    enabled: Mail,
    monogram: Type,
    seal: Stamp,
    hint: MousePointerClick,
    replay: Play,
    opening: DoorOpen,
  },
  designMusic: {
    enabled: Music,
    tracks: Play,
    custom: Upload,
    videoSound: Image,
    volume: Volume2,
    startAt: Clock,
  },
  settingsEvent: {
    type: Sparkles,
    names: PencilLine,
    joiner: Type,
    parents: Users,
    date: CalendarDays,
    timezone: Globe,
    hebrewDate: CalendarClock,
    timeFormat: Clock,
    deadline: ListChecks,
  },
  settingsLanguages: { add: Plus, remove: Trash2, default: Languages, tabs: Tags },
  settingsShare: { address: Link2, publishNow: Send, card: MessageSquareText, image: Image, noindex: Eye },
  publish: {
    slug: Link2,
    errors: CircleAlert,
    warnings: TriangleAlert,
    card: MessageCircle,
    publish: Send,
    after: CircleCheck,
  },
  versions: { version: History, live: BadgeCheck, view: ExternalLink, restore: RotateCcw, undo: Undo2 },
  responses: {
    kpis: Users,
    notify: Bell,
    export: Download,
    search: Search,
    chips: Tags,
    row: PanelRightOpen,
    charts: ChartColumn,
  },
  share: {
    open: ExternalLink,
    copyLink: Copy,
    message: MessageSquareText,
    whatsapp: MessageCircle,
    copyMessage: Copy,
    guests: Users,
    qr: QrCode,
    preview: Smartphone,
  },
  account: { save: Save, password: KeyRound, plan: CreditCard, delete: Trash2 },
};

/**
 * The "?" of an area: what each of its buttons does (lib/i18n/help.*.ts), with the button's icon.
 * `inDialog`: inside a modal dialog the card doesn't end with "ask the assistant" (the chat would
 * open behind the dialog).
 */
export function HelpFor({
  area,
  inDialog = false,
  className,
}: {
  area: HelpArea;
  inDialog?: boolean;
  className?: string;
}) {
  const { t } = useUi();
  const help = t.help[area];
  const icons = ICONS[area] as Record<string, LucideIcon>;
  const items = Object.entries(help.items as Record<string, { label: string; text: string }>).map(
    ([key, item]) => {
      const Icon = icons[key];
      return { icon: Icon ? <Icon /> : undefined, label: item.label, text: item.text };
    },
  );
  return (
    <AreaHelp
      label={t.common.helpLabel}
      title={help.title}
      items={items}
      footer={!inDialog}
      className={className}
    />
  );
}
