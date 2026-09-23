'use client';

import {
  ArrowLeft,
  Bus,
  Camera,
  Check,
  CircleCheckBig,
  Clock,
  Copy as CopyIcon,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Gift,
  GripVertical,
  Heart,
  Image as ImageIcon,
  Layers,
  ListPlus,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Palette,
  Play,
  Plus,
  Redo2,
  Search,
  Send,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Badge,
  Bars,
  Button,
  Card,
  CardTitle,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  KpiCard,
  L10nTabs,
  PhoneFrame,
  Segmented,
  Select,
  Switch,
  SwatchGroup,
  Tabs,
  TabsPanel,
  Tag,
  Textarea,
  cn,
  useToast,
  type DataTableColumn,
} from '@/components/app';
import { COPY, type Copy, type Locale, type ResponseRow, type SectionItem } from './copy';
import { EnvelopeIllustration, InvitationMock, QrPlaceholder, WhatsAppBubble } from './mocks';

/** Band that introduces a composition (anchor target for the dev nav). */
export function CompositionBand({
  id,
  t,
  title,
  reference,
}: {
  id: string;
  t: Copy;
  title: string;
  reference: string;
}) {
  return (
    <div id={id} className="scroll-mt-12 border-y border-line bg-subtle">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
        <span className="text-[12px] font-semibold text-muted">{t.meta.composition}</span>
        <h2 className="text-[15px] font-bold">{title}</h2>
        <code dir="ltr" className="text-[12px] text-faint">
          {reference}
        </code>
      </div>
    </div>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  attending: Users,
  responses: Mail,
  declined: X,
  deadline: Clock,
};

type RsvpFilter = 'all' | 'yes' | 'no';

/** app.html "responses": page head, KPI row, two bar cards, table card (search + filter) → row drawer. */
export function ResponsesComposition({ t }: { t: Copy }) {
  const r = t.responses;
  const [filter, setFilter] = useState<RsvpFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ResponseRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return r.rows.filter((row) => {
      if (filter !== 'all' && (filter === 'yes') !== row.attending) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (digits.length > 0 && row.phone.replace(/\D/g, '').includes(digits))
      );
    });
  }, [r.rows, filter, query]);

  const columns: DataTableColumn<ResponseRow>[] = [
    {
      key: 'name',
      header: r.columns.name,
      cell: (row) => (
        <b className="font-bold whitespace-nowrap">
          <bdi>{row.name}</bdi>
        </b>
      ),
    },
    {
      key: 'status',
      header: r.columns.status,
      cell: (row) => (
        <Badge variant={row.attending ? 'live' : 'danger'}>{row.attending ? r.attending : r.declined}</Badge>
      ),
    },
    { key: 'adults', header: r.columns.adults, numeric: true },
    { key: 'kids', header: r.columns.kids, numeric: true },
    {
      key: 'diet',
      header: r.columns.diet,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.diet.length > 0 ? (
          row.diet.map((d) => (
            <Tag key={d} className="me-1">
              {d}
            </Tag>
          ))
        ) : (
          <span className="text-[12px] text-muted">{r.none}</span>
        ),
    },
    { key: 'bus', header: r.columns.bus, className: 'whitespace-nowrap' },
    {
      key: 'message',
      header: r.columns.message,
      className: 'max-w-[220px] truncate text-muted',
      cell: (row) => (row.message ? <bdi>{row.message}</bdi> : r.none),
    },
    { key: 'received', header: r.columns.received, className: 'text-[12px] whitespace-nowrap text-muted' },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-bold tracking-[-0.01em]">{r.title}</h2>
          <p className="mt-1 text-muted">
            {r.subtitle} ·{' '}
            <Badge variant="live" icon={<CircleCheckBig />}>
              {r.published}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Share2 />}>
            {r.share}
          </Button>
          <Button icon={<Download />}>{r.export}</Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 min-[901px]:grid-cols-4">
        {r.kpis.map((kpi) => {
          const Icon = KPI_ICONS[kpi.key] ?? Users;
          return <KpiCard key={kpi.key} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={<Icon />} />;
        })}
      </div>

      <div className="mt-4 grid gap-4 min-[901px]:grid-cols-2">
        <Card padding="md">
          <Bars title={r.dietTitle} rows={r.diet.map(([label, value]) => ({ key: label, label, value }))} />
        </Card>
        <Card padding="md">
          <Bars title={r.busTitle} rows={r.bus.map(([label, value]) => ({ key: label, label, value }))} />
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Input
            type="search"
            icon={<Search />}
            placeholder={r.search}
            aria-label={r.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            wrapperClassName="min-w-[200px] flex-1"
          />
          <Segmented<RsvpFilter>
            label={t.segmented.filter}
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: t.segmented.all },
              { value: 'yes', label: t.segmented.attending },
              { value: 'no', label: t.segmented.notAttending },
            ]}
          />
          <Button variant="secondary" size="sm" icon={<Filter />}>
            {r.filter}
          </Button>
        </div>
        <DataTable
          caption={r.caption}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          onRowClick={(row) => {
            setSelected(row);
            setDrawerOpen(true);
          }}
          empty={
            <EmptyState
              illustration={<EnvelopeIllustration />}
              title={r.noMatch}
              description={r.noMatchDescription}
            />
          }
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={<bdi>{selected?.name}</bdi>}
        description={selected ? `${r.drawer.description}: ${selected.received}` : undefined}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              {t.common.close}
            </Button>
            <Button variant="danger" icon={<Trash2 />}>
              {r.drawer.remove}
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3.5 text-[14px]">
              <dt className="text-[13px] text-muted">{r.columns.status}</dt>
              <dd>
                <Badge variant={selected.attending ? 'live' : 'danger'}>
                  {selected.attending ? r.attending : r.declined}
                </Badge>
              </dd>
              <dt className="text-[13px] text-muted">{r.drawer.adults}</dt>
              <dd className="tabular-nums">{selected.adults}</dd>
              <dt className="text-[13px] text-muted">{r.drawer.kids}</dt>
              <dd className="tabular-nums">{selected.kids}</dd>
              <dt className="text-[13px] text-muted">{r.drawer.diet}</dt>
              <dd className="flex flex-wrap gap-1">
                {selected.diet.length > 0 ? selected.diet.map((d) => <Tag key={d}>{d}</Tag>) : r.none}
              </dd>
              <dt className="text-[13px] text-muted">{r.drawer.bus}</dt>
              <dd>{selected.bus}</dd>
              <dt className="text-[13px] text-muted">{r.drawer.phone}</dt>
              <dd>
                <span dir="ltr">{selected.phone}</span>
              </dd>
            </dl>
            {selected.message && (
              <>
                <h3 className="mt-6 text-[13px] font-semibold">{r.drawer.message}</h3>
                <p className="mt-2 rounded-card bg-subtle p-4 text-[14px]">
                  <bdi>{selected.message}</bdi>
                </p>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

/** app.html "share": link box + copy, message textarea, WhatsApp (48px) + copy; WhatsApp preview + QR. */
export function ShareComposition({ t }: { t: Copy }) {
  const s = t.share;
  const { toast } = useToast();
  const [message, setMessage] = useState(s.message);

  const copy = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked (permissions / insecure origin) — the sample toast still shows.
    }
    toast({ variant: 'success', title });
  };

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-8 pb-16 sm:px-6">
      <h2 className="text-[26px] font-bold tracking-[-0.01em]">{s.title}</h2>
      <p className="mt-1 text-muted">{s.subtitle}</p>
      <div className="mt-6 grid items-start gap-5 min-[901px]:grid-cols-[1.2fr_1fr]">
        <Card padding="lg">
          <Field label={s.linkLabel}>
            <div className="mt-2 flex gap-2">
              <Input
                readOnly
                value={s.link}
                dir="ltr"
                textAlign="start"
                className="[font-family:Inter,monospace]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="secondary" icon={<CopyIcon />} onClick={() => copy(s.link, s.copied)}>
                {s.copy}
              </Button>
            </div>
          </Field>
          <Field label={s.messageLabel} className="mt-5">
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="whatsapp" size="lg" icon={<MessageCircle />}>
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                {s.whatsapp}
              </a>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<CopyIcon />}
              onClick={() => copy(message, s.messageCopied)}
            >
              {s.copyMessage}
            </Button>
          </div>
        </Card>
        <Card padding="lg">
          <p className="text-[13px] font-semibold">{s.previewLabel}</p>
          <WhatsAppBubble copy={s} />
          <p className="mt-5 mb-1.5 text-[13px] font-semibold">{s.qrLabel}</p>
          <div className="flex items-center gap-4">
            <QrPlaceholder label={s.qrAlt} />
            <div className="grid gap-2">
              <Button variant="secondary" size="sm" icon={<Download />}>
                PNG
              </Button>
              <Button variant="secondary" size="sm" icon={<Download />}>
                SVG
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const SECTION_ICONS: Record<SectionItem['icon'], LucideIcon> = {
  mail: Mail,
  image: ImageIcon,
  clock: Clock,
  heart: Heart,
  'map-pin': MapPin,
  'list-plus': ListPlus,
  bus: Bus,
  sparkles: Sparkles,
  gift: Gift,
  'message-circle': MessageCircle,
  camera: Camera,
  users: Users,
  type: Type,
};

type L10nValue = { he: string; en: string };

/** Scale that fits the phone in the canvas: min(1, (h − 120) / H, (w − 48) / W) (§9B.3 D). */
function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.3, Math.min(1, (height - 120) / 866, (width - 48) / 412)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

/** app.html "editor": top bar, rail (tabs + section list), form panel, canvas with the phone. */
export function EditorComposition({ t, locale }: { t: Copy; locale: Locale }) {
  const e = t.editor;
  const f = t.field;
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [previewLang, setPreviewLang] = useState<Locale>(locale);
  const [railTab, setRailTab] = useState<'sections' | 'design' | 'settings'>('sections');
  const [selectedSection, setSelectedSection] = useState('hero');
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(e.sections.map((s) => [s.id, s.on])),
  );
  const [eyebrow, setEyebrow] = useState<L10nValue>(f.eyebrowValues);
  const [eyebrowLang, setEyebrowLang] = useState<Locale>('he');
  const [location, setLocation] = useState<L10nValue>(f.locationValues);
  const [locationLang, setLocationLang] = useState<Locale>('he');
  const [titleMode, setTitleMode] = useState<'hosts' | 'free'>('hosts');
  const [showDate, setShowDate] = useState(true);
  const [overlay, setOverlay] = useState(35);
  const [seal, setSeal] = useState('bordeaux');
  const canvasRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(canvasRef);
  const overlayId = useId();

  const l10nOptions = (value: L10nValue) =>
    [
      { value: 'he', label: t.l10n.he, ariaLabel: t.l10n.heFull, lang: 'he', missing: !value.he.trim() },
      { value: 'en', label: t.l10n.en, ariaLabel: t.l10n.enFull, lang: 'en', missing: !value.en.trim() },
    ] as const;

  return (
    <div className="bg-canvas">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-3">
        <IconButton label={e.back} tooltip>
          <ArrowLeft className="icon-dir" />
        </IconButton>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[15px] font-bold">
            <span className="truncate">{e.docTitle}</span>
            <Badge variant="draft">{e.draft}</Badge>
          </div>
          <div className="flex items-center gap-1 text-[12px] text-muted">
            <Check aria-hidden size={12} strokeWidth={1.75} />
            {e.saved}
          </div>
        </div>
        <div className="mx-auto hidden items-center gap-2 lg:flex">
          <Segmented
            label={t.segmented.device}
            value={device}
            onValueChange={setDevice}
            options={[
              { value: 'mobile', label: t.segmented.mobile, icon: <Smartphone /> },
              { value: 'desktop', label: t.segmented.desktop, icon: <Monitor /> },
            ]}
          />
          <Segmented<Locale>
            label={t.segmented.previewLang}
            value={previewLang}
            onValueChange={setPreviewLang}
            options={[
              { value: 'he', label: t.l10n.he, ariaLabel: t.l10n.heFull },
              { value: 'en', label: t.l10n.en, ariaLabel: t.l10n.enFull },
            ]}
          />
        </div>
        <div className="ms-auto flex items-center gap-3 lg:ms-0">
          <div className="hidden items-center gap-3 sm:flex">
            <IconButton label={e.undo} tooltip>
              <Undo2 className="icon-dir" />
            </IconButton>
            <IconButton label={e.redo} tooltip>
              <Redo2 className="icon-dir" />
            </IconButton>
            <Button variant="secondary" size="sm" icon={<Eye />}>
              {e.preview}
            </Button>
          </div>
          <Button size="sm" icon={<Send className="icon-dir" />}>
            {e.publish}
          </Button>
        </div>
      </header>

      <div className="grid lg:h-[800px] lg:grid-cols-[280px_400px_minmax(0,1fr)]">
        {/* Rail */}
        <aside className="flex min-h-0 flex-col border-line bg-surface max-lg:border-b lg:border-e">
          <Tabs
            label={t.tabs.label}
            value={railTab}
            onValueChange={setRailTab}
            items={[
              { value: 'sections', label: t.tabs.sections, icon: <Layers /> },
              { value: 'design', label: t.tabs.design, icon: <Palette /> },
              { value: 'settings', label: t.tabs.settings, icon: <Settings2 /> },
            ]}
            className="flex min-h-0 flex-1 flex-col"
            listClassName="border-b border-line px-3 py-2.5"
          >
            <TabsPanel value="sections" className="min-h-0 flex-1 overflow-auto p-2">
              <ul>
                {e.sections.map((section) => {
                  const Icon = SECTION_ICONS[section.icon];
                  const on = enabled[section.id] ?? section.on;
                  const current = selectedSection === section.id;
                  return (
                    <li
                      key={section.id}
                      className={cn(
                        'relative flex h-11 items-center gap-2.5 rounded-btn px-2.5 hover:bg-subtle',
                        current && 'bg-subtle font-semibold',
                      )}
                    >
                      {current && (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 start-0 w-[3px] rounded-[3px] bg-ink"
                        />
                      )}
                      {section.locked ? (
                        <Lock
                          aria-label={e.locked}
                          role="img"
                          size={14}
                          strokeWidth={1.75}
                          className="shrink-0 text-faint"
                        />
                      ) : (
                        <GripVertical
                          aria-label={e.reorder}
                          role="img"
                          size={16}
                          strokeWidth={1.75}
                          className="shrink-0 cursor-grab text-faint"
                        />
                      )}
                      <button
                        type="button"
                        aria-current={current || undefined}
                        onClick={() => setSelectedSection(section.id)}
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-2 text-start',
                          !on && 'text-faint',
                        )}
                      >
                        <Icon aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                        <span className="truncate">{section.name}</span>
                      </button>
                      {!section.locked && (
                        <Switch
                          label={`${e.toggleSection}: ${section.name}`}
                          checked={on}
                          onCheckedChange={(next) => setEnabled((m) => ({ ...m, [section.id]: next }))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </TabsPanel>
            <TabsPanel value="design" className="min-h-0 flex-1 overflow-auto p-4">
              <p className="text-[13px] text-muted">{t.tabs.designBody}</p>
              <p className="mt-4 mb-2 text-[13px] font-semibold">{t.swatch.sealLabel}</p>
              <SwatchGroup
                label={t.swatch.sealLabel}
                value={seal}
                onValueChange={setSeal}
                options={[
                  { value: 'bordeaux', color: '#731F2E', label: t.swatch.seal.bordeaux },
                  { value: 'gold', color: '#B08D57', label: t.swatch.seal.gold },
                  { value: 'teal', color: '#1E5A67', label: t.swatch.seal.teal },
                  { value: 'navy', color: '#1F3A68', label: t.swatch.seal.navy },
                ]}
              />
            </TabsPanel>
            <TabsPanel value="settings" className="min-h-0 flex-1 overflow-auto p-4">
              <p className="text-[13px] text-muted">{t.tabs.settingsBody}</p>
            </TabsPanel>
          </Tabs>
          <button
            type="button"
            className="m-2 flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-input border border-dashed border-line-strong font-semibold text-muted hover:bg-subtle hover:text-ink"
          >
            <Plus aria-hidden size={16} strokeWidth={1.75} />
            {e.addSection}
          </button>
        </aside>

        {/* Form panel */}
        <div className="min-h-0 overflow-auto border-line bg-canvas p-5 max-lg:border-b lg:border-e">
          <h3 className="text-[18px] font-bold">{e.panelTitle}</h3>
          <p className="mt-0.5 text-[13px] text-muted">{e.panelSub}</p>
          <Card padding="sm" className="mt-4">
            <CardTitle>{t.card.panelTitle}</CardTitle>
            <Field
              label={f.eyebrow}
              counter={{ value: [...eyebrow[eyebrowLang]].length, max: 40 }}
              labelAside={
                <L10nTabs
                  label={t.l10n.groupLabel}
                  missingLabel={t.l10n.missing}
                  value={eyebrowLang}
                  onValueChange={setEyebrowLang}
                  options={l10nOptions(eyebrow)}
                />
              }
            >
              <Input
                value={eyebrow[eyebrowLang]}
                onChange={(ev) => setEyebrow((v) => ({ ...v, [eyebrowLang]: ev.target.value }))}
                dir={eyebrowLang === 'he' ? 'rtl' : 'ltr'}
                lang={eyebrowLang}
                textAlign="start"
                maxLength={60}
              />
            </Field>
            <Field label={f.title} help={f.titleHelp} className="mt-3.5">
              <Segmented
                fullWidth
                value={titleMode}
                onValueChange={setTitleMode}
                options={[
                  { value: 'hosts', label: f.titleOptions.hosts },
                  { value: 'free', label: f.titleOptions.free },
                ]}
              />
            </Field>
            <Field
              label={f.location}
              className="mt-3.5"
              counter={{ value: [...location[locationLang]].length, max: 40 }}
              labelAside={
                <L10nTabs
                  label={t.l10n.groupLabel}
                  missingLabel={t.l10n.missing}
                  value={locationLang}
                  onValueChange={setLocationLang}
                  options={l10nOptions(location)}
                />
              }
            >
              <Input
                value={location[locationLang]}
                onChange={(ev) => setLocation((v) => ({ ...v, [locationLang]: ev.target.value }))}
                dir={locationLang === 'he' ? 'rtl' : 'ltr'}
                lang={locationLang}
                textAlign="start"
                maxLength={60}
              />
            </Field>
            <SwitchRow
              className="mt-3.5"
              label={t.switch.showDate}
              help={t.switch.showDateHelp}
              checked={showDate}
              onCheckedChange={setShowDate}
            />
            <Field label={t.inputs.select} className="mt-3.5">
              <Select defaultValue={t.inputs.selectOptions[0]}>
                {t.inputs.selectOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
          </Card>
          <Card padding="sm" className="mt-4">
            <CardTitle>{e.background}</CardTitle>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                aria-pressed
                className="relative aspect-[9/16] overflow-hidden rounded-input border-2 border-ink"
                style={{ background: 'linear-gradient(180deg,#F8DCC4,#EFA995 50%,#9A5C6B 80%,#5E2F40)' }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-b from-transparent to-black/55 p-1.5 text-start text-[11px] text-white">
                  {e.thumbCaption}
                </span>
              </button>
              <button
                type="button"
                className="grid aspect-[9/16] place-items-center rounded-input border-[1.5px] border-dashed border-line-strong bg-surface p-2 text-center text-[12px] text-muted hover:text-ink"
              >
                <span className="flex flex-col items-center gap-1">
                  <Upload aria-hidden size={18} strokeWidth={1.75} />
                  {e.upload}
                </span>
              </button>
            </div>
            <Field
              id={overlayId}
              label={e.overlay}
              className="mt-3.5"
              labelAside={
                <span dir="ltr" className="text-[12px] text-muted tabular-nums">
                  {overlay}%
                </span>
              }
            >
              <input
                id={overlayId}
                type="range"
                min={0}
                max={70}
                value={overlay}
                onChange={(ev) => setOverlay(Number(ev.target.value))}
                className="w-full accent-ink"
              />
            </Field>
          </Card>
          <Card padding="sm" tone="info" className="mt-4">
            <div className="flex items-start gap-3">
              <Sparkles aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-[#1d4ed8]" />
              <p className="flex-1 text-[12px] text-[#1e3a8a]">{t.card.tip}</p>
            </div>
          </Card>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative flex h-[560px] flex-col items-center justify-center gap-3.5 overflow-hidden bg-canvas-editor bg-[radial-gradient(#D6D3D1_1px,transparent_1px)] [background-size:16px_16px] lg:h-auto"
        >
          <span className="absolute start-4 top-4 flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-sm">
            <Eye aria-hidden size={14} strokeWidth={1.75} />
            <span>
              {e.liveHint} · <span dir="ltr">390×844</span>
            </span>
          </span>
          <PhoneFrame scale={scale}>
            {/* The preview language is independent of the UI language (§7.9). */}
            <InvitationMock mock={COPY[previewLang].editor.mock} lang={previewLang} />
          </PhoneFrame>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Play />}>
              {e.replay}
            </Button>
            <Button variant="ghost" size="sm" icon={<ExternalLink className="icon-dir" />}>
              {e.openTab}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Label + help on the start side, switch on the end side (app.html `.fld.row`). */
export function SwitchRow({
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  help?: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <div id={`${id}l`} className="text-[13px] font-semibold">
          {label}
        </div>
        {help != null && (
          <p id={`${id}h`} className="text-[12px] text-muted">
            {help}
          </p>
        )}
      </div>
      <Switch
        label={label}
        aria-describedby={help != null ? `${id}h` : undefined}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
