import { describe, expect, it, vi } from 'vitest';
import { getEventFeatures, setEventFeature, type FlagDeps } from '@/features/flags/api';
import {
  FEATURES,
  NO_OVERRIDES,
  PACKAGE_FEATURES,
  effectiveFeatures,
  packageFor,
  planForPackage,
  readOverrides,
  whyOff,
  type Feature,
  type FeatureInput,
} from '@/features/flags/features';

vi.mock('server-only', () => ({}));
const env = {
  INVITES_FEATURES_OFF: [] as string[],
  INVITES_FACE_ALBUMS: false,
  ANTHROPIC_API_KEY: '',
  INVITES_AI_MODEL: '',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));
const { deploymentFeatures } = await import('@/features/flags/server');

const ALL = new Set<Feature>(FEATURES);
const input = (over: Partial<FeatureInput> = {}): FeatureInput => ({
  plan: 'free',
  admin: false,
  overrides: NO_OVERRIDES,
  available: ALL,
  ...over,
});

describe('the packages', () => {
  it('each includes the one before it; the plans map to them', () => {
    for (const f of PACKAGE_FEATURES.basic) expect(PACKAGE_FEATURES.premium).toContain(f);
    for (const f of PACKAGE_FEATURES.premium) expect(PACKAGE_FEATURES.vip).toContain(f);
    expect(PACKAGE_FEATURES.vip).toEqual(expect.arrayContaining([...FEATURES]));
    expect(planForPackage('basic')).toBe('free');
    expect(planForPackage('premium')).toBe('pro');
    expect(planForPackage('vip')).toBe('business');
    expect(packageFor('seating')).toBe('basic');
    expect(packageFor('live_gallery')).toBe('premium');
    expect(packageFor('checkin')).toBe('vip');
  });
});

describe('what an event may use', () => {
  it('its owner’s plan decides', () => {
    expect(effectiveFeatures(input()).has('seating')).toBe(true);
    expect(effectiveFeatures(input()).has('live_gallery')).toBe(false);
    expect(effectiveFeatures(input({ plan: 'pro' })).has('live_gallery')).toBe(true);
    expect(effectiveFeatures(input({ plan: 'pro' })).has('projector')).toBe(false);
    expect(effectiveFeatures(input({ plan: 'business' })).size).toBe(FEATURES.length);
  });

  it('the host switches a feature off for the event; the platform grants one beyond the plan', () => {
    const off = input({ plan: 'business', overrides: { off: ['projector'], grant: [] } });
    expect(effectiveFeatures(off).has('projector')).toBe(false);
    expect(whyOff('projector', off)).toBe('switched_off');
    const granted = input({ overrides: { off: [], grant: ['projector'] } });
    expect(effectiveFeatures(granted).has('projector')).toBe(true);
    // switched off wins over a grant: it's the host's event
    expect(
      effectiveFeatures(input({ overrides: { off: ['projector'], grant: ['projector'] } })).has('projector'),
    ).toBe(false);
    expect(whyOff('projector', input())).toBe('plan');
    expect(whyOff('seating', input())).toBeNull();
  });

  it('admins have everything this deployment offers, and nothing it doesn’t', () => {
    const available = new Set<Feature>(FEATURES.filter((f) => f !== 'face_albums'));
    const admin = input({ admin: true, available });
    expect(effectiveFeatures(admin).has('checkin')).toBe(true);
    expect(effectiveFeatures(admin).has('face_albums')).toBe(false);
    expect(whyOff('face_albums', admin)).toBe('unavailable');
  });

  it('stored overrides keep known features only, once', () => {
    expect(readOverrides({ off: ['seating', 'seating', 'nope', 3], grant: 'x' })).toEqual({
      off: ['seating'],
      grant: [],
    });
    expect(readOverrides(null)).toEqual({ off: [], grant: [] });
  });
});

describe('what this deployment offers', () => {
  it('all but the switched-off ones, the AI ones without a model, and the face albums until approved', () => {
    let on = deploymentFeatures(env as never);
    expect(on.has('seating')).toBe(true);
    expect(on.has('gallery_ai')).toBe(false);
    expect(on.has('translate_ai')).toBe(false);
    expect(on.has('face_albums')).toBe(false);
    on = deploymentFeatures({
      ...env,
      ANTHROPIC_API_KEY: 'k',
      INVITES_AI_MODEL: 'm',
      INVITES_FACE_ALBUMS: true,
      INVITES_FEATURES_OFF: ['projector'],
    } as never);
    expect(on.has('gallery_ai')).toBe(true);
    expect(on.has('face_albums')).toBe(true);
    expect(on.has('projector')).toBe(false);
  });
});

describe('the host’s features API', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const OWNER = '22222222-2222-4222-8222-222222222222';
  function deps(): FlagDeps & { overrides: { off: Feature[]; grant: Feature[] } } {
    const state = { overrides: { off: [] as Feature[], grant: [] as Feature[] } };
    return {
      ...state,
      input: async (id) =>
        id === ID
          ? { ownerId: OWNER, plan: 'pro', admin: false, overrides: state.overrides, available: ALL }
          : null,
      setOff: async (id, owner, feature, off) => {
        if (id !== ID || owner !== OWNER) return null;
        state.overrides = {
          ...state.overrides,
          off: off ? [...state.overrides.off, feature] : state.overrides.off.filter((f) => f !== feature),
        };
        return state.overrides;
      },
    };
  }

  it('shows the owner each feature: on, or why not and which package has it', async () => {
    const res = await getEventFeatures(OWNER, ID, deps());
    expect(res.status).toBe(200);
    expect(res.body.features).toContain('live_gallery');
    expect(res.body.items).toContainEqual({ feature: 'checkin', on: false, why: 'plan', package: 'vip' });
    expect((await getEventFeatures('33333333-3333-4333-8333-333333333333', ID, deps())).status).toBe(404);
    expect((await getEventFeatures(OWNER, 'nope', deps())).status).toBe(404);
  });

  it('switches a feature off for the event and back on', async () => {
    const d = deps();
    const off = await setEventFeature(OWNER, ID, { feature: 'live_gallery', off: true }, d);
    expect(off.status).toBe(200);
    expect(off.body.features).not.toContain('live_gallery');
    const on = await setEventFeature(OWNER, ID, { feature: 'live_gallery', off: false }, d);
    expect(on.body.features).toContain('live_gallery');
    expect((await setEventFeature(OWNER, ID, { feature: 'nope', off: true }, d)).status).toBe(400);
    expect((await setEventFeature(OWNER, ID, { feature: 'seating', off: 'yes' }, d)).status).toBe(400);
    expect(
      (
        await setEventFeature(
          '33333333-3333-4333-8333-333333333333',
          ID,
          { feature: 'seating', off: true },
          d,
        )
      ).status,
    ).toBe(404);
  });
});
