---
title: PostHog reloadFeatureFlagsAsync resolves undefined on failure — a failed fetch looks like "flag off"
category: integration-issues
date: 2026-10-07
tags:
  - posthog
  - feature-flags
  - experiments
  - onboarding
  - mobile
problem_type: integration_issue
component: mobile-analytics
severity: medium
status: resolved
---

# PostHog `reloadFeatureFlagsAsync` resolves `undefined` on failure

## Problem

Onboarding variant assignment (`apps/mobile/src/lib/onboarding-experiment.ts`) asks PostHog for the `onboarding_paywall_2026q4` flag. The design had three outcomes:

- PostHog answers with an arm → use it.
- PostHog answers with anything else (flag disabled, unknown value) → kill switch, `garage_first`.
- PostHog cannot be asked (fetch fails or times out) → uniform on-device 50/50 draw.

The first version treated "cannot be asked" as `catch` (a rejection) plus a 2 s timeout. Three independent reviewers found that a failed request never reaches the `catch`: every offline first launch, PostHog outage or quota-limited project would have landed in the kill-switch arm as `source: fallback`, skewing the arm split and looking identical to a deliberate kill-switch.

## Root cause

In `@posthog/core` (1.32.5, used by `posthog-react-native` ^4.47), `reloadFeatureFlagsAsync` is:

```js
async reloadFeatureFlagsAsync(sendAnonDistinctId) {
  return (await this.flagsAsync({ sendAnonDistinctId }))?.featureFlags;
}
```

and `_flagsAsync` converts a failed request into a resolved `undefined` instead of throwing:

```js
const result = await super.getFlags(...);
if (!result.success) return void this.setKnownFeatureFlagDetails({ ..., requestError: result.error });
```

A quota-limited response returns a body without `featureFlags`, which also makes `reloadFeatureFlagsAsync` resolve `undefined`. Only a hang is a non-result; network/API errors, quota limits and a disabled client all **resolve**.

## Solution

Treat a missing flags map as "PostHog could not be asked", and reserve the default/kill-switch branch for a flags map that is present but does not name a valid value:

```ts
const flags = await withTimeout(posthogClient.reloadFeatureFlagsAsync(), FLAG_FETCH_TIMEOUT_MS, '...');
if (!flags) return { variant: drawLocalVariant(), source: 'local' };   // could not ask
const value = flags[FLAG_KEY];
return isAssignable(value)
  ? { variant: value, source: 'posthog' }
  : { variant: KILL_SWITCH, source: 'fallback' };                       // answered "off"
```

Test it with `reloadFeatureFlagsAsync.mockResolvedValue(undefined)`, not only with a rejection or a hang (`apps/mobile/src/__tests__/onboarding-paywall-ab.test.ts`).

## Related traps in the same experiment

These shaped the design and are not visible from the code alone:

- **Consent-gated regions cannot be assigned by a flag during onboarding.** In EEA/UK/CH the analytics consent screen comes after onboarding, so `isAnalyticsEnabled()` is false for the whole flow and PostHog is never asked. A fixed fallback would put an entire market in one arm; the on-device uniform draw keeps the market mix balanced. Those riders also emit no onboarding events before consent.
- **An OTA cannot enroll fresh installs.** A store install runs the embedded bundle on first launch, which persists the onboarding variant before expo-updates applies a downloaded update (next cold start). Assignment code must ship in a store binary. See `docs/Onboarding-Paywall-AB-2026-10-07.md`.

## Prevention

Whenever code branches on a PostHog flag value, decide explicitly what a missing flags map means; never let `undefined` fall through to the same branch as "flag disabled".
