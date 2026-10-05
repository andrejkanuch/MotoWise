import {
  buildScreenView,
  FEATURE_AREA,
  featureAreaForSegments,
  routeParamProperties,
  routeTemplateFromSegments,
} from '../analytics-screen';

describe('routeTemplateFromSegments', () => {
  it('keeps groups and dynamic placeholders — the file path, not the URL', () => {
    expect(routeTemplateFromSegments(['(tabs)', '(garage)', 'bike', '[id]'])).toBe(
      '/(tabs)/(garage)/bike/[id]',
    );
  });

  it('names the root index "/"', () => {
    expect(routeTemplateFromSegments([])).toBe('/');
  });

  it('tells same-named screens in different groups apart', () => {
    expect(routeTemplateFromSegments(['(onboarding)', 'scan-receipt'])).not.toBe(
      routeTemplateFromSegments(['(modals)', 'scan-receipt']),
    );
  });
});

describe('featureAreaForSegments', () => {
  it.each([
    [['(tabs)', '(garage)'], FEATURE_AREA.GARAGE],
    [['(tabs)', '(garage)', 'bike', '[id]'], FEATURE_AREA.GARAGE],
    [['(tabs)', '(garage)', 'add-expense'], FEATURE_AREA.EXPENSES],
    [['(tabs)', '(garage)', 'expense-dashboard'], FEATURE_AREA.EXPENSES],
    [['(modals)', 'add-ride-expense'], FEATURE_AREA.EXPENSES],
    [['(modals)', 'scan-receipt'], FEATURE_AREA.EXPENSES],
    [['(tabs)', '(garage)', 'complete-task'], FEATURE_AREA.MAINTENANCE],
    [['(tabs)', '(garage)', 'add-maintenance-task'], FEATURE_AREA.MAINTENANCE],
    [['(modals)', 'ride-hud'], FEATURE_AREA.RIDES],
    [['(modals)', 'ride-summary'], FEATURE_AREA.RIDES],
    [['(tabs)', '(profile)', 'rides'], FEATURE_AREA.RIDES],
    [['ride', '[id]'], FEATURE_AREA.RIDES],
    [['(modals)', 'carplay', 'cues'], FEATURE_AREA.RIDES],
    [['(tabs)', '(discover)'], FEATURE_AREA.DISCOVER],
    [['(modals)', 'trip-detail'], FEATURE_AREA.DISCOVER],
    [['(tabs)', '(profile)', 'trips'], FEATURE_AREA.DISCOVER],
    [['route', '[country]', '[region]', '[slug]'], FEATURE_AREA.DISCOVER],
    [['(tabs)', '(diagnose)', '[id]'], FEATURE_AREA.DIAGNOSE],
    [['(tabs)', '(learn)', 'article', '[slug]'], FEATURE_AREA.LEARN],
    [['(tabs)', '(profile)', 'settings'], FEATURE_AREA.PROFILE],
    [['(tabs)', '(home)'], FEATURE_AREA.HOME],
    [['(auth)', 'login'], FEATURE_AREA.AUTH],
    [['(onboarding)', 'goals'], FEATURE_AREA.ONBOARDING],
    [['(modals)', 'whats-new'], FEATURE_AREA.OTHER],
    [['+not-found'], FEATURE_AREA.OTHER],
    [[], FEATURE_AREA.OTHER],
  ])('%j → %s', (segments, area) => {
    expect(featureAreaForSegments(segments)).toBe(area);
  });

  it('keeps an onboarding screen in onboarding even when its leaf is a feature screen', () => {
    expect(featureAreaForSegments(['(onboarding)', 'scan-receipt'])).toBe(FEATURE_AREA.ONBOARDING);
  });

  it('lets the paywall win over its onboarding group — it is its own funnel', () => {
    expect(featureAreaForSegments(['(onboarding)', 'paywall'])).toBe(FEATURE_AREA.PAYWALL);
  });
});

describe('routeParamProperties', () => {
  it('forwards allowlisted dynamic ids as route_<name>', () => {
    expect(
      routeParamProperties(['route', '[country]', '[region]', '[slug]'], {
        country: 'sk',
        region: 'tatry',
        slug: 'loop',
      }),
    ).toEqual({ route_country: 'sk', route_region: 'tatry', route_slug: 'loop' });
  });

  it('drops share tokens and usernames', () => {
    expect(routeParamProperties(['t', '[token]'], { token: 'secret' })).toEqual({});
    expect(
      routeParamProperties(['(tabs)', '(profile)', 'rider', '[username]'], { username: 'jane' }),
    ).toEqual({});
  });

  it('ignores query params that are not dynamic segments of the route', () => {
    expect(routeParamProperties(['(tabs)', '(garage)', 'add-expense'], { id: 'x' })).toEqual({});
  });

  it('skips a missing value', () => {
    expect(routeParamProperties(['bike', '[id]'], {})).toEqual({});
  });
});

describe('buildScreenView', () => {
  it('names the screen by template and carries area, previous screen and ids', () => {
    expect(
      buildScreenView(['(tabs)', '(garage)', 'bike', '[id]'], { id: 'b-1' }, '/(tabs)/(garage)'),
    ).toEqual({
      name: '/(tabs)/(garage)/bike/[id]',
      properties: {
        feature_area: FEATURE_AREA.GARAGE,
        previous_screen: '/(tabs)/(garage)',
        route_id: 'b-1',
      },
    });
  });
});
