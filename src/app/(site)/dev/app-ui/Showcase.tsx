'use client';

import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  Layers,
  MessageCircle,
  Monitor,
  PanelRight,
  Palette,
  Plus,
  Redo2,
  Search,
  Send,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Badge,
  Bars,
  Button,
  Card,
  CardTitle,
  ColorSwatch,
  DataTable,
  Dialog,
  DirProvider,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  KpiCard,
  L10nTabs,
  PaletteDots,
  PhoneFrame,
  Segmented,
  Select,
  Skeleton,
  Switch,
  SwatchGroup,
  Tabs,
  TabsPanel,
  Tag,
  Textarea,
  ToastProvider,
  cn,
  useToast,
  type DataTableColumn,
} from '@/components/app';
import {
  CompositionBand,
  EditorComposition,
  ResponsesComposition,
  ShareComposition,
  SwitchRow,
} from './compositions';
import { COPY, type Copy, type Locale, type ResponseRow } from './copy';
import { EnvelopeIllustration, InvitationMock } from './mocks';

/** /dev/app-ui — every host-app primitive and state, plus three app.html compositions. */
export function Showcase({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  return (
    <div dir={dir} lang={locale} className="min-h-dvh bg-canvas text-ink">
      <DirProvider dir={dir}>
        <ToastProvider label={t.toast.label} viewportLabel={t.toast.viewport} closeLabel={t.common.close}>
          <DevNav t={t} locale={locale} />
          <main>
            <div id="primitives" className="mx-auto max-w-[1200px] scroll-mt-12 px-4 pt-8 pb-14 sm:px-6">
              <h1 className="text-[26px] font-bold tracking-[-0.01em]">{t.meta.title}</h1>
              <p className="mt-1 max-w-[82ch] text-muted">{t.meta.intro}</p>
              <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
                <ButtonDemo t={t} />
                <IconButtonDemo t={t} />
                <BadgeDemo t={t} />
                <InputsDemo t={t} />
                <FieldDemo t={t} />
                <SegmentedDemo t={t} />
                <SwitchDemo t={t} />
                <L10nTabsDemo t={t} />
                <CardDemo t={t} />
                <KpiDemo t={t} />
                <BarsDemo t={t} />
                <TabsDemo t={t} />
                <TableDemo t={t} />
                <OverlaysDemo t={t} />
                <ToastDemo t={t} />
                <SkeletonDemo t={t} />
                <EmptyStateDemo t={t} />
                <SwatchDemo t={t} />
                <PhoneDemo t={t} locale={locale} />
              </div>
            </div>
            <CompositionBand
              id="responses"
              t={t}
              title={t.meta.nav.responses}
              reference="screenshots/app-responses.png"
            />
            <ResponsesComposition t={t} />
            <CompositionBand
              id="share"
              t={t}
              title={t.meta.nav.share}
              reference="screenshots/app-share.png"
            />
            <ShareComposition t={t} />
            <CompositionBand
              id="editor"
              t={t}
              title={t.meta.nav.editor}
              reference="screenshots/app-editor.png"
            />
            <EditorComposition t={t} locale={locale} />
          </main>
        </ToastProvider>
      </DirProvider>
    </div>
  );
}

function DevNav({ t, locale }: { t: Copy; locale: Locale }) {
  const links = [
    ['primitives', t.meta.nav.primitives],
    ['responses', t.meta.nav.responses],
    ['share', t.meta.nav.share],
    ['editor', t.meta.nav.editor],
  ] as const;
  const pill = (on: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-[13px] whitespace-nowrap',
      on ? 'bg-white text-[#0c0a09]' : 'text-line-strong hover:text-white',
    );
  return (
    <nav aria-label={t.meta.navLabel} className="sticky top-0 z-40 bg-[#0c0a09] text-white">
      <div className="mx-auto flex h-11 max-w-[1200px] items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="me-2 shrink-0 text-[13px] font-bold">
          Badook · App UI
        </Link>
        <div className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
          {links.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={pill(false)}>
              {label}
            </a>
          ))}
        </div>
        <div
          role="group"
          aria-label={t.meta.langLabel}
          className="ms-auto flex shrink-0 gap-0.5 rounded-full bg-white/10 p-0.5"
        >
          <Link
            href="/dev/app-ui"
            lang="he"
            aria-current={locale === 'he' ? 'page' : undefined}
            className={pill(locale === 'he')}
          >
            {t.meta.langHe}
          </Link>
          <Link
            href="/dev/app-ui?lang=en"
            lang="en"
            aria-current={locale === 'en' ? 'page' : undefined}
            className={pill(locale === 'en')}
          >
            {t.meta.langEn}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Demo({
  id,
  title,
  note,
  wide = false,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Card asChild padding="lg" className={cn('min-w-0', wide && 'md:col-span-2')}>
      <section aria-labelledby={`demo-${id}`}>
        <h2 id={`demo-${id}`} className="text-[15px] font-bold">
          <bdi>{title}</bdi>
        </h2>
        {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
        <div className="mt-4">{children}</div>
      </section>
    </Card>
  );
}

function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 first:mt-0', className)}>
      <p className="mb-2 text-[12px] font-semibold text-faint">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ButtonDemo({ t }: { t: Copy }) {
  const b = t.button;
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 1600);
  };
  return (
    <Demo id="button" title="Button" note={b.note} wide>
      <Group label={b.variants}>
        <Button icon={<Send className="icon-dir" />}>{b.primary}</Button>
        <Button variant="secondary" icon={<Eye />}>
          {b.secondary}
        </Button>
        <Button variant="ghost" icon={<ExternalLink className="icon-dir" />}>
          {b.ghost}
        </Button>
        <Button variant="danger" icon={<Trash2 />}>
          {b.danger}
        </Button>
        <Button variant="whatsapp" icon={<MessageCircle />}>
          {b.whatsapp}
        </Button>
      </Group>
      <Group label={b.sizes}>
        <Button size="sm" icon={<Plus />}>
          {b.small} · 32
        </Button>
        <Button size="md" icon={<Share2 />}>
          {b.medium} · 40
        </Button>
        <Button size="lg">{b.large} · 48</Button>
        <Button size="sm" variant="secondary" icon={<Plus />}>
          {b.small}
        </Button>
        <Button size="md" variant="secondary" icon={<Share2 />}>
          {b.medium}
        </Button>
        <Button size="lg" variant="secondary">
          {b.large}
        </Button>
      </Group>
      <Group label={b.states}>
        <Button loading={saving} onClick={save} icon={<Check />}>
          {saving ? b.saving : b.clickToSave}
        </Button>
        <Button variant="secondary" loading>
          {b.saving}
        </Button>
        <Button disabled icon={<Send className="icon-dir" />}>
          {b.disabled}
        </Button>
        <Button variant="secondary" disabled>
          {b.disabled}
        </Button>
        <Button asChild variant="ghost" icon={<ArrowLeft className="icon-dir" />}>
          <Link href="/">{b.link}</Link>
        </Button>
      </Group>
      <Group label={b.fullWidth}>
        <Button fullWidth size="lg" variant="whatsapp" icon={<MessageCircle />}>
          {b.whatsapp}
        </Button>
      </Group>
    </Demo>
  );
}

function IconButtonDemo({ t }: { t: Copy }) {
  const i = t.iconButton;
  const [muted, setMuted] = useState(false);
  return (
    <Demo id="icon-button" title="IconButton" note={i.note}>
      <Group label="md · 36 (tooltip)">
        <IconButton label={i.back} tooltip>
          <ArrowLeft className="icon-dir" />
        </IconButton>
        <IconButton label={i.undo} tooltip>
          <Undo2 className="icon-dir" />
        </IconButton>
        <IconButton label={i.redo} tooltip>
          <Redo2 className="icon-dir" />
        </IconButton>
        <IconButton label={i.more} tooltip>
          <Ellipsis />
        </IconButton>
        <IconButton label={i.remove} tooltip>
          <Trash2 />
        </IconButton>
        <IconButton label={i.mute} tooltip aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </IconButton>
      </Group>
      <Group label="sm · 28 · disabled">
        <IconButton label={i.close} size="sm">
          <X />
        </IconButton>
        <IconButton label={i.download} disabled>
          <Download />
        </IconButton>
      </Group>
    </Demo>
  );
}

function BadgeDemo({ t }: { t: Copy }) {
  const b = t.badge;
  return (
    <Demo id="badge" title="Badge · Tag" note={b.note}>
      <Group label="Badge">
        <Badge variant="draft">{b.draft}</Badge>
        <Badge variant="live" icon={<CircleCheckBig />}>
          {b.live}
        </Badge>
        <Badge variant="warning" icon={<TriangleAlert />}>
          {b.warning}
        </Badge>
        <Badge variant="danger">{b.danger}</Badge>
        <Badge variant="neutral">{b.neutral}</Badge>
        <Badge variant="info">{b.info}</Badge>
      </Group>
      <Group label="Tag">
        {b.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </Group>
    </Demo>
  );
}

function InputsDemo({ t }: { t: Copy }) {
  const n = t.inputs;
  return (
    <Demo id="inputs" title="Input · Select · Textarea" note={n.note}>
      <div className="grid gap-3.5">
        <Field label={n.text}>
          <Input defaultValue={n.textValue} />
        </Field>
        <Input placeholder={n.placeholder} aria-label={n.text} />
        <Input type="search" icon={<Search />} placeholder={n.search} aria-label={n.search} />
        <Field label={n.email}>
          <Input type="email" dir="ltr" defaultValue="noa@example.com" />
        </Field>
        <Field label={n.phone}>
          <Input type="tel" dir="ltr" defaultValue="+972 54-123-4567" />
        </Field>
        <Field label={n.url}>
          <Input type="url" dir="ltr" textAlign="start" defaultValue="https://yourapp.co.il/i/noa-and-itay" />
        </Field>
        <Field label={n.invalid} error={n.invalidError}>
          <Input type="email" dir="ltr" defaultValue={n.invalidValue} />
        </Field>
        <Field label={n.disabled}>
          <Input disabled defaultValue={n.disabledValue} />
        </Field>
        <Field label={n.select}>
          <Select defaultValue={n.selectOptions[0]}>
            {n.selectOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label={n.textarea}>
          <Textarea defaultValue={n.textareaValue} />
        </Field>
      </div>
    </Demo>
  );
}

type L10n = { he: string; en: string };
const l10nOptions = (t: Copy, value: L10n) =>
  [
    { value: 'he', label: t.l10n.he, ariaLabel: t.l10n.heFull, lang: 'he', missing: !value.he.trim() },
    { value: 'en', label: t.l10n.en, ariaLabel: t.l10n.enFull, lang: 'en', missing: !value.en.trim() },
  ] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function FieldDemo({ t }: { t: Copy }) {
  const f = t.field;
  const [eyebrow, setEyebrow] = useState<L10n>(f.eyebrowValues);
  const [eyebrowLang, setEyebrowLang] = useState<Locale>('he');
  const [place, setPlace] = useState<L10n>(f.locationValues);
  const [placeLang, setPlaceLang] = useState<Locale>('en');
  const [email, setEmail] = useState(f.emailValue);
  return (
    <Demo id="field" title="Field" note={f.note}>
      <Field
        label={f.eyebrow}
        counter={{ value: [...eyebrow[eyebrowLang]].length, max: 40 }}
        labelAside={
          <L10nTabs
            label={t.l10n.groupLabel}
            missingLabel={t.l10n.missing}
            value={eyebrowLang}
            onValueChange={setEyebrowLang}
            options={l10nOptions(t, eyebrow)}
          />
        }
      >
        <Input
          value={eyebrow[eyebrowLang]}
          onChange={(e) => setEyebrow((v) => ({ ...v, [eyebrowLang]: e.target.value }))}
          dir={eyebrowLang === 'he' ? 'rtl' : 'ltr'}
          lang={eyebrowLang}
          textAlign="start"
          maxLength={60}
        />
      </Field>
      <Field
        label={f.location}
        className="mt-3.5"
        counter={{ value: [...place[placeLang]].length, max: 40 }}
        labelAside={
          <L10nTabs
            label={t.l10n.groupLabel}
            missingLabel={t.l10n.missing}
            value={placeLang}
            onValueChange={setPlaceLang}
            options={l10nOptions(t, place)}
          />
        }
      >
        <Input
          value={place[placeLang]}
          placeholder={place[placeLang === 'he' ? 'en' : 'he']}
          onChange={(e) => setPlace((v) => ({ ...v, [placeLang]: e.target.value }))}
          dir={placeLang === 'he' ? 'rtl' : 'ltr'}
          lang={placeLang}
          textAlign="start"
          maxLength={60}
        />
      </Field>
      <Field label={f.required} required className="mt-3.5">
        <Input defaultValue={f.requiredValue} />
      </Field>
      <Field
        label={f.email}
        help={f.help}
        error={EMAIL.test(email) ? undefined : f.emailError}
        className="mt-3.5"
      >
        <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
    </Demo>
  );
}

function SegmentedDemo({ t }: { t: Copy }) {
  const s = t.segmented;
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [lang, setLang] = useState<Locale>('he');
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [mode, setMode] = useState<'hosts' | 'free'>('hosts');
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'custom'>('yearly');
  return (
    <Demo id="segmented" title="Segmented" note={s.note}>
      <Group label={s.device}>
        <Segmented
          label={s.device}
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'mobile', label: s.mobile, icon: <Smartphone /> },
            { value: 'desktop', label: s.desktop, icon: <Monitor /> },
          ]}
        />
        <Segmented<Locale>
          label={s.previewLang}
          value={lang}
          onValueChange={setLang}
          options={[
            { value: 'he', label: t.l10n.he, ariaLabel: t.l10n.heFull },
            { value: 'en', label: t.l10n.en, ariaLabel: t.l10n.enFull },
          ]}
        />
      </Group>
      <Group label={s.filter}>
        <Segmented
          label={s.filter}
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'all', label: s.all },
            { value: 'yes', label: s.attending },
            { value: 'no', label: s.notAttending },
          ]}
        />
      </Group>
      <Group label="fullWidth">
        <Segmented
          fullWidth
          label={t.field.title}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'hosts', label: t.field.titleOptions.hosts },
            { value: 'free', label: t.field.titleOptions.free },
          ]}
        />
      </Group>
      <Group label="disabled option">
        <Segmented
          label={s.plan}
          value={plan}
          onValueChange={setPlan}
          options={[
            { value: 'monthly', label: s.monthly },
            { value: 'yearly', label: s.yearly },
            { value: 'custom', label: s.custom, disabled: true },
          ]}
        />
      </Group>
    </Demo>
  );
}

function SwitchDemo({ t }: { t: Copy }) {
  const s = t.switch;
  const [showDate, setShowDate] = useState(true);
  const [music, setMusic] = useState(false);
  return (
    <Demo id="switch" title="Switch" note={s.note}>
      <SwitchRow label={s.showDate} help={s.showDateHelp} checked={showDate} onCheckedChange={setShowDate} />
      <SwitchRow
        className="mt-3.5"
        label={s.music}
        help={s.musicHelp}
        checked={music}
        onCheckedChange={setMusic}
      />
      <div className="mt-4 flex items-center gap-4">
        <Switch label={s.disabledOn} checked disabled />
        <Switch label={s.disabledOff} checked={false} disabled />
      </div>
    </Demo>
  );
}

function L10nTabsDemo({ t }: { t: Copy }) {
  const l = t.l10n;
  const [a, setA] = useState<Locale>('he');
  const [b, setB] = useState<Locale>('he');
  return (
    <Demo id="l10n-tabs" title="L10nTabs" note={l.note}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-2 text-[13px]">
          <L10nTabs
            label={l.groupLabel}
            missingLabel={l.missing}
            value={a}
            onValueChange={setA}
            options={l10nOptions(t, { he: 'x', en: 'x' })}
          />
          <span className="text-muted">{l.complete}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <L10nTabs
            label={l.groupLabel}
            missingLabel={l.missing}
            value={b}
            onValueChange={setB}
            options={l10nOptions(t, { he: 'x', en: '' })}
          />
          <span className="text-muted">{l.partial}</span>
        </div>
      </div>
    </Demo>
  );
}

function CardDemo({ t }: { t: Copy }) {
  const c = t.card;
  return (
    <Demo id="card" title="Card · CardTitle" note={c.note}>
      <Card padding="sm">
        <CardTitle>{c.panelTitle}</CardTitle>
        <p className="text-[13px] text-muted">{c.panelBody}</p>
      </Card>
      <Card padding="sm" tone="info" className="mt-3">
        <div className="flex items-start gap-3">
          <Sparkles aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-[#1d4ed8]" />
          <p className="flex-1 text-[12px] text-[#1e3a8a]">{c.tip}</p>
        </div>
      </Card>
    </Demo>
  );
}

function KpiDemo({ t }: { t: Copy }) {
  const k = t.responses.kpis;
  return (
    <Demo id="kpi" title="KpiCard" note={t.kpi.note}>
      <div className="grid grid-cols-2 gap-3">
        {k[0] && <KpiCard label={k[0].label} value={k[0].value} sub={k[0].sub} icon={<Users />} />}
        {k[1] && <KpiCard label={k[1].label} loading />}
      </div>
    </Demo>
  );
}

function BarsDemo({ t }: { t: Copy }) {
  const r = t.responses;
  return (
    <Demo id="bars" title="Bars" note={t.bars.note}>
      <Card padding="md">
        <Bars title={r.busTitle} rows={r.bus.map(([label, value]) => ({ key: label, label, value }))} />
      </Card>
    </Demo>
  );
}

function TabsDemo({ t }: { t: Copy }) {
  const tb = t.tabs;
  const [tab, setTab] = useState<'sections' | 'design' | 'settings'>('sections');
  const [on, setOn] = useState<Record<string, boolean>>({ countdown: true, story: true, gallery: false });
  const rows = t.editor.sections.filter((s) => s.id in on);
  return (
    <Demo id="tabs" title="Tabs · TabsPanel" note={tb.note}>
      <Card className="overflow-hidden">
        <Tabs
          label={tb.label}
          value={tab}
          onValueChange={setTab}
          listClassName="border-b border-line px-3 py-2.5"
          items={[
            { value: 'sections', label: tb.sections, icon: <Layers /> },
            { value: 'design', label: tb.design, icon: <Palette /> },
            { value: 'settings', label: tb.settings, icon: <Settings2 /> },
          ]}
        >
          <TabsPanel value="sections" className="p-2">
            {rows.map((s) => (
              <div key={s.id} className="flex h-11 items-center justify-between gap-2.5 rounded-btn px-2.5">
                <span className={cn(!on[s.id] && 'text-faint')}>{s.name}</span>
                <Switch
                  label={`${t.editor.toggleSection}: ${s.name}`}
                  checked={on[s.id] ?? false}
                  onCheckedChange={(v) => setOn((m) => ({ ...m, [s.id]: v }))}
                />
              </div>
            ))}
          </TabsPanel>
          <TabsPanel value="design" className="p-4 text-[13px] text-muted">
            {tb.designBody}
          </TabsPanel>
          <TabsPanel value="settings" className="p-4 text-[13px] text-muted">
            {tb.settingsBody}
          </TabsPanel>
        </Tabs>
      </Card>
    </Demo>
  );
}

function TableDemo({ t }: { t: Copy }) {
  const r = t.responses;
  const columns: DataTableColumn<ResponseRow>[] = [
    { key: 'name', header: r.columns.name },
    { key: 'status', header: r.columns.status },
    { key: 'adults', header: r.columns.adults, numeric: true },
    { key: 'kids', header: r.columns.kids, numeric: true },
  ];
  return (
    <Demo id="table" title="DataTable" note={t.table.note} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-[12px] font-semibold text-faint">{t.table.loading}</p>
          <Card className="overflow-hidden">
            <DataTable
              caption={t.table.caption}
              loading
              skeletonRows={3}
              columns={columns}
              rows={[]}
              getRowKey={(row) => row.id}
            />
          </Card>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[12px] font-semibold text-faint">{t.table.empty}</p>
          <Card className="overflow-hidden">
            <DataTable
              caption={t.table.caption}
              columns={columns}
              rows={[]}
              getRowKey={(row) => row.id}
              empty={
                <EmptyState
                  className="py-8"
                  title={t.empty.title}
                  description={t.empty.description}
                  action={
                    <Button size="sm" icon={<Share2 />}>
                      {t.empty.action}
                    </Button>
                  }
                />
              }
            />
          </Card>
        </div>
      </div>
    </Demo>
  );
}

function OverlaysDemo({ t }: { t: Copy }) {
  const o = t.overlays;
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [music, setMusic] = useState(true);
  const [slug, setSlug] = useState('noa-and-itay');
  return (
    <Demo id="overlays" title="Drawer · Dialog" note={o.note}>
      <div className="flex flex-wrap gap-2">
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          trigger={
            <Button variant="secondary" icon={<PanelRight className="icon-dir" />}>
              {o.openDrawer}
            </Button>
          }
          title={o.drawerTitle}
          description={o.drawerDescription}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>{t.common.save}</Button>
            </>
          }
        >
          <p className="text-[14px] text-muted">{o.drawerBody}</p>
          <SwitchRow
            className="mt-5"
            label={t.switch.music}
            help={t.switch.musicHelp}
            checked={music}
            onCheckedChange={setMusic}
          />
          <Field label={t.inputs.text} className="mt-5">
            <Input defaultValue={t.inputs.textValue} />
          </Field>
        </Drawer>

        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={<Button icon={<Send className="icon-dir" />}>{o.openDialog}</Button>}
          title={o.dialogTitle}
          description={o.dialogDescription}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                icon={<Send className="icon-dir" />}
                onClick={() => {
                  setDialogOpen(false);
                  toast({ variant: 'success', title: o.published, description: o.publishedDescription });
                }}
              >
                {o.publish}
              </Button>
            </>
          }
        >
          <Field label={o.slugLabel} help={<span className="text-success">✓ {o.slugAvailable}</span>}>
            <div dir="ltr" className="flex">
              <span className="inline-flex h-10 shrink-0 items-center rounded-s-input border border-e-0 border-line bg-subtle px-3 text-[14px] text-muted">
                yourapp.co.il/i/
              </span>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-s-none" />
            </div>
          </Field>
          <p className="mt-5 text-[13px] font-semibold">{o.issuesTitle}</p>
          <ul className="mt-2 divide-y divide-line rounded-card border border-line">
            <li className="flex items-center gap-2.5 px-3 py-2.5 text-[13px]">
              <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-danger" />
              <span className="flex-1">{o.issueError}</span>
            </li>
            <li className="flex items-center gap-2.5 px-3 py-2.5 text-[13px]">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-warning" />
              <span className="flex-1">{o.issueWarning}</span>
            </li>
          </ul>
        </Dialog>
      </div>
    </Demo>
  );
}

function ToastDemo({ t }: { t: Copy }) {
  const s = t.toast;
  const { toast } = useToast();
  return (
    <Demo id="toast" title="Toast · useToast()" note={s.note}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<CircleCheck />}
          onClick={() => toast({ variant: 'success', title: s.success })}
        >
          {s.showSuccess}
        </Button>
        <Button variant="secondary" onClick={() => toast({ title: s.info, description: s.infoDescription })}>
          {s.showInfo}
        </Button>
        <Button
          variant="secondary"
          icon={<CircleAlert />}
          onClick={() =>
            toast({
              id: 'autosave-failed',
              variant: 'danger',
              title: s.danger,
              description: s.dangerDescription,
              duration: Infinity,
              action: {
                label: s.retry,
                altText: s.retryAlt,
                onClick: () => toast({ variant: 'success', title: s.success }),
              },
            })
          }
        >
          {s.showDanger}
        </Button>
      </div>
    </Demo>
  );
}

function SkeletonDemo({ t }: { t: Copy }) {
  return (
    <Demo id="skeleton" title="Skeleton" note={t.skeleton.note}>
      <div aria-busy className="flex items-start gap-5">
        <div className="w-[108px] shrink-0">
          <Skeleton shape="block" height={192} radius={24} />
          <Skeleton shape="line" width="70%" className="mt-2.5" />
          <Skeleton shape="line" width="45%" height={10} className="mt-1.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Skeleton shape="circle" width={40} />
            <div className="flex-1">
              <Skeleton shape="line" width="60%" />
              <Skeleton shape="line" width="35%" height={10} className="mt-2" />
            </div>
          </div>
          <Skeleton shape="block" height={64} className="mt-4" />
          <Skeleton shape="line" className="mt-4" />
          <Skeleton shape="line" width="85%" className="mt-2" />
          <Skeleton shape="line" width="55%" className="mt-2" />
        </div>
      </div>
    </Demo>
  );
}

function EmptyStateDemo({ t }: { t: Copy }) {
  const e = t.empty;
  return (
    <Demo id="empty" title="EmptyState" note={e.note}>
      <EmptyState
        className="py-6"
        illustration={<EnvelopeIllustration />}
        title={e.title}
        description={e.description}
        action={<Button icon={<Share2 />}>{e.action}</Button>}
      />
    </Demo>
  );
}

function SwatchDemo({ t }: { t: Copy }) {
  const s = t.swatch;
  const [seal, setSeal] = useState('bordeaux');
  const [single, setSingle] = useState(true);
  return (
    <Demo id="swatch" title="ColorSwatch · SwatchGroup · PaletteDots" note={s.note}>
      <Group label={s.sealLabel}>
        <SwatchGroup
          label={s.sealLabel}
          value={seal}
          onValueChange={setSeal}
          options={[
            { value: 'bordeaux', color: '#731F2E', label: s.seal.bordeaux },
            { value: 'gold', color: '#B08D57', label: s.seal.gold },
            { value: 'teal', color: '#1E5A67', label: s.seal.teal },
            { value: 'navy', color: '#1F3A68', label: s.seal.navy },
            { value: 'sage', color: '#5F7555', label: s.seal.sage },
            { value: 'honey', color: '#E0A526', label: s.seal.honey },
          ]}
        />
      </Group>
      <Group label={s.single}>
        <span className="p-1">
          <ColorSwatch
            color="#731F2E"
            label={s.seal.bordeaux}
            selected={single}
            onClick={() => setSingle((v) => !v)}
          />
        </span>
        <span className="p-1">
          <ColorSwatch color="#FFFFFF" label="#FFFFFF" size={36} />
        </span>
      </Group>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {s.templates.map((tpl) => (
          <div key={tpl.id} className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-[15px] font-bold">
              <span className="truncate">{tpl.name}</span>
              <PaletteDots palette={tpl.palette} label={`${s.paletteLabel}: ${tpl.name}`} />
            </div>
            <div className="mt-0.5 truncate text-[12px] text-muted">{tpl.cats}</div>
          </div>
        ))}
      </div>
    </Demo>
  );
}

function PhoneDemo({ t, locale }: { t: Copy; locale: Locale }) {
  const p = t.phone;
  return (
    <Demo id="phone" title="PhoneFrame" note={p.note}>
      <div className="flex flex-wrap items-start justify-center gap-8">
        <figure className="flex flex-col items-center gap-3">
          <PhoneFrame scale={0.42}>
            <InvitationMock mock={t.editor.mock} lang={locale} />
          </PhoneFrame>
          <figcaption className="text-[12px] text-muted">{p.childrenLabel} · scale .42</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-3">
          <PhoneFrame scale={0.42} src={locale === 'en' ? '/?lang=en' : '/'} title={p.iframeTitle} />
          <figcaption className="text-[12px] text-muted">{p.iframeLabel} · scale .42</figcaption>
        </figure>
      </div>
    </Demo>
  );
}
