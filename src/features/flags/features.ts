import { PLAN_IDS, type PlanId } from '../billing/plans';

/**
 * Feature flags: which capabilities an event may use. A capability is on for an event when this
 * deployment offers it at all (a kill switch, or setup it needs: an API key, a legal approval), the
 * host hasn't switched it off for the event, and the owner's plan includes it — or the platform
 * granted it to the event (an admin, a partner). Isomorphic: the server enforces, the screens hide
 * what is off. docs/features.md lists them.
 */
export const FEATURES = [
  /** per-section media, layouts and motion; the cinematic openings */
  'cinematic',
  /** the seating editor: floor plan, tables, guests at tables, print and export */
  'seating',
  /** the seating solver: seats everyone by the host's rules */
  'seating_auto',
  /** each guest gets their table number and a map to it */
  'seating_guide',
  /** check-in at the entrance and a live view of who arrived */
  'checkin',
  /** guests upload photos and videos from the event */
  'live_gallery',
  /** uploads are checked automatically before they appear */
  'gallery_ai',
  /** the gallery on the venue's screen, live */
  'projector',
  /** each guest finds the photos they appear in (biometric: needs its own approval) */
  'face_albums',
  /** a highlights video made from the gallery */
  'auto_reel',
  /** languages beyond Hebrew and English */
  'languages',
  /** automatic translation, reviewed before it is published */
  'translate_ai',
  /** the invitation read aloud */
  'voice',
  /** design concepts suggested from the event and its photos */
  'art_direction',
  /** a draft link for family comments */
  'draft_review',
  /** how guests use the invitation */
  'analytics',
] as const;
export type Feature = (typeof FEATURES)[number];
export const isFeature = (v: unknown): v is Feature => FEATURES.includes(v as Feature);

/** The packages, in order: each includes the one before it. */
export const PACKAGES = ['basic', 'premium', 'vip'] as const;
export type Package = (typeof PACKAGES)[number];
/** The plans as packages: Free = Basic, Pro = Premium, Business = VIP. */
export const PACKAGE_OF_PLAN: Record<PlanId, Package> = { free: 'basic', pro: 'premium', business: 'vip' };

const BASIC: readonly Feature[] = ['cinematic', 'seating', 'languages', 'draft_review', 'analytics'];
const PREMIUM: readonly Feature[] = [
  ...BASIC,
  'seating_auto',
  'seating_guide',
  'live_gallery',
  'gallery_ai',
  'translate_ai',
  'voice',
];
const VIP: readonly Feature[] = [
  ...PREMIUM,
  'checkin',
  'projector',
  'auto_reel',
  'face_albums',
  'art_direction',
];
export const PACKAGE_FEATURES: Record<Package, readonly Feature[]> = {
  basic: BASIC,
  premium: PREMIUM,
  vip: VIP,
};

/** The first package that includes a feature (what an upgrade prompt offers). */
export function packageFor(feature: Feature): Package {
  return PACKAGES.find((p) => PACKAGE_FEATURES[p].includes(feature)) ?? 'vip';
}
/** The plan that gives that package. */
export const planForPackage = (p: Package): PlanId => PLAN_IDS.find((plan) => PACKAGE_OF_PLAN[plan] === p)!;

/** An event's own choices: what the host switched off, what the platform granted. */
export interface FeatureOverrides {
  off: Feature[];
  grant: Feature[];
}
export const NO_OVERRIDES: FeatureOverrides = { off: [], grant: [] };

/** The stored overrides, keeping only known features (a removed feature is simply dropped). */
export function readOverrides(raw: unknown): FeatureOverrides {
  const list = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter(isFeature))] : []);
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { off: list(o.off), grant: list(o.grant) };
}

export interface FeatureInput {
  /** the plan in force (billing/plans effectivePlan: admins already have the top one) */
  plan: PlanId;
  admin: boolean;
  overrides: FeatureOverrides;
  /** what this deployment offers (server: deploymentFeatures) */
  available: ReadonlySet<Feature>;
}

/** What the event may use now. */
export function effectiveFeatures({ plan, admin, overrides, available }: FeatureInput): Set<Feature> {
  const pkg = PACKAGE_FEATURES[PACKAGE_OF_PLAN[plan]];
  return new Set(
    FEATURES.filter(
      (f) =>
        available.has(f) &&
        !overrides.off.includes(f) &&
        (admin || overrides.grant.includes(f) || pkg.includes(f)),
    ),
  );
}

/** Why a feature is off for an event: not offered here, switched off by the host, or not in the plan. */
export function whyOff(
  feature: Feature,
  input: FeatureInput,
): 'unavailable' | 'switched_off' | 'plan' | null {
  if (!input.available.has(feature)) return 'unavailable';
  if (input.overrides.off.includes(feature)) return 'switched_off';
  return effectiveFeatures(input).has(feature) ? null : 'plan';
}
