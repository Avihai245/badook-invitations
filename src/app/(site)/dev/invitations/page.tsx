import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { EventType, Locale } from '@/features/invitations/contracts/types';
import { isDarkPalette } from '@/features/invitations/lib/contrast';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { assertDevRoutes } from '@/lib/dev-routes';

export const metadata: Metadata = { title: 'Kitchen sink' };
// Rendered per request so the INVITES_DEV_ROUTES gate is read at runtime, never baked in at build.
export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;

const FRAME = { w: 390, h: 844 };
const LOCALES: Locale[] = ['he', 'en'];

/** URL-driven controls (no client JS): each option is a link that keeps the other choices. */
const CONTROLS = {
  doc: { label: 'Document', options: ['demo', 'stress', ...Object.keys(FIXTURES)], fallback: 'demo' },
  view: { label: 'View', options: ['open', 'cover', 'preview'], fallback: 'open' },
  scheme: { label: 'Device theme', options: ['light', 'dark'], fallback: 'light' },
  tl: {
    label: 'Timeline variant',
    options: ['template', 'vertical', 'horizontal-icons', 'flip-cards'],
    fallback: 'template',
  },
  zoom: { label: 'Zoom', options: ['0.4', '0.5', '0.75', '1'], fallback: '0.5' },
  tpl: { label: 'Template', options: ['all', ...TEMPLATES.keys()], fallback: 'all' },
} as const;
type ControlKey = keyof typeof CONTROLS;
type State = Record<ControlKey, string>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function readState(sp: Record<string, string | string[] | undefined>): State {
  const state = {} as State;
  for (const [key, c] of Object.entries(CONTROLS) as [ControlKey, (typeof CONTROLS)[ControlKey]][]) {
    const v = one(sp[key]);
    state[key] = v && (c.options as readonly string[]).includes(v) ? v : c.fallback;
  }
  return state;
}

function indexHref(state: State, patch: Partial<State>): string {
  const next = { ...state, ...patch };
  const q = new URLSearchParams();
  for (const key of Object.keys(CONTROLS) as ControlKey[]) {
    if (next[key] !== CONTROLS[key].fallback) q.set(key, next[key]);
  }
  const s = q.toString();
  return `/dev/invitations${s ? `?${s}` : ''}`;
}

/** URL of one kitchen-sink render (see render/[template]/[lang]/[doc]/page.tsx for the query). */
function renderHref(
  templateId: string,
  locale: Locale,
  doc: string,
  state: Pick<State, 'view' | 'tl'>,
): string {
  const q = new URLSearchParams();
  if (state.view === 'open') q.set('open', '1');
  if (state.view === 'preview') q.set('mode', 'preview');
  if (state.tl !== 'template') q.set('tl', state.tl);
  const s = q.toString();
  return `/dev/invitations/render/${templateId}/${locale}/${doc}${s ? `?${s}` : ''}`;
}

function docLocales(templateId: string, doc: string): Locale[] {
  if (doc in FIXTURES) return [...FIXTURES[doc as keyof typeof FIXTURES].locales];
  return TEMPLATES.get(templateId)?.manifest.supportsLocales ?? LOCALES;
}

function Controls({ state }: { state: State }) {
  return (
    <div className="grid gap-3">
      {(Object.keys(CONTROLS) as ControlKey[]).map((key) => (
        <div key={key} className="flex flex-wrap items-center gap-2">
          <span className="w-36 shrink-0 text-[13px] text-muted">{CONTROLS[key].label}</span>
          {CONTROLS[key].options.map((option) => {
            const active = state[key] === option;
            return (
              <Link
                key={option}
                href={indexHref(state, { [key]: option })}
                aria-current={active ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-ink'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                {option}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Frame({ src, title, zoom, scheme }: { src: string; title: string; zoom: number; scheme: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-line bg-subtle shadow-sm"
      style={{ width: FRAME.w * zoom, height: FRAME.h * zoom }}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        className="absolute left-0 top-0 origin-top-left border-0"
        // the embedded document's prefers-color-scheme follows the iframe's color-scheme (Chromium)
        style={
          {
            width: FRAME.w,
            height: FRAME.h,
            transform: `scale(${zoom})`,
            colorScheme: scheme,
          } as CSSProperties
        }
      />
    </div>
  );
}

/**
 * P0 kitchen sink (§11): every pack template × he/en, rendered by the real invitation renderer with
 * placeholder media. Dev-only (INVITES_DEV_ROUTES on the dev branch).
 */
export default async function KitchenSinkPage({ searchParams }: { searchParams: Search }) {
  assertDevRoutes();
  const state = readState(await searchParams);
  const zoom = Number(state.zoom);
  const templates = [...TEMPLATES.values()].filter(
    ({ manifest }) => state.tpl === 'all' || manifest.id === state.tpl,
  );

  return (
    <main dir="ltr" lang="en" className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invitation kitchen sink</h1>
          <p className="mt-1 max-w-3xl text-muted">
            Every pack template in Hebrew and English, rendered by the production renderer with placeholder
            media (no media is uploaded yet). Frames are {FRAME.w}×{FRAME.h}. The design-reference check is{' '}
            <Link
              className="underline"
              href={renderHref('sahar-bordeaux', 'he', 'wedding-he-en', { view: 'open', tl: 'template' })}
            >
              sahar-bordeaux · wedding-he-en
            </Link>
            .
          </p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          <Link
            className="rounded-btn border border-line bg-surface px-3 py-2 hover:border-line-strong"
            href="/dev/app-ui"
          >
            Host-app UI primitives →
          </Link>
        </nav>
      </header>

      <section className="mb-8 rounded-card border border-line bg-surface p-4 shadow-sm">
        <Controls state={state} />
        <p className="mt-3 text-[12px] text-faint">
          “stress” = longest allowed strings (20-char names, 40-char eyebrow, 22-char timeline labels).
          Fixture documents keep their own locales; a missing locale shows an empty slot. Gallery and reveal
          render in their static P0 form (interactive variants arrive in P4).
        </p>
      </section>

      <div className="grid gap-10">
        {templates.map(({ manifest, defaults }) => {
          const locales = docLocales(manifest.id, state.doc);
          const eventTypes = Object.keys(defaults.defaults) as EventType[];
          return (
            <section key={manifest.id} aria-labelledby={`t-${manifest.id}`}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id={`t-${manifest.id}`} className="text-lg font-semibold">
                  {manifest.name.en} <span className="font-normal text-muted">· {manifest.name.he}</span>
                </h2>
                <code className="text-[12px] text-muted">{manifest.id}</code>
                <span className="rounded-full bg-subtle px-2 py-0.5 text-[12px] text-muted">
                  {isDarkPalette(manifest.tokens.palette) ? 'dark palette' : 'light palette'}
                </span>
                <span className="text-[12px] text-muted">
                  demos:{' '}
                  {eventTypes.map((type, i) => (
                    <span key={type}>
                      {i ? ' · ' : ''}
                      <a
                        className="underline"
                        href={renderHref(manifest.id, 'he', `demo-${type}`, state)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {type}
                      </a>
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex flex-wrap gap-6">
                {LOCALES.map((locale) => {
                  const src = renderHref(manifest.id, locale, state.doc, state);
                  return (
                    <figure key={locale} className="grid gap-2">
                      {locales.includes(locale) ? (
                        <Frame
                          src={src}
                          title={`${manifest.id} ${locale}`}
                          zoom={zoom}
                          scheme={state.scheme}
                        />
                      ) : (
                        <div
                          className="grid place-items-center rounded-[18px] border border-dashed border-line-strong text-[13px] text-muted"
                          style={{ width: FRAME.w * zoom, height: FRAME.h * zoom }}
                        >
                          no {locale} in this document
                        </div>
                      )}
                      <figcaption className="flex items-center justify-between text-[12px] text-muted">
                        <span>{locale === 'he' ? 'עברית · RTL' : 'English · LTR'}</span>
                        {locales.includes(locale) ? (
                          <a className="underline" href={src} target="_blank" rel="noreferrer">
                            open ↗
                          </a>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
