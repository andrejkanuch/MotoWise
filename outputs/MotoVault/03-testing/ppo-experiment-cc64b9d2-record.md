# PPO experiment record — `cc64b9d2` "Title Test"

Captured 2026-08-24 for U4 of `docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md`.
Everything below marked **(API)** was pulled first-party with the `asc` CLI. Everything marked
**(UI-only)** cannot be read by any App Store Connect API and is outstanding.

## Configuration (API)

| Field | Value |
|---|---|
| Experiment id | `cc64b9d2-5365-47fb-be9e-05332168dddc` |
| Name | `Title Test - ` (trailing space and hyphen are in the real name) |
| App | `6760291360` (MotoVault) |
| Platform | `IOS` |
| State | `APPROVED` — i.e. still running as of 2026-08-24 |
| Traffic proportion | 66% |
| Start | 2026-06-29T17:53:54-07:00 |
| End | 2026-09-27T17:53:54-07:00 (already set — 90 days) |
| Review required | true |
| Treatments | 2, plus the implicit control = **3 arms** |

### Treatments (API)

| Treatment id | Name | Localizations |
|---|---|---|
| `6d12c49d-18e3-4cb3-b871-b630030a4eaa` | "Know what your bike really cost" | en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR |
| `7ced7cbd-a0c8-4188-8c34-34bea101c72a` | "One garage" | en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR |

Both arms cover the same 7 locales — the same 7 that have localized App Store listings.
The localization endpoint returns the locale set but null values for `name` / `subtitle` /
`promotionalText`, so the per-locale copy each arm served is **(UI-only)**.

### Prior experiment, already stopped (API)

| Field | Value |
|---|---|
| Experiment id | `060bdd96-e5b4-4e17-bfda-d007faeccaac` |
| Name | `Title Test - Maintenance Angles` |
| State | `STOPPED` |
| Traffic | 75% |
| Ran | 2026-05-29 → 2026-06-24 |

Its results are also **(UI-only)** and were never recorded. Worth reading in the same sitting
since it is the same lever measured on an earlier listing.

## Correction to the plan's premise

The plan (U4) and the session handoff both state the experiment is "attached to version
**3.18.0**", that "version 3.19.1 has zero experiments attached", and therefore that releasing
3.19.1 **orphans the data** — making the read urgent. The API gives a more complicated answer:

- `GET /v1/appStoreVersions/{3.18.0}/appStoreVersionExperiments` → returns it. **1 result.**
- `GET /v1/appStoreVersions/{3.19.1}/appStoreVersionExperiments` → **0 results.**
- `GET /v1/apps/6760291360/appStoreVersionExperimentsV2` → **also returns it**, carrying a
  `platform: IOS` attribute that the version-scoped v1 representation does not have.

Appearing in the **app-scoped v2 collection with a platform attribute** is the signature of
Apple's newer experiment model, which is scoped to app + platform rather than to a version and
is not supposed to be discarded when a version ships. So the "release destroys it" claim is
**not confirmed** — but it is not refuted either, and the two representations disagree about
what the experiment is attached to.

**Decision: keep the plan's ordering anyway.** Reading before release costs a short delay;
being wrong costs three months of accrual that cannot be recreated at this traffic level. Do
not treat the v2 finding as permission to release first.

Practical consequence: U4 is **not** the hard blocker on U3 the plan describes, so unrelated
work should not wait on it — but the release itself still should.

## Outstanding — requires you (UI-only)

No App Store Connect API exposes PPO results. `asc product-pages experiments` offers
`list` / `view` / `create` / `update` / `delete` / `treatments` and no results verb.

**The authenticated-web-session route was tried on 2026-08-25 and does not work either.**
`asc web auth status` now returns `{"authenticated":true}` after an interactive Apple ID +
2FA login, and it still cannot produce results. Do not spend another session on this:

- `asc web analytics` has 13 subcommands (overview, sources, metrics, retention, cohorts,
  …) and **none** is experiment-aware. `metrics` has no dimension/breakdown flag, so there
  is no way to split a measure by treatment.
- `asc web analytics product-pages` is about **Custom Product Pages**, not PPO. With an
  authenticated session it returns `status: unavailable`, `reason: "App metadata reports
  zero custom product pages, so App Store Connect disables this tab."`
- Apple's internal **iris** API, queried directly with the session cookies
  (`GET /iris/v1/appStoreVersionExperiments/{id}?include=appStoreVersionExperimentTreatments`),
  returns **200** but carries only config: name, trafficProportion, state, dates, and
  per-treatment `name` / `appIcon` / `appIconName` / `promotedDate`. **No metrics of any
  kind.**
- Three plausible analytics result paths were probed and all returned **404**:
  `/analytics/api/v1/data/app/{app}/experiments/{id}`,
  `/analytics/api/v1/data/experiments/{id}`, `/iris/v1/.../{id}/results`.
- Decisive: `strings $(which asc)` contains **only** CRUD paths for
  `appStoreVersionExperiments`, `appStoreVersionExperimentTreatments` and
  `appStoreVersionExperimentTreatmentLocalizations`. There is no results, metrics or
  analytics-experiment path anywhere in the binary.

⚠️ Apple rate-limits the *whole* ASC API after a few hundred analytics calls
(`reference_asc_analytics_pull`), so brute-forcing more endpoint guesses has a real cost.
This is a genuine UI-only read.

Read these in App Store Connect → MotoVault → **Product Page Optimization**, for both
experiments, and paste them into the table below:

- Impressions, per arm
- Downloads (or conversion rate), per arm
- Apple's "improvement" figure and confidence interval, per arm
- Retained-installs figure if shown

### Results (fill in)

| Experiment | Arm | Impressions | Downloads | Conv. | Improvement | CI |
|---|---|---|---|---|---|---|
| cc64b9d2 | Control (original) | | | | — | — |
| cc64b9d2 | Know what your bike really cost | | | | | |
| cc64b9d2 | One garage | | | | | |
| 060bdd96 | Control (original) | | | | — | — |
| 060bdd96 | (treatments) | | | | | |

## How to read the numbers when they arrive

**Directional only.** Detecting a +20% relative lift on the ~0.9% impression→download base
needs roughly **47,500 impressions per arm**. At three arms and this impression rate that is
about **4.3 years**. Whatever Apple displays as a winner at 90 days is noise at this sample
size, and Apple's own UI will say so via the confidence interval. Read it for direction, and
do not let a displayed "winner" justify a copy decision on its own.

**Do not create a replacement PPO experiment.** Per the plan's U4 and the corrected power
arithmetic, screenshot and title changes now ship directly at 100% of traffic. The ability to
attribute a change comes from shipping it *alone* and reading the weekly impression series
(U8), not from an experiment that cannot converge.
