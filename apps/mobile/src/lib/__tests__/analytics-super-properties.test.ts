import {
  buildSuperProperties,
  personPropertiesFrom,
  type SuperPropertySources,
} from '../analytics-super-properties';

const BASE: SuperPropertySources = {
  isPro: false,
  isTrialing: false,
  bikeCount: 2,
  measurementSystem: 'metric',
  ridingGoals: ['maintain_bike', 'track_rides'],
  platform: 'ios',
};

describe('buildSuperProperties', () => {
  it('maps every source to its super property', () => {
    expect(buildSuperProperties(BASE)).toEqual({
      is_pro: false,
      is_trialing: false,
      bike_count: 2,
      measurement_system: 'metric',
      // fixed priority, not tap order
      onboarding_goal_primary: 'track_rides',
      platform: 'ios',
    });
  });

  it('omits bike_count until the garage query has answered (never a fake 0)', () => {
    expect(buildSuperProperties({ ...BASE, bikeCount: undefined })).not.toHaveProperty(
      'bike_count',
    );
  });

  it('keeps a real empty garage as 0', () => {
    expect(buildSuperProperties({ ...BASE, bikeCount: 0 }).bike_count).toBe(0);
  });

  it('omits the goal for a rider who never answered, rather than calling them an explorer', () => {
    expect(buildSuperProperties({ ...BASE, ridingGoals: [] })).not.toHaveProperty(
      'onboarding_goal_primary',
    );
  });
});

describe('buildSuperProperties before RevenueCat answers', () => {
  it('leaves the tier out rather than reporting a Pro rider as free', () => {
    const props = buildSuperProperties({
      isPro: undefined,
      isTrialing: undefined,
      bikeCount: 2,
      measurementSystem: 'metric',
      ridingGoals: [],
      platform: 'ios',
    });
    expect(props).not.toHaveProperty('is_pro');
    expect(props).not.toHaveProperty('is_trialing');
    expect(props).toMatchObject({ bike_count: 2 });
  });
});

describe('personPropertiesFrom', () => {
  it('drops the per-device platform and keeps the rest', () => {
    const person = personPropertiesFrom(buildSuperProperties(BASE));
    expect(person).not.toHaveProperty('platform');
    expect(person).toMatchObject({ is_pro: false, bike_count: 2 });
  });
});
