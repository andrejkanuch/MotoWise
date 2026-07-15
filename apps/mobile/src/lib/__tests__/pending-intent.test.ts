import { MileageUnit, MotorcycleType } from '@motovault/types';

// The module under test imports the onboarding store, which transitively pulls
// in MMKV + analytics native SDKs. Stub them exactly as onboarding-store.test.ts.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

jest.mock('../analytics', () => ({
  captureException: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseIntentToken,
  resolveMakeId,
  seedBikeDataFromIntent,
  getIntentCohort,
  isMaintenanceIntent,
  INTENT_COHORT,
  INTENT_TOKEN_TTL_MS,
} = require('../pending-intent');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOnboardingStore } = require('../../stores/onboarding.store');

const MAKES = [
  { makeId: 474, makeName: 'Honda' },
  { makeId: 483, makeName: 'Yamaha' },
  { makeId: 485, makeName: 'Kawasaki' },
  { makeId: 449, makeName: 'BMW' },
  { makeId: 448, makeName: 'Harley-Davidson' },
];

const NOW = 1_700_000_000_000;

describe('parseIntentToken', () => {
  describe('referrer strings (Android)', () => {
    it('parses a full referrer query string', () => {
      const intent = parseIntentToken(
        'utm_source=blog&utm_campaign=blog_maintenance&mv_make=Yamaha&mv_model=MT-07',
      );
      expect(intent).toEqual({
        make: 'Yamaha',
        model: 'MT-07',
        source: 'blog',
        campaign: 'blog_maintenance',
      });
    });

    it('parses a make-only referrer (no model)', () => {
      expect(parseIntentToken('utm_source=tool&mv_make=Honda')).toEqual({
        make: 'Honda',
        model: null,
        source: 'tool',
        campaign: null,
      });
    });

    it('URL-decodes multi-word makes and models', () => {
      expect(parseIntentToken('mv_make=Royal%20Enfield&mv_model=Continental%20GT')).toMatchObject({
        make: 'Royal Enfield',
        model: 'Continental GT',
      });
    });

    it('does not TTL-check referrer strings (no ts required)', () => {
      expect(parseIntentToken('mv_make=Honda&ts=1', NOW)).toMatchObject({ make: 'Honda' });
    });
  });

  describe('clipboard tokens (iOS)', () => {
    it('parses a fresh https token', () => {
      const raw = `https://motovault.app/i?mv_make=Yamaha&mv_model=MT-07&utm_source=blog&ts=${NOW}`;
      expect(parseIntentToken(raw, NOW + 1000)).toEqual({
        make: 'Yamaha',
        model: 'MT-07',
        source: 'blog',
        campaign: null,
      });
    });

    it('rejects an expired token (older than TTL)', () => {
      const raw = `https://motovault.app/i?mv_make=Yamaha&mv_model=MT-07&ts=${NOW}`;
      expect(parseIntentToken(raw, NOW + INTENT_TOKEN_TTL_MS + 1)).toBeNull();
    });

    it('rejects an improbable future timestamp', () => {
      const raw = `https://motovault.app/i?mv_make=Yamaha&ts=${NOW + INTENT_TOKEN_TTL_MS + 1}`;
      expect(parseIntentToken(raw, NOW)).toBeNull();
    });

    it('rejects a token with a missing/garbage ts', () => {
      expect(parseIntentToken('https://motovault.app/i?mv_make=Yamaha', NOW)).toBeNull();
      expect(
        parseIntentToken('https://motovault.app/i?mv_make=Yamaha&ts=notanumber', NOW),
      ).toBeNull();
    });
  });

  describe('garbage / edge inputs → null', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace', '   '],
      ['non-string', 42],
      ['random text', 'hello world'],
      ['no make key', 'utm_source=blog&mv_model=MT-07'],
      ['blank make', 'mv_make=&mv_model=MT-07'],
      ['prefix only', 'https://motovault.app/i'],
    ])('%s', (_label, input) => {
      expect(parseIntentToken(input as never, NOW)).toBeNull();
    });
  });
});

describe('resolveMakeId', () => {
  it('matches case-insensitively', () => {
    expect(resolveMakeId('yamaha', MAKES)).toBe(483);
    expect(resolveMakeId('YAMAHA', MAKES)).toBe(483);
    expect(resolveMakeId('  Harley-Davidson  ', MAKES)).toBe(448);
  });

  it('returns null for an unknown make', () => {
    expect(resolveMakeId('Peugeot', MAKES)).toBeNull();
  });

  it.each([
    ['null make', null],
    ['empty make', ''],
    ['empty list', 'Yamaha', []],
  ])('%s → null', (_label, name, list = MAKES) => {
    expect(resolveMakeId(name as never, list as never)).toBeNull();
  });
});

describe('getIntentCohort / isMaintenanceIntent', () => {
  const intent = (over: Partial<Record<string, string | null>> = {}) => ({
    make: 'Yamaha',
    model: 'MT-07',
    source: 'blog',
    campaign: null,
    ...over,
  });

  it('classifies a maintenance campaign as the money cohort', () => {
    const i = intent({ source: 'blog', campaign: 'blog_maintenance' });
    expect(getIntentCohort(i)).toBe(INTENT_COHORT.MAINTENANCE);
    expect(isMaintenanceIntent(i)).toBe(true);
  });

  it('maps source to cohort when no maintenance campaign', () => {
    expect(getIntentCohort(intent({ source: 'blog' }))).toBe(INTENT_COHORT.BLOG);
    expect(getIntentCohort(intent({ source: 'tool' }))).toBe(INTENT_COHORT.TOOL);
    expect(getIntentCohort(intent({ source: 'newsletter' }))).toBe(INTENT_COHORT.OTHER);
    expect(getIntentCohort(intent({ source: null }))).toBe(INTENT_COHORT.OTHER);
  });

  it('isMaintenanceIntent is false for null / non-maintenance intents', () => {
    expect(isMaintenanceIntent(null)).toBe(false);
    expect(isMaintenanceIntent(intent({ source: 'tool' }))).toBe(false);
  });
});

describe('seedBikeDataFromIntent', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('seeds bikeData + pendingIntent when the make matches', () => {
    const intent = { make: 'yamaha', model: 'MT-07', source: 'blog', campaign: 'blog_maintenance' };
    const ok = seedBikeDataFromIntent(intent, MAKES, { defaultYear: 2022 });
    expect(ok).toBe(true);

    const { bikeData, pendingIntent } = useOnboardingStore.getState();
    expect(bikeData).toMatchObject({
      year: 2022,
      make: 'Yamaha', // canonical casing from the make list, not the referrer
      makeId: 483,
      model: 'MT-07',
      type: MotorcycleType.STANDARD,
      currentMileage: 0,
      mileageUnit: MileageUnit.KM,
    });
    expect(pendingIntent).toEqual(intent);
  });

  it('seeds an empty model for a make-only intent', () => {
    const ok = seedBikeDataFromIntent(
      { make: 'Honda', model: null, source: 'tool', campaign: null },
      MAKES,
      { defaultYear: 2020 },
    );
    expect(ok).toBe(true);
    expect(useOnboardingStore.getState().bikeData?.model).toBe('');
  });

  it('does NOT seed and returns false when the make is unknown', () => {
    const ok = seedBikeDataFromIntent(
      { make: 'Peugeot', model: 'Metropolis', source: 'blog', campaign: null },
      MAKES,
    );
    expect(ok).toBe(false);
    expect(useOnboardingStore.getState().bikeData).toBeNull();
    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
  });

  it('honours the profile mileage unit when provided', () => {
    seedBikeDataFromIntent({ make: 'BMW', model: null, source: null, campaign: null }, MAKES, {
      defaultYear: 2021,
      mileageUnit: MileageUnit.MI,
    });
    expect(useOnboardingStore.getState().bikeData?.mileageUnit).toBe(MileageUnit.MI);
  });
});
