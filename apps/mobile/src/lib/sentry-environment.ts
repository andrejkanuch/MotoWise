export const SENTRY_ENVIRONMENT = {
  PRODUCTION: 'production',
  E2E: 'e2e',
} as const;

export type SentryEnvironment = (typeof SENTRY_ENVIRONMENT)[keyof typeof SENTRY_ENVIRONMENT];

const KNOWN_ENVIRONMENTS: readonly string[] = Object.values(SENTRY_ENVIRONMENT);

// The `e2e-simulator` EAS profile builds a release bundle of an unmerged branch
// and runs it against the production API, so its errors are not rider errors:
// a query for a field the API has not deployed yet fails validation there by
// design. `eas.json` sets EXPO_PUBLIC_SENTRY_ENVIRONMENT=e2e on that profile so
// those events stay out of the production environment. Anything unset or
// unrecognised is production — a typo must never hide real rider errors.
export function resolveSentryEnvironment(
  raw: string | undefined = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
): SentryEnvironment {
  return raw && KNOWN_ENVIRONMENTS.includes(raw)
    ? (raw as SentryEnvironment)
    : SENTRY_ENVIRONMENT.PRODUCTION;
}
