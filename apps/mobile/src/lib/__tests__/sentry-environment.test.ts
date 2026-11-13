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
    build: Record<string, { extends?: string; env?: Record<string, string> }>;
  };

  // EAS merges `env` down an `extends` chain, so read a profile's env the same way.
  const resolvedEnv = (name: string): Record<string, string> => {
    const profile = build[name];
    if (!profile) return {};
    return { ...(profile.extends ? resolvedEnv(profile.extends) : {}), ...profile.env };
  };

  const isE2eProfile = (name: string) => name.startsWith('e2e-');

  it('has the E2E profiles this guard covers', () => {
    expect(Object.keys(build).filter(isE2eProfile).sort()).toEqual([
      'e2e-android',
      'e2e-android-local',
      'e2e-simulator',
      'e2e-simulator-paywall',
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

  // Owner rule: test runs must not reach RevenueCat, PostHog or Meta (see e2e-build.ts).
  // The only exception is the iOS paywall gate (onboarding-paywall-verify.yaml), which
  // needs the real RevenueCat paywall and PostHog flag, so it writes to production
  // analytics and runs only with the owner's go-ahead. A new e2e-* profile must set the
  // switch, or be added here on purpose.
  const VENDOR_SDKS_ON_ALLOW_LIST: readonly string[] = ['e2e-simulator-paywall'];

  it('switches the vendor SDKs off in every e2e-* profile except the allow-list', () => {
    const guarded = Object.keys(build).filter(
      (name) => isE2eProfile(name) && !VENDOR_SDKS_ON_ALLOW_LIST.includes(name),
    );
    expect(guarded.length).toBeGreaterThan(0);
    for (const name of guarded) {
      expect([name, resolvedEnv(name).EXPO_PUBLIC_E2E_NO_VENDOR_SDKS]).toEqual([name, '1']);
    }
  });

  it('keeps the vendor SDKs on, and the e2e_run tag, in the allow-listed profiles', () => {
    for (const name of VENDOR_SDKS_ON_ALLOW_LIST) {
      expect(build[name]).toBeDefined();
      expect([name, resolvedEnv(name).EXPO_PUBLIC_E2E_NO_VENDOR_SDKS]).toEqual([name, undefined]);
      expect([name, resolvedEnv(name).EXPO_PUBLIC_E2E_RUN]).toEqual([name, '1']);
    }
  });

  it('tags every e2e-* profile with EXPO_PUBLIC_E2E_RUN=1', () => {
    for (const name of Object.keys(build).filter(isE2eProfile)) {
      expect([name, resolvedEnv(name).EXPO_PUBLIC_E2E_RUN]).toEqual([name, '1']);
    }
  });
});
