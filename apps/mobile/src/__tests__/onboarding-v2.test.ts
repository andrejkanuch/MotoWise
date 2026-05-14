import { CompleteOnboardingInputSchema } from '@motovault/types';

// Mock AsyncStorage before importing stores
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  }),
}));

// Mock expo-localization
const mockGetLocales = jest.fn();
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

// Mock analytics
jest.mock('../lib/analytics', () => ({
  AnalyticsEvent: { CHECKLIST_ITEM_COMPLETED: 'checklist_item_completed' },
  trackEvent: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useChecklistStore } = require('../stores/checklist.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  detectCurrency,
  detectMeasurementSystem,
  detectMileageUnit,
} = require('../lib/locale-detection');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPrimaryGoal, GOAL_TO_PLACEMENT } = require('../config/onboarding');

// ---------- Checklist Store ----------

describe('ChecklistStore', () => {
  beforeEach(() => {
    useChecklistStore.getState().reset();
  });

  it('should start uninitialized with empty items', () => {
    const state = useChecklistStore.getState();
    expect(state.initialized).toBe(false);
    expect(state.items).toEqual([]);
    expect(state.completedItems).toEqual([]);
    expect(state.dismissed).toBe(false);
  });

  it('should initialize with goal-matched items first', () => {
    useChecklistStore.getState().initialize(['manage_expenses', 'track_rides']);
    const { items, initialized } = useChecklistStore.getState();

    expect(initialized).toBe(true);
    expect(items.length).toBe(5);
    // Goal-matched items should come first
    const goalRelations = items.map((i: { goalRelation: string }) => i.goalRelation);
    expect(goalRelations[0]).toBe('track_rides');
    expect(goalRelations[1]).toBe('manage_expenses');
  });

  it('should include all items when no goals match', () => {
    useChecklistStore.getState().initialize([]);
    const { items } = useChecklistStore.getState();

    expect(items.length).toBe(5);
  });

  it('should complete an item only once', () => {
    useChecklistStore.getState().initialize(['track_rides']);
    useChecklistStore.getState().completeItem('first_ride');
    useChecklistStore.getState().completeItem('first_ride'); // duplicate

    expect(useChecklistStore.getState().completedItems).toEqual(['first_ride']);
  });

  it('should track multiple completed items', () => {
    useChecklistStore.getState().initialize(['track_rides', 'manage_expenses']);
    useChecklistStore.getState().completeItem('first_ride');
    useChecklistStore.getState().completeItem('first_expense');

    expect(useChecklistStore.getState().completedItems).toEqual(['first_ride', 'first_expense']);
  });

  it('should dismiss checklist', () => {
    useChecklistStore.getState().initialize(['track_rides']);
    useChecklistStore.getState().dismiss();

    expect(useChecklistStore.getState().dismissed).toBe(true);
  });

  it('should reset to initial state', () => {
    useChecklistStore.getState().initialize(['track_rides']);
    useChecklistStore.getState().completeItem('first_ride');
    useChecklistStore.getState().dismiss();
    useChecklistStore.getState().reset();

    const state = useChecklistStore.getState();
    expect(state.initialized).toBe(false);
    expect(state.items).toEqual([]);
    expect(state.completedItems).toEqual([]);
    expect(state.dismissed).toBe(false);
  });

  it('should not reset completedItems on re-initialize', () => {
    useChecklistStore.getState().initialize(['track_rides']);
    useChecklistStore.getState().completeItem('first_ride');
    // Re-initialize (e.g. app restart)
    useChecklistStore.getState().initialize(['track_rides']);

    // Items rebuilt but completedItems preserved
    expect(useChecklistStore.getState().items.length).toBe(5);
    expect(useChecklistStore.getState().completedItems).toEqual(['first_ride']);
  });

  it('should have valid deep links for all items', () => {
    useChecklistStore.getState().initialize([]);
    const { items } = useChecklistStore.getState();

    for (const item of items) {
      expect(item.deepLink).toBeTruthy();
      expect(item.deepLink).toMatch(/^\//);
    }
  });
});

// ---------- Locale Detection ----------

describe('Locale Detection', () => {
  describe('detectCurrency', () => {
    it('should return EUR for German locale', () => {
      mockGetLocales.mockReturnValue([{ currencyCode: 'EUR', regionCode: 'DE' }]);
      expect(detectCurrency()).toBe('EUR');
    });

    it('should return USD for US locale', () => {
      mockGetLocales.mockReturnValue([{ currencyCode: 'USD', regionCode: 'US' }]);
      expect(detectCurrency()).toBe('USD');
    });

    it('should fallback to USD when currencyCode is null', () => {
      mockGetLocales.mockReturnValue([{ currencyCode: null, regionCode: 'XX' }]);
      expect(detectCurrency()).toBe('USD');
    });

    it('should fallback to USD when locales array is empty', () => {
      mockGetLocales.mockReturnValue([]);
      expect(detectCurrency()).toBe('USD');
    });
  });

  describe('detectMeasurementSystem', () => {
    it('should return imperial for US measurement system', () => {
      mockGetLocales.mockReturnValue([{ measurementSystem: 'us', regionCode: 'US' }]);
      expect(detectMeasurementSystem()).toBe('imperial');
    });

    it('should return imperial for UK measurement system', () => {
      mockGetLocales.mockReturnValue([{ measurementSystem: 'uk', regionCode: 'GB' }]);
      expect(detectMeasurementSystem()).toBe('imperial');
    });

    it('should return metric for metric measurement system', () => {
      mockGetLocales.mockReturnValue([{ measurementSystem: 'metric', regionCode: 'DE' }]);
      expect(detectMeasurementSystem()).toBe('metric');
    });

    it('should fallback to regionCode when measurementSystem is absent', () => {
      mockGetLocales.mockReturnValue([{ regionCode: 'US' }]);
      expect(detectMeasurementSystem()).toBe('imperial');
    });

    it('should return metric for non-imperial regions', () => {
      mockGetLocales.mockReturnValue([{ regionCode: 'SK' }]);
      expect(detectMeasurementSystem()).toBe('metric');
    });

    it('should return metric when no locale data', () => {
      mockGetLocales.mockReturnValue([{}]);
      expect(detectMeasurementSystem()).toBe('metric');
    });
  });

  describe('detectMileageUnit', () => {
    it('should return mi for imperial', () => {
      mockGetLocales.mockReturnValue([{ measurementSystem: 'us' }]);
      expect(detectMileageUnit()).toBe('mi');
    });

    it('should return km for metric', () => {
      mockGetLocales.mockReturnValue([{ measurementSystem: 'metric' }]);
      expect(detectMileageUnit()).toBe('km');
    });
  });
});

// ---------- Onboarding Config ----------

describe('Onboarding Config', () => {
  describe('getPrimaryGoal', () => {
    it('should return highest-priority goal', () => {
      expect(getPrimaryGoal(['manage_expenses', 'track_rides'])).toBe('track_rides');
    });

    it('should return just_exploring when no goals selected', () => {
      expect(getPrimaryGoal([])).toBe('just_exploring');
    });

    it('should respect priority order regardless of input order', () => {
      expect(getPrimaryGoal(['just_exploring', 'discover_routes', 'manage_expenses'])).toBe(
        'manage_expenses',
      );
    });

    it('should return single goal when only one selected', () => {
      expect(getPrimaryGoal(['maintain_bike'])).toBe('maintain_bike');
    });
  });

  describe('GOAL_TO_PLACEMENT', () => {
    it('should map all goals to placement strings', () => {
      const goals = [
        'track_rides',
        'manage_expenses',
        'discover_routes',
        'maintain_bike',
        'just_exploring',
      ];
      for (const goal of goals) {
        expect(GOAL_TO_PLACEMENT[goal]).toBeDefined();
        expect(GOAL_TO_PLACEMENT[goal]).toMatch(/^onboarding_/);
      }
    });
  });
});

// ---------- Zod Validation (CompleteOnboardingInput) ----------

describe('CompleteOnboardingInputSchema', () => {
  const validInput = {
    experienceLevel: 'intermediate',
    ridingGoals: ['track_rides', 'manage_expenses'],
    learningFormats: [],
    bikeMake: 'BMW',
    bikeModel: 'R 1250 GS',
    bikeYear: 2024,
    bikeType: 'dual_sport',
    bikeMileage: 500,
    bikeMileageUnit: 'km',
  };

  it('should accept valid complete input', () => {
    const result = CompleteOnboardingInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input (no bike data)', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      experienceLevel: 'beginner',
      ridingGoals: ['just_exploring'],
      learningFormats: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid experienceLevel', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      experienceLevel: 'invalid_level',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid ridingGoals values', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      ridingGoals: ['track_rides', 'NOT_A_REAL_GOAL'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject bikeYear out of range', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeYear: 1800,
    });
    expect(result.success).toBe(false);
  });

  it('should reject bikeModel exceeding max length', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeModel: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject bikeNickname exceeding max length', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeNickname: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid bikePhotoUrl', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikePhotoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid bikePhotoUrl', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikePhotoUrl: 'https://example.com/photo.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID acceptedOemScheduleIds', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      acceptedOemScheduleIds: ['not-a-uuid', 'also-not-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid UUID acceptedOemScheduleIds', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      acceptedOemScheduleIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty acceptedOemScheduleIds array', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      acceptedOemScheduleIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid bikeMileageUnit', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeMileageUnit: 'meters',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative bikeMileage', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeMileage: -100,
    });
    expect(result.success).toBe(false);
  });

  it('should reject bikeMileage exceeding max', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeMileage: 1000000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid bikeType', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      bikeType: 'flying_motorcycle',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid experience levels', () => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      const result = CompleteOnboardingInputSchema.safeParse({
        ...validInput,
        experienceLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid riding goals', () => {
    const goals = [
      'track_rides',
      'manage_expenses',
      'discover_routes',
      'maintain_bike',
      'just_exploring',
    ];
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      ridingGoals: goals,
    });
    expect(result.success).toBe(true);
  });

  it('should reject learningFormats exceeding max of 4', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      learningFormats: ['articles', 'videos', 'quizzes', 'guides', 'extra'],
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid currency', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      currency: 'EUR',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid currency', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      currency: 'DOGECOIN',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid fbclid and eventId', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      fbclid: 'abc123',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject eventId that is not UUID', () => {
    const result = CompleteOnboardingInputSchema.safeParse({
      ...validInput,
      eventId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});
