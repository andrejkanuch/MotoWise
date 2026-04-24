import { getScreenIndex, ONBOARDING_SCREENS, TOTAL_SCREENS } from '../config/onboarding';

describe('onboarding config', () => {
  it('has 10 screens', () => {
    expect(TOTAL_SCREENS).toBe(10);
    expect(ONBOARDING_SCREENS).toHaveLength(10);
  });

  it('starts with welcome and ends with welcome-home', () => {
    expect(ONBOARDING_SCREENS[0].route).toBe('index');
    expect(ONBOARDING_SCREENS[0].key).toBe('welcome');
    expect(ONBOARDING_SCREENS[TOTAL_SCREENS - 1].route).toBe('welcome-home');
    expect(ONBOARDING_SCREENS[TOTAL_SCREENS - 1].key).toBe('welcomeHome');
  });

  it('has the correct V2 screen order', () => {
    const routes = ONBOARDING_SCREENS.map((s) => s.route);
    expect(routes).toEqual([
      'index',
      'rider-type',
      'your-bike',
      'bike-photo',
      'preferences',
      'goals',
      'notifications',
      'building',
      'paywall',
      'welcome-home',
    ]);
  });

  it('has 4 sections: A, B, C, D', () => {
    const sections = [...new Set(ONBOARDING_SCREENS.map((s) => s.section))];
    expect(sections).toEqual(['A', 'B', 'C', 'D']);
  });

  it('marks skippable screens correctly', () => {
    const skippable = ONBOARDING_SCREENS.filter((s) => s.canSkip).map((s) => s.route);
    expect(skippable).toEqual(['your-bike', 'bike-photo', 'notifications', 'paywall']);
  });

  describe('getScreenIndex', () => {
    it('returns 0 for welcome (index)', () => {
      expect(getScreenIndex('index')).toBe(0);
    });

    it('returns 1 for rider-type', () => {
      expect(getScreenIndex('rider-type')).toBe(1);
    });

    it('returns correct index for each screen', () => {
      expect(getScreenIndex('your-bike')).toBe(2);
      expect(getScreenIndex('bike-photo')).toBe(3);
      expect(getScreenIndex('preferences')).toBe(4);
      expect(getScreenIndex('goals')).toBe(5);
      expect(getScreenIndex('notifications')).toBe(6);
      expect(getScreenIndex('building')).toBe(7);
      expect(getScreenIndex('paywall')).toBe(8);
      expect(getScreenIndex('welcome-home')).toBe(9);
    });
  });
});
