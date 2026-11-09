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
 * OFF until the paid Open-Meteo plan is live (issue 272). The free endpoint
 * is non-commercial only, so `fetchForecast` now reads the API's
 * `weatherForecast` proxy, which holds the key. While this is `false` the app
 * makes ZERO weather requests: `useWeatherForecast` returns a disabled state
 * without resolving location or fetching, `fetchForecast` refuses to run, and
 * every weather surface hides itself.
 *
 * To re-enable: set OPEN_METEO_API_KEY on the API, deploy it, then flip this
 * to `true` and update weather-disabled.test.ts.
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
