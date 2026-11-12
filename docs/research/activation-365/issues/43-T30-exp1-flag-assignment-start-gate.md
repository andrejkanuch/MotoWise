---
title: "[#365 T30] Exp 1: flag activation_365_first_session, sticky assignment after the paywall, embedded start/stop gate"
labels: [experiment, area:mobile, area:api, area:analytics, activation-365]
order: 43
task_id: T30
depends_on: [T05d, T02]
phase: P3
size: M
release_path: "API deploy (window field) before the 3.30.0 cut, then Release B 3.30.0 (embedded; inactive until the server window opens)"
---

## Context
#365, plan §3 T30, §3A.2 (review item 6), spec FS-EXP1, D1 (hooks into `handleContinue`), D13, D16. Board Experiment 1 [SOURCE: board/99-synthesis.md §4].

## Why
`isFeatureFlagOn` is false whenever analytics is off (`lib/feature-flags.ts:18-25`), so pre-consent EEA/UK/CH installs would all be control; the onboarding experiment solves it with a local draw (`lib/onboarding-experiment.ts` header) — which ignores the flag, so "launch = flag flip" is false for pre-consent installs unless a start gate exists. For `garage_first`, `onboarding_completed` fires before the paywall; the cold-start branch completes without `handleContinue` (`app/(onboarding)/personalizing.tsx:366-371` vs `:389-393`) [SOURCE: R4 §3.4].

## What to change
**API part (deploys first, plan §3A.0 rule 3).** A nullable field `activationExperimentWindow { startAt, stopAt }` (ISO timestamps) on the `User` type returned by the `completeOnboarding` mutation, which the client already calls at onboarding completion (`apps/api/src/modules/users/users.resolver.ts:43-50`, model `apps/api/src/modules/users/models/user.model.ts`; client document `apps/mobile/src/graphql/mutations/complete-onboarding.graphql`). Implement it as a `@ResolveField` in `users.resolver.ts` reading two optional env vars (e.g. `ACTIVATION_EXP1_START_AT`, `ACTIVATION_EXP1_STOP_AT`) validated in `apps/api/src/config/env.validation.ts`; unset start → `null`. The field is nullable, so old clients are unaffected. The API deploy must be live, and `pnpm generate` run on `main`, before the 3.30.0 cut.
Starting the experiment: on the D16 day the owner or the agent sets the start value on Render and triggers a new deploy (env changes need a deploy, memory `project_render_env_needs_deploy`), and the PostHog flag flip happens the same day. Nothing else is needed for pre-consent riders: their local draw starts when the window opens.

**Client part.** `lib/activation-experiment.ts` mirroring `lib/onboarding-experiment.ts:13-40, 67-71`. Add `activationExperimentWindow { startAt stopAt }` to `complete-onboarding.graphql`, keep the value from the mutation result for the assignment call (the cold-start branch uses the stored value). `config/activation.ts` keeps two embedded hard ceilings: `EXP1_STOP_AT = '2027-03-31'` and `EXP1_LATEST_START_AT = '2027-01-06'`. Effective window = the server window, clipped by those ceilings (a server start after 2027-01-06 is ignored; a server stop after 2027-03-31 is cut to 2027-03-31).
- server window null, field missing, or the request failed/unreachable → **not started**: `control`, `source:'pre_start'`, **no exposure event, no local draw**;
- outside [start, stop) → `control`, `source:'pre_start'|'post_stop'`, **no exposure event, no local draw**;
- inside: PostHog multivariate if it answers (`posthog`); flag off/unknown → `control` (kill switch); cannot ask → uniform local draw (`local`).
Sticky `activationArm/AssignedAt/Source/ExposurePending` in `stores/experiment.store.ts:20-68` (version 1 → 2). Assign in one `completeOnboardingAndAssign()` called from `handleContinue` **and** the cold-start branch, only for riders with no real ride; `activation_exposure {experiment, arm, source, onboarding_variant, notifications_granted}` + super property `activation_arm`; pending exposure flushed on consent. Stopping: clear or move the server window (new riders stop being drawn at once); riders already assigned keep their arm (sticky).

## How
- API jest `apps/api/src/modules/users/users.resolver.spec.ts` (new): env unset → `null`; start set → `{startAt, stopAt}`; invalid date rejected at boot by env validation. `pnpm verify:api`; `pnpm generate` after deploy.
- Mobile jest `lib/__tests__/activation-experiment.test.ts`: each source path; window null / request failed → control `pre_start`, no draw, no exposure; server start after 2027-01-06 → not started; server stop after 2027-03-31 → stops at 2027-03-31; before start → control, no exposure; after stop → control; stickiness across relaunch and sign-out; no re-roll; exposure once; pre-consent flush; assignment after the garage_first paywall; 10,000-draw SRM simulation.

## Acceptance criteria
- [ ] API field deployed and live on Render before the 3.30.0 cut (deploy link in the PR); `pnpm generate` committed.
- [ ] Jest (API + mobile) passes; `onboarding-paywall-verify.yaml` both arms green; ledger date (D1) and D13/D16 signed.
- [ ] Crossed (factorial) with `onboarding_paywall_2026q4` and `expd7c1d56904`, never nested (test).

## Verification
`pnpm --filter @motovault/mobile test -- activation-experiment`; `pnpm verify:api`; after deploy, a `completeOnboarding` call on a test account returns `activationExperimentWindow: null` until the start is set.

## Friction spec
FS-EXP1 (assignment). Repro: pre-consent EEA install of Release B while the server window is null (or the API is unreachable). Expected: control, `source:'pre_start'`, no draw, no exposure. Automated check: jest (CI) (fake clock before/after start); maestro `first-ride-plan-card.yaml` in T32.

## Production metric
Exposure by arm × `onboarding_variant` × platform (verbatim `R4…:455-461`); SRM χ² weekly per platform × region; exposure count ≈ completers after start. Tile "FS-EXP1 — exposure and SRM". Annotate the launch (T35).

## Release
API deploy first (window field, null until D16); client embedded in Release B; active only once the server window opens (set on the D16 day, same day as the flag flip, T35).

## Dependencies
- Blocked by: T05d, T02.
- Blocks: T31, T32, T34, T35.

## Out of scope
Arm content (T31, T32, T34).

## Constraints
Paywall A/B untouched; D1, D13, D16; no start after 2027-01-06 and no assignment after 2027-03-31 (embedded ceilings); API field nullable (old clients keep working).
