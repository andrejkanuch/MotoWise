# Runbook: promoting a mobile build to production

A store build that reaches production goes to every new rider. Promoting one is an
owner step. This runbook lists the checks that must pass first.

Source: issue #326. Builds 3.19–3.22 reached new riders without the onboarding
paywall, iOS from 2026-08-24 and Android 3.19.1/3.21.0 until 2026-10-12, and nothing
caught it.

## Required before promoting to production (App Store or Play)

1. **The onboarding paywall E2E passes on the release build.**
   Install the build you are about to promote, or a Release simulator build of the
   same commit, on a booted iOS simulator. Then run:
   ```bash
   DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:onboarding-paywall
   ```
   The flow signs up a fresh account, confirms it with a code, and fails unless the
   onboarding paywall appears where the assigned arm places it:
   - **`commit_first`:** after the account step.
   - **`garage_first`:** on "Open my garage".

   The arm comes from the PostHog flag `onboarding_paywall_2026q4`, so a run covers
   whichever arm the install draws. The script deletes the account on exit. Setup is
   in `apps/mobile/.maestro/README.md`; the iOS AutoFill prerequisite is in
   `onboarding-email-code-signup.yaml`.
2. **Unit tests pass:** run `pnpm verify:mobile`. It includes
   `onboarding-paywall-ab.test.ts`, which fails if an assignable onboarding variant or
   the kill switch has no paywall position.

Do not promote a build that fails either check. A paywall that is missing in
production is caught after the fact by the PostHog alert on onboarding paywall reach,
not before.

An OTA that changes onboarding or paywall code gets the same E2E run before it is
published (`docs/runbooks/mobile-ota.md`).
