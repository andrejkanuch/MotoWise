import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSentryEnvironment, SENTRY_ENVIRONMENT } from '../sentry-environment';

describe('resolveSentryEnvironment', () => {
  it('is production when the variable is unset', () => {
    // Called with no argument so the default reads the environment, which this
    // test controls rather than inheriting whatever the shell running Jest set.
    const saved = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    try {
      expect(resolveSentryEnvironment()).toBe(SENTRY_ENVIRONMENT.PRODUCTION);
    } finally {
      if (saved !== undefined) process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = saved;
    }
    expect(resolveSentryEnvironment('')).toBe(SENTRY_ENVIRONMENT.PRODUCTION);
  });

  it('is e2e when the build profile says so', () => {
    expect(resolveSentryEnvironment('e2e')).toBe(SENTRY_ENVIRONMENT.E2E);
  });

  it('falls back to production for an unrecognised value', () => {
    expect(resolveSentryEnvironment('E2E ')).toBe(SENTRY_ENVIRONMENT.PRODUCTION);
    expect(resolveSentryEnvironment('staging')).toBe(SENTRY_ENVIRONMENT.PRODUCTION);
  });
});

describe('eas.json build profiles', () => {
  const { build } = JSON.parse(readFileSync(join(__dirname, '../../../eas.json'), 'utf8')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };

  const isE2eProfile = (name: string) => name.startsWith('e2e-');

  it('has the E2E profiles this guard covers', () => {
    expect(Object.keys(build).filter(isE2eProfile).sort()).toEqual([
      'e2e-android',
      'e2e-android-local',
      'e2e-simulator',
    ]);
  });

  it('tags every e2e-* profile as the e2e Sentry environment', () => {
    for (const [name, profile] of Object.entries(build).filter(([n]) => isE2eProfile(n))) {
      expect([name, profile.env?.EXPO_PUBLIC_SENTRY_ENVIRONMENT]).toEqual([
        name,
        SENTRY_ENVIRONMENT.E2E,
      ]);
    }
  });

  it('leaves every other profile on the production default', () => {
    const others = Object.entries(build).filter(([name]) => !isE2eProfile(name));
    expect(others.length).toBeGreaterThan(0);
    for (const [name, profile] of others) {
      expect([name, profile.env?.EXPO_PUBLIC_SENTRY_ENVIRONMENT]).toEqual([name, undefined]);
    }
  });
});
