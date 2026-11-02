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

   A release build cannot be forced onto an arm: each fresh install draws one from the
   PostHog flag `onboarding_paywall_2026q4`, or on the device when the flag cannot be
   asked. So the script needs one passing run per arm. It repeats the flow, pinned
   first to `commit_first` and then to `garage_first`, until each arm has a passing
   run, with at most 6 runs per arm (`MAX_TRIES`). A run that draws the other arm
   fails the pin and is retried. Expect about four runs in total.

   When the flag serves a single arm to everyone (after the 2026-11-15 decision, for
   example), run it with `EXPECTED_ARM=<that arm>` instead. The other arm can no
   longer be drawn.

   Each run deletes its account on exit; the runner refuses an email that already has
   an account. Setup is
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
