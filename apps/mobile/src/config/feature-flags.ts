/**
 * Build-time feature switches.
 *
 * These are hard-coded on purpose, NOT remote (PostHog) flags: a switch here
 * guarantees what a shipped binary or OTA bundle can do, and no dashboard
 * change, network failure or stale cache can turn the feature back on.
 */

/**
 * Weather forecast (Discover weather strip, start-ride pre-flight checklist).
 *
 * OFF because the only provider wired up, Open-Meteo's free endpoint
 * (`api.open-meteo.com`), is licensed for non-commercial use only and
 * MotoVault sells subscriptions — see issue 272. While this is `false` the
 * app must make ZERO requests to Open-Meteo: `useWeatherForecast` returns a
 * disabled state without resolving location or fetching, `fetchForecast`
 * refuses to run, and every weather surface hides itself.
 *
 * To re-enable: point `fetchForecast` (hooks/use-weather-forecast.ts) at a
 * commercially licensed provider, then flip this to `true`.
 *
 * Typed as `boolean` (not the literal `false`) so TypeScript keeps type-checking
 * the enabled branches instead of treating them as unreachable.
 */
export const WEATHER_ENABLED: boolean = false;

/**
 * Ride-moment paywall teasers (docs/plans/2026-10-10-1621-feat-ride-moment-paywall-plumbing-plan.md).
 *
 * OFF = shadow phase: every ride summary evaluates eligibility and emits
 * `ride_paywall_teaser_evaluated` with `would_show`, but no card renders and no
 * paywall opens. Flip to `true` only once Rider Insights has shipped its Pro
 * groups (plan R14); flipping it back off is the over-the-air kill switch (R13).
 */
export const RIDE_TEASER_LIVE: boolean = false;
