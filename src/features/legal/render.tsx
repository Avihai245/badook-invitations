import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUi } from '@/lib/i18n/server';
import { effectiveOf, legalContext, legalStatus } from './context';
import { LegalPage, legalMetadata, type LegalVersionInfo } from './LegalPage';
import { LEGAL_VERSIONS, versionInForce, visibleVersions } from './registry';
import type { LegalDocKey } from './types';

/** The documents version 2's pages link to at their foot (and from each other). */
const RELATED: Record<LegalDocKey, readonly LegalDocKey[]> = {
  terms: ['privacy', 'refunds', 'gallery-rules', 'cookies', 'accessibility'],
  privacy: ['terms', 'gallery-rules', 'cookies'],
  cookies: ['privacy', 'terms'],
  accessibility: ['terms', 'privacy'],
  refunds: ['terms', 'privacy'],
  'gallery-rules': ['terms', 'privacy', 'cookies'],
};

const iso2 = (iso: string, he: boolean) =>
  new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

/** Which version to show: the one asked for, if a visitor may open it; the one in force otherwise. */
function pick(key: LegalDocKey, version: string | undefined) {
  const active = legalStatus().active;
  const inForce = versionInForce(key, active);
  const chosen = version
    ? visibleVersions(key, active).find((v) => v.version === version)
    : inForce;
  return { active, inForce, chosen };
}

export async function legalDocMetadata(key: LegalDocKey, version?: string): Promise<Metadata> {
  const { locale, t } = await getUi();
  const { chosen, inForce } = pick(key, version);
  if (!chosen || !inForce) return {};
  const meta = legalMetadata(chosen.build(legalContext(locale, chosen.version)), t.brand);
  // an earlier version is a record, not a page to find in a search
  return chosen.version === inForce.version ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** A legal document's page — the version in force at its stable route, or any visible version at /legal/<doc>/<version>. */
export async function LegalDocPage({ docKey, version }: { docKey: LegalDocKey; version?: string }) {
  const { locale, t } = await getUi();
  const { active, inForce, chosen } = pick(docKey, version);
  if (!chosen || !inForce) notFound();
  const context = legalContext(locale, chosen.version);
  const he = locale === 'he';
  const visible = visibleVersions(docKey, active);
  const newer = LEGAL_VERSIONS[docKey].find((v) => Number(v.version) > Number(chosen.version) && visible.includes(v));
  const info: LegalVersionInfo = {
    key: docKey,
    version: chosen.version,
    current: chosen.version === inForce.version,
    until: newer ? iso2(effectiveOf(newer.version), he) : undefined,
    history: [...visible].reverse().map((v) => ({
      version: v.version,
      effective: iso2(effectiveOf(v.version), he),
      current: v.version === inForce.version,
    })),
    related: chosen.version === '1' ? [] : RELATED[docKey],
  };
  return <LegalPage t={t} doc={chosen.build(context)} context={context} info={info} />;
}
