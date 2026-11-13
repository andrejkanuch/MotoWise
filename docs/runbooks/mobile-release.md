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

   Keep the two-arm run even when the PostHog flag serves a single arm (after the
   2026-11-15 decision, for example). An install that cannot ask PostHog (EEA, UK and
   CH riders before consent, or a flag fetch that fails or times out) still draws
   on the device from `ONBOARDING_EXPERIMENT.ASSIGNABLE` in
   `apps/mobile/src/config/onboarding.ts`, so riders can still get either arm. In
   that state, set the simulator's region to an EEA country, so analytics stays off
   before consent and each install draws on the device; otherwise the flag never
   serves the other arm and the gate cannot pass. Switch to
   `EXPECTED_ARM=<that arm>` only once `ASSIGNABLE` holds that arm alone and
   `ONBOARDING_EXPERIMENT.KILL_SWITCH` names it too: a disabled or unknown flag
   assigns the kill-switch arm. The runner checks this against the checkout it runs
   from, not against the installed app, so run it from the exact commit the build
   was cut from.

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

## #365 release marking

Applies to every production change that carries #365 activation work: a store build
(App Store or Play), a crash/data-loss hotfix OTA, and an API deploy on Render. Its job:
every go-live can be read later, per platform, on the PostHog dashboard
"#365 Activation & frictions". Plan: `docs/research/activation-365/EXECUTION_PLAN.md`
(§0 `{REL}` and reading rule, §3A.0 rules 1–5, §6 release log, §6.1 friction status
table, §9 D2/D17). Ledger: `docs/research/activation-365/experiments.md`.

Not covered here: the checks above still apply to every store build, and the OTA rules in
`docs/runbooks/mobile-ota.md` still apply to every OTA.

### 1. Which path a change takes (owner rule D17)

| Change | Path |
|---|---|
| Any new functionality: features, UI, the experiment, new events or properties, testIDs | **Store build only** (new app version on both stores): 3.29.0 = Release A (T18), 3.30.0 = Release B (T35), then the next store build |
| API code (NestJS) | Render deploy (as before) |
| Database change | Migration applied by the owner (`docs/runbooks/supabase-migrations.md`) |
| An urgent crash or data-loss fix for riders already on a store build | Hotfix OTA, the **only** OTA allowed: `docs/runbooks/mobile-ota.md` → "#365 release marking: crash/data-loss hotfix OTA" |

Never ship a #365 fix, feature or instrumentation by OTA, to any runtime. An OTA reaches
only binaries whose `version` equals its runtime (`runtimeVersion.policy: 'appVersion'`,
`apps/mobile/app.config.ts`) and applies on the next launch, so a new rider's first
session always runs the binary's embedded JS.

### 2. The level: `ACTIVATION_FIX_LEVEL`

`apps/mobile/src/config/activation.ts` holds the level that every PostHog event carries as
`activation_fix_level` (super property, `apps/mobile/src/lib/analytics-release-marker.ts`).

- Change it **only in the cut commit**: the commit a store build is cut from, or the
  publish commit of a hotfix OTA on a runtime ≥ 3.29.0. A feature PR never changes it.
- A hotfix OTA on a runtime **< 3.29.0** has no level: those bases have no
  `activation.ts` (T01 first ships in 3.29.0), T01 is never cherry-picked onto them, and
  no level number is used up (`docs/runbooks/mobile-ota.md` → "#365 release marking").
- Levels: 0 = pre-release JS (dev and E2E builds); 1 = not used; 2 = Release A 3.29.0;
  3 = Release B 3.30.0; 4 and up = later store builds and any hotfix OTA, each taking the
  **next unused number** in plan §6 (a hotfix branch off an older commit must not reuse a
  number `main` already shipped, and the next store cut skips the hotfix's number).
- In the **same cut commit**, fill the `Level` column of plan §6.1 for every spec whose fix
  is in this build. §6.1 is the only record of which level ships which fix (there is no
  map in code).

### 3. Before go-live: the named list of PostHog writes (D2)

The release task (T18, T35, or the hotfix / API task) writes a list headed
**"PostHog writes (D2 named list)"** in its PR body: one line per annotation it will make
(the exact text from step 4), plus any insight or alert it adds. The **implementing agent**
makes these writes itself and records each id in plan §6. The list is shared with the
owner **for information, not for approval**. Make no PostHog write that is not on the list.

Also check before go-live (plan §3A.0 rule 4): T02 recorded a baseline in
`experiments.md` §4 for every spec the release touches.

### 4. On go-live, per platform

Go-live dates:
- **iOS store build:** the day the version is released on the App Store (phased release
  start counts).
- **Android store build:** the day the production rollout starts (put the staged % in the
  §6 notes).
- **Hotfix OTA:** the day it is published to the EAS `production` branch, per platform ×
  runtime it targets.
- **API deploy:** the day the Render deploy is live.

iOS and Android usually go live on different days: do steps a–c once per platform, on its
own day.

**a. PostHog annotation** (project 155556; MCP `annotation-create`, or the PostHog UI →
Annotations). `scope: project`, `date_marker` = the go-live day (ISO 8601, UTC), text:

```
#365 fixes: <platform> <version|runtime+hotfix OTA id|api> lvl <N> — <spec ids>
```

| Field | Values |
|---|---|
| `<platform>` | `android`, `ios`, or `server` for an API deploy |
| `<version…>` | store build: `3.29.0 (vc100)` / `3.29.0 (b112)`; hotfix OTA: `rt 3.28.0 ota <update group id>`; API deploy: `api <short git commit>` |
| `lvl <N>` | the `ACTIVATION_FIX_LEVEL` of that JS; `lvl n/a` for an API deploy and for a hotfix OTA on a runtime < 3.29.0 (no release marker; its §6 level cell is `null`) |
| `<spec ids>` | the friction spec ids whose fix ships, from §6.1 (`FS-…`, `S…`), comma-separated |

Examples (illustrative; build numbers and ids are placeholders):
`#365 fixes: android 3.29.0 (vc100) lvl 2 — FS-M, FS-OB1a, FS-PO2a`,
`#365 fixes: ios rt 3.29.0 ota 1a2b3c4d lvl 4 — FS-PO4b`,
`#365 fixes: server api 5a497a1c lvl n/a — FS-PO1H`.

Check: `annotations-list` (MCP) or the Annotations page shows it, and the count of
`#365 fixes:` annotations equals the count of filled §6 rows (row 0 excluded).

**b. Row in plan §6 "Release log"**: one row per binary per platform, per hotfix OTA ×
runtime, per API deploy. Columns: version / runtime + OTA id / API, go-live date,
platform, level, tasks + spec ids, the annotation id from step a, notes (staged %, E2E run
link, publish branch).

**c. Plan §6.1**: for each spec in the release, set `Release row (§6)` to the new row number
and `Status` to `shipped`. Also add a line to `experiments.md` §7 if the release changes both
arms of the onboarding paywall A/B or of Experiment 1 (D1).

Steps b and c are one docs commit (PR titled `docs(research): #365 release log <row>`).

Three days after a store build's go-live, the FS-M alert (T03b) checks that opens with the
new `$app_version` carry the expected level (target 100%; a mismatch means a wrong cut).

### 5. Reads at 2, 4 and 8 weeks after each go-live

Per §6 row, per platform:

1. Open the dashboard; filter `lvl` = this row's level vs the previous level, the **same
   calendar weeks**, one platform at a time (platform per person, plan §0 `{REL}`).
   For iOS first-session cohorts the same-weeks comparison is n/a (new App Store installs
   always get the newest version).
2. Then the trailing-8-week comparison: harm check, revert only if `d + 1.645·SE < 0` at
   the 4- or 8-week look (P06.3 rule). Mechanical friction metrics are read as counts on
   the new level against their target.
3. Verdicts that are not regressions: a post-release window in November–March is judged
   against a concurrent comparison, and a trailing-8-week drop alone is
   **"no verdict (season)"**; fewer than 30 Android riders on the new level at the 2-week
   read is **"no verdict (thin Android cohort)"** (Android upgrades slowly).
4. S3 (day-2 engaged return) is read in its **24–48 h after first seen** form.
5. Record the read in `experiments.md` §8 (one line per row × platform × read), and in plan
   §6.1 fill the `2-wk` / `4-wk` / `8-wk read` cell; set `Status` to `verified` (target met,
   with the read date), `regressed`, or leave `shipped`.

### 6. Every Monday: weekly DB check

Run the read-only files in `docs/research/activation-365/queries/db/` per that folder's
`README.md` and append one row per file to `experiments.md` §5. When a threshold is
crossed (a target met for its stated weeks, or a regression after a release), add an
annotation `#365 db: <spec id> <what crossed> — week <Monday date>` dated that Monday
(the D2 named list for the weekly check is that one annotation type, `README.md` step 3)
and put its id in that `experiments.md` §5 row. No other PostHog write.
