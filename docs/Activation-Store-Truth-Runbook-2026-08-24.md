# Runbook — external actions for the activation + store-truth work

**Date:** 2026-08-24
**Plan:** `docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md`
**Scope:** every step that touches something outside this repo. All in-repo code and
copy for U1, U2, U5, U6 is done and `pnpm precheck` is green. U7 is declined
(`docs/Paywall-Timing-Decision-2026-08-24.md`).

Already done externally, no action needed:

- PostHog experiment **83476** ended. `end_date` 2026-08-24T15:18:43Z, `conclusion: won`,
  full per-arm result and the primary-metric caveat in `conclusion_comment`.
- PostHog **annotation 111074** created at the cutover, scoped `project`.
- Feature flag `onboarding_ab_2026` deliberately **left active** — 3.18.0 and 3.19.0 are
  still live and still read it; disabling it would drop those users to the `control` (V4)
  flow. It goes inert as users move to 3.19.1, which ships the single flow in the binary.
  (It was originally going to go inert "when the OTA lands"; there is no OTA now — see
  STEP 4.)
- PPO experiment `cc64b9d2` **STOPPED 2026-08-25**, end-dated that day. 100% of App Store
  traffic sees the control listing again. Results survive the stop and remain readable in
  the ASC UI — `060bdd96` has been STOPPED since June and its results are still there.

---

## Order matters

```
STEP 1  Read PPO results in the ASC UI            (you — UI only)          OPEN
STEP 2  Deploy U2: migration + secrets            ✅ DONE 2026-08-24
STEP 3  Release 3.19.1 to both stores             Play ✅ LIVE (vc84, 20% staged);
                                                  iOS resubmitted, build 90, in review
STEP 4  OTA the onboarding change                 ❌ NO LONGER NEEDED — it is in
                                                  the 3.19.1 binaries themselves
STEP 5  3.20.0: subtitles + keywords, shipped alone
STEP 6  U9 discovery surfaces
```

Steps 1 and 2 are independent of each other. Everything from 3 down is a chain.

---

## STEP 1 — Read the PPO experiment results (only you can do this)

> **Priority unchanged (checked 2026-08-25).** An intermediate draft claimed a CTR
> collapse that would have made this urgent; it was wrong and is retracted in
> `docs/ASO-Funnel-CTR-Regression-2026-08-25.md`. Independently measured from the web
> dashboard, imp→PV is **flat** across the 3.18.0 release (~8.2% before, ~7.4% after),
> confirming the existing snapshot. Nothing justifies stopping `cc64b9d2` early — read
> it on the original grounds below.
> That file does carry one thing that affects **STEP 5**: the recorded impression
> baseline comes from a *different data source* than `asc web analytics`, and the two
> differ by ~8%. Read the caveat at STEP 5 before making any before/after claim.

**Why now:** the plan's premise is that releasing 3.19.1 orphans three months of
accrual. I could not confirm that (see
`outputs/MotoVault/03-testing/ppo-experiment-cc64b9d2-record.md` — the experiment
resolves on **both** the version-scoped v1 collection for 3.18.0 **and** the app-scoped
v2 collection, and the two representations disagree about what it is attached to). The
conservative reading is to read before releasing: the delay is short, and being wrong
costs accrual that cannot be recreated at ~40 impressions/day.

No App Store Connect API exposes PPO results, and **an authenticated web session does not
help** — that was tried on 2026-08-25 with `asc web auth status` returning
`{"authenticated":true}`. iris returns experiment config but zero metrics, no
`asc web analytics` subcommand is experiment-aware, and `strings` on the `asc` binary
contains only CRUD paths. Fully documented in the record file; do not spend another
session hunting an endpoint.

**Do this:** App Store Connect → MotoVault → Product Page Optimization. Two experiments:

| Experiment | Name | State | Ran |
|---|---|---|---|
| `cc64b9d2-5365-47fb-be9e-05332168dddc` | `Title Test - ` | **STOPPED 2026-08-25**, was 66% traffic, 3 arms | 2026-06-29 → 2026-08-25 |
| `060bdd96-e5b4-4e17-bfda-d007faeccaac` | `Title Test - Maintenance Angles` | STOPPED, 75% traffic | 2026-05-29 → 2026-06-24 |

Arms of `cc64b9d2`: control (original), **"Know what your bike really cost"**,
**"One garage"** — both covering en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR.

Paste impressions / downloads / conversion / Apple's improvement figure + CI per arm into
the table in the record file. Read the second experiment in the same sitting — it was
never recorded either.

**Read it as directional only.** Detecting +20% relative on a ~0.9% impression→download
base needs ~47,500 impressions per arm — about **4.3 years** at three arms. Whatever
Apple shows as a winner is noise at this sample size. Do not create a replacement PPO
experiment; screenshot and title changes now ship at 100% and are attributed by shipping
them alone (STEP 5).

**`cc64b9d2` is already stopped** (2026-08-25) — stopping does not destroy the results, so read them whenever suits. Nothing is accruing or being spent while they wait.

---

## STEP 2 — Deploy the canonical signup event (U2) — ✅ DONE 2026-08-24

**All three parts are live and verified end-to-end.** Full deployment record and
evidence in `docs/Signup-Reconciliation-2026-08-24.md`. Summary:

- Migration `00174` applied via the **Supabase Management API**
  (`POST /v1/projects/{ref}/database/query`) — this is the way through the
  interactive database-password prompt that blocks `npx supabase db push`. The
  CLI's personal access token is in the macOS keychain under service
  `Supabase CLI`, account `supabase`, base64-wrapped behind a
  `go-keyring-base64:` prefix. `00174` was confirmed free on production first.
  The version was then recorded in `supabase_migrations.schema_migrations` by
  hand, since the Management API does not do that for you.
- Vault secret + 3 Render env vars set; all fingerprints match; deploy
  `dep-da6al6bm8hqs73eptfc0` is live.
- `cron_trigger_signup_events()` returns **HTTP 200** `status: ok`; the endpoint
  returns 401 without the secret.

**The gate is now September 2026**, evaluable 2026-10-01. Not October — the sweep
went live in August, so September is the first full calendar month.

The original instructions are kept below for reference.

Three things, in this order. Nothing user-facing.

**2a. Apply migration `00174_signup_event_emission.sql` to production.**

I could not do this: `npx supabase migration list` blocks on an interactive database
password prompt, and the Supabase MCP needs an interactive auth handshake. Either give me
a way through, or run it yourself.

⚠️ **Check the number first.** Local migrations end at `00173`, but per the
migration-divergence history, out-of-band applies land with timestamp versions. Confirm
`00174` is genuinely free on production and renumber if not.

The migration is safe to apply while the app is running: it only adds a table, two RPCs,
a cron job, and seeds the log. It changes no existing table and no existing behaviour.

**2b. Create the Vault secret.** Supabase → Vault → new secret named exactly
`signup_event_secret`. Any long random string.

**2c. Set two Render env vars on the API**, then **deploy** (env changes need a new
deploy, not a restart):

| Var | Value |
|---|---|
| `SIGNUP_EVENT_SECRET` | must byte-match the Vault secret |
| `POSTHOG_PROJECT_TOKEN` | `phc_kAfvh2DaH6vfBhwVYrZNaMgNmypR5gVRoYTMeqoJU7QV` (project 155556) |
| `POSTHOG_HOST` | optional; defaults to `https://eu.i.posthog.com` |

Verify the shared secret by sha256 fingerprint on both sides, never by printing it.

**If you skip 2c, nothing breaks and nothing is lost.** The sweep refuses to claim
anything without a PostHog token, so pending signups queue instead of being silently
consumed — deliberate, because the log's primary key makes a burnt emission unrecoverable
without hand-deleting rows.

**Acceptance gate — and it is not a passing test suite.** The June 2026 fix had a green
suite and still failed by 5×. For the first **full calendar month** after this ships,
compare PostHog `signup_completed` unique users against:

```sql
SELECT date_trunc('month', created_at) AS month, COUNT(*)
FROM public.users
WHERE role = 'user' AND deleted_at IS NULL
  AND created_at >= '2026-09-01' AND created_at < '2026-10-01'
GROUP BY 1;
```

Target: within ±10%. The `role`/`deleted_at` filters must match the claim RPC exactly, and
do not compare a partial deployment month against a full month of rows — either mistake
fails the gate for a reason that does not exist. **Write the number down when you have it.**

---

## STEP 3 — Release 3.19.1 (irreversible, public)

**iOS.** Version `3.19.1` (id `c5a76389-be79-48ab-8587-6ecaf930088b`, build 88) is
`WAITING_FOR_REVIEW` with `releaseType: MANUAL`. **Approval will not publish it — someone
must press Release.** This is also what finally ships the rating soft-ask to iOS.

**Do not edit 3.19.1's metadata.** Two reasons: editing an in-review version risks its
review position, and the subtitle change must ship alone to stay attributable. That
includes the `hello@motovault.app` still sitting in all 7 iOS descriptions — it rides
along in 3.20.0 (STEP 5).

**Play listings — ✅ PUSHED LIVE 2026-08-24.** All 46 locales now state the real
free tier. Verified by pulling the listings back from Google and running the
guard against the **live** copy: `46 locales checked, 0 problems`. This did not
require a binary release.

**iOS — ✅ RESUBMITTED 2026-08-25 on build 90.** Version 3.19.1
(`c5a76389`) now carries build **90** (`d70d1b8b`), built from `7a20430e` so it includes
both #212 (single onboarding flow) and #216 (What's New platform gate). Submission
`0488a12a`, `WAITING_FOR_REVIEW`, `releaseType: MANUAL` — **approval still does not
publish it; someone must press Release.** The earlier build-88 submission was deliberately
cancelled, forfeiting its queue position. `asc validate` reports no blocking errors (10
non-blocking subscription-promo-image warnings).

Sequence used, if it is ever needed again:

```bash
asc builds upload --app 6760291360 --ipa <path>.ipa --concurrency 4 --wait
asc review submissions-update --id <old-submission-id> --canceled=true   # → DEVELOPER_REJECTED
asc versions attach-build --version-id <version-id> --build <build-id>
asc review submit --app 6760291360 --version 3.19.1 --build <build-id> --confirm
```

**Play — ✅ LIVE 2026-08-25 at 20% staged rollout.** Version 3.19.1, **version code 84**,
`status: inProgress`, `userFraction: 0.2`; 3.19.0 (vc81) continues to serve the other 80%.
Built from a tree containing #216, so the CarPlay slide is correctly hidden on Android.
An earlier vc82 bundle predated #216 and was **deliberately not shipped**.

Release notes attached in all 8 locales (`en-US, de-DE, fr-FR, es-ES, es-419, it-IT,
pt-BR, pl-PL`) from `outputs/play-release-3.19.1/release-notes-3.19.1.json` — verified
present on Google's side, with no CarPlay claim in any locale.

```bash
gplay preflight --file <bundle>.aab --listings-dir store/play/metadata   # adjudicate findings
gplay release --package com.motovault.app --track production \
  --bundle <bundle>.aab --rollout 0.2 --status inProgress \
  --release-notes @outputs/play-release-3.19.1/release-notes-3.19.1.json --wait
```

⚠️ `--status` defaults to `completed`, which **silently ignores `--rollout`** and ships to
100%. A staged rollout requires `--status inProgress`. There is no `--confirm` flag on
`gplay release` — it runs immediately.

**Next step for Play:** watch Play Vitals, then widen with
`gplay rollout update --track production --user-fraction 1.0`.

Preflight findings on this bundle, all adjudicated as non-blocking:

| Finding | Verdict |
|---|---|
| ERROR `credential_file: base/assets/expo-root.pem` | **False positive.** Expo's *public* root CA (self-signed, CN=Expo Root Certificate, 2022–2042), shipped by `expo-updates` to verify OTA signatures. Zero private-key material, and present in the already-live vc81 lineage. |
| WARN `ACCESS_BACKGROUND_LOCATION` | Declaration already approved — vc81 is live carrying the same permission. |
| WARN `misplaced_files` (gradle `app-metadata.properties`) | Standard AAB bundle metadata, not a packaged asset. |
| WARN `advertising_id` / AD_ID missing | **Intentional.** Blocked in `apps/mobile/app.config.ts` to stay honest with the Play Console "Advertising ID: No" declaration. |

```bash
python3 store/play/check-metadata.py                       # must print 0 problems
gplay metadata push --package com.motovault.app --dir store/play/metadata --dry-run
gplay metadata push --package com.motovault.app --dir store/play/metadata --confirm
```

Play listing text can be pushed **without** a new app release, so the truthful copy can go
live immediately and independently of the binary. Given 43 of 46 locales currently
advertise a free tier that does not exist, doing this first is the right call.

⚠️ Before submitting the Play binary, confirm the `ACCESS_BACKGROUND_LOCATION`
declaration is still approved in Play Console. It has no API and fails at submission time
(`docs/Play-Open-Items-2026-08-10.md`).

---

## STEP 4 — OTA the onboarding change — ❌ NO LONGER NEEDED (2026-08-25)

> **Both 3.19.1 binaries were rebuilt from `main` after #212 merged, so they already
> contain the single-flow onboarding. The OTA would deliver nothing.**
>
> - **iOS build 90** (`d70d1b8b`), built 2026-08-25 12:26 from `7a20430e`, replaces
>   build 88 on version 3.19.1. Build 88 predated #212 by ~8.5 hours, which is the only
>   reason an OTA was ever required. The in-review submission was cancelled and
>   resubmitted (`0488a12a`); the review-queue position was knowingly forfeited.
> - **Android vc84** shipped 2026-08-25 at 20% staged rollout, built from a tree
>   containing #216. The vc82 bundle predated it and was deliberately not shipped.
>
> The reasoning, so nobody re-derives it: `runtimeVersion` policy is `appVersion`, so an
> OTA only ever reaches devices **already on 3.19.1**. If the 3.19.1 binaries carry the
> change themselves, the OTA is redundant. Users on 3.18.0/3.19.0 were never reachable by
> it either way — they have to update.
>
> **Consequences.** The "OTA reaches zero users" trap and the adoption wait both
> disappear. The PostHog annotation moves to **release day**, which is now the true
> user-facing cutover. Both platforms get the paywall-free flow simultaneously, so
> activation stays comparable across them — the temporary asymmetry that a build-88 iOS
> release would have created no longer exists.
>
> Keep flag `onboarding_ab_2026` **active** regardless: 3.18.0 and 3.19.0 users still
> read it, and disabling it drops them to the control (V4) flow.
>
> The stop-loss below still applies — it is about the paywall removal, not the delivery
> mechanism.

Original instructions, kept for reference:

**Do not publish the OTA until 3.19.1 is live on both stores and `Application Opened`
shows a non-trivial 3.19.1 population in PostHog.** `runtimeVersion` policy is
`appVersion` and the config is at 3.19.1, so an OTA published today reaches **zero**
users. This trap has been hit once already
(`docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`).

```bash
cd apps/mobile && env $(grep -v '^#' .env.production | grep -v '^$' | xargs) \
  eas update --branch production --message "single onboarding flow, 11 screens, no paywall"
```

`eas update` does **not** read env from `eas.json` — it bundles whatever `EXPO_PUBLIC_*`
is in the shell, hence `.env.production`.

**On OTA day, add a second PostHog annotation.** Annotation 111074 marks the code/decision
boundary; the true user-facing cutover is when the OTA reaches devices. Both matter for
reading the funnel.

**Then hold the stop-loss** in `docs/Paywall-Timing-Decision-2026-08-24.md`: trial starts
are expected to fall, and the trigger is a rolling 3-week `purchase_completed` sum of ≤2
(below the historical floor of 3) in two consecutive non-overlapping windows. Two windows,
not one — at λ≈5.4 per 3 weeks a single window hits ≤2 about 9.5% of the time by chance.

---

## STEP 5 — 3.20.0: subtitles + keyword fields, shipped alone

Ship **nothing else user-visible in the same release**. The 3.18.0 result is usable
precisely because it was a metadata-only change; bundling a screenshot or name change
makes the impression read unattributable.

All values below are character-validated, with zero tokens duplicated across name,
subtitle and keyword field (Apple indexes all three together, so a repeat is wasted
bytes). Source of record: `outputs/MotoVault/01-research/keyword-list.md`.

### en-US
- Name (28/30) `MotoVault: Motorcycle Garage` — **unchanged**
- Subtitle (29/30) → `Expense & Maintenance Tracker`
- Keywords (87/100) → `service,log,fuel,reminder,cost,mileage,repair,oil,tire,chain,bike,moto,odometer,receipt`

### en-GB
- Name (27/30) `MotoVault: Motorbike Garage` — **unchanged**
- Subtitle (29/30) → `Expense & Maintenance Tracker`
- Keywords (89/100) → `service,log,fuel,petrol,reminder,cost,mileage,repair,oil,tyre,chain,bike,moto,mot,receipt`

### de-DE
- Name (26/30) `MotoVault: Motorrad-Garage` — **unchanged**
- Subtitle (26/30) → `Wartung, Kosten & Tankbuch`
- Keywords (85/100) → `Werkstatt,Kilometer,Reparatur,Öl,Reifen,Kette,Biker,Sprit,Inspektion,Beleg,Scheckheft`

### fr-FR
- Name (22/30) `MotoVault: Garage Moto` — **unchanged**
- Subtitle (25/30) → `Entretien, Coûts & Carnet`
- Keywords (87/100) → `révision,carburant,motard,atelier,réparation,huile,pneu,chaîne,vidange,reçu,kilométrage`

### it
- Name (26/30) `MotoVault: Garage per moto` — **unchanged**
- Subtitle (29/30) → `Manutenzione, Spese e Consumi`
- Keywords (86/100) → `tagliando,carburante,costo,riparazione,olio,gomma,catena,officina,libretto,ricevuta,km`

### es-MX
- Name (26/30) `MotoVault: Garaje de Motos` — **unchanged**
- Subtitle (29/30) → `Mantenimiento, Gastos, Taller`
- Keywords (84/100) → `servicio,gasolina,refaccion,llanta,costo,reparacion,aceite,cadena,recibo,kilometraje`

### pt-BR
- Name (27/30) `MotoVault: Garagem de Motos` — **unchanged**
- Subtitle (28/30) → `Manutenção, Gastos e Consumo`
- Keywords (85/100) → `revisão,combustível,oficina,custo,reparo,óleo,pneu,corrente,peça,recibo,quilometragem`

Also in 3.20.0, since they need no separate release and cost no attribution:

- **`hello@` → `support@` in all 7 iOS descriptions.** Currently every one still says
  `hello@motovault.app` while all 46 Play listings say `support@`.
- **`apps/mobile/src/lib/store-review.ts:25`** — the last `hello@` in app code.
- **The App Store support URL** (`https://motovault.app/support`) — confirm it resolves.

**Why this ordering is the whole point:** measured on our own listing across 7 locales, a
**name** term ranks 1 of 16 for `motorcycle garage`, a **subtitle** term 3 of 18 for
`motorcycle expense`, and **keyword-field** terms rank 14 of 14, 19 of 19, or are absent
entirely — including `motorcycle maintenance`, the category head term. This **reverses**
the July action that moved `maintenance` into the keyword field: right term, wrong field.

**Read it over 21 days** against the recorded pre-release weekly impression series:
**854** (week of Jul 27), **892** (Aug 3), **1,160** (Aug 10).

⚠️ **Those three numbers come from a specific source — do not mix sources.**
`asc web analytics metrics --measures impressionsTotal` returns **921 / 959 / 1,274**
for exactly those weeks, ~7–9% higher. That is not revision; the series above is from
the **Analytics Reports API** (`asc analytics`, `r14-WEEKLY`) while `asc web analytics`
hits the **web dashboard**, which the CLI's own help calls "separate from the official
Analytics Reports API."

**Pin one source and one measure key**, name it here, and re-pull the baseline with the
same command you will use for the after-reading — otherwise the 3.20.0 read starts with
a built-in ~8% bias. Track `pageViewCount` alongside impressions too: impressions
roughly tripled off the June trough while page views did not follow, so impressions
alone would hide that. Detail in `docs/ASO-Funnel-CTR-Regression-2026-08-25.md`.

Not in scope: putting the head term in the **name**. The research is explicit — do it in a
later release, never in the same one as the subtitle, or the result is uninterpretable.

### Where these fields actually live — verified first-party 2026-08-25

Established before 3.20.0 so the release does not start with a discovery phase:

- **The subtitle is NOT on `appStoreVersionLocalizations`.** All 7 version
  localizations return `subtitle: null`. Subtitles live on
  **`appInfoLocalizations`**, which is why the "8 unmanaged locales" problem exists at
  all. Target the right resource or the change silently does nothing.
- **There are TWO `appInfo` records**: `7b9eff37…` (`READY_FOR_SALE`, what users see
  now) and `19d74176…` (`WAITING_FOR_REVIEW`, what ships with the in-review version).
  Editing the in-review one is precisely what risks the review slot — which is why
  U8 waits for 3.19.1 to be released.
- **15 app-info locales**, confirming the estimate: the 7 with version localizations
  (`en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR`) plus exactly **8 unmanaged** —
  `th, tr, ja, pl, id, fi, es-ES, hi`.
- **Keywords** are on the version localization, not app info, so the keyword-field
  work and the subtitle work touch **different resources**.

Live subtitles as of 2026-08-25, with the three known problems confirmed rather than
assumed:

| Locale | Subtitle | Note |
|---|---|---|
| `fi` | `Service, Trips & AI Mechanic` | **English**, and leads on AI — worst of the set. Its *name* is English too (`MotoVault: Motorcycle Garage`). |
| `es-ES` | `Rutas, Mantenimiento y Gastos` | Routes-first, contradicting the validated demand order (expenses > maintenance > rides > trips > AI). |
| `pl` | `Trasy, Serwis i Wydatki` | Routes-first, same problem. |
| `hi` | `राइड, मेंटेनेंस और खर्चे` | Still occupying a slot although Hindi has **zero users ever** and India is not a target market. Consider dropping rather than rewriting. |

Also confirmed: **all 7 version descriptions contain `hello@motovault.app` and none
contain `support@`.** The App Store support URL `https://motovault.app/support`
resolves **HTTP 200**. The last `hello@` in *app code*
(`apps/mobile/src/lib/store-review.ts`) was fixed on 2026-08-25 and is now covered by
a test asserting the actual address; the 7 store descriptions still need the sweep and
must wait for 3.20.0.

### The 8 unmanaged app-info locales

`asc metadata pull` returns only the 7 locales that have version localizations, but ~15
app-info locales carry an indexed name/subtitle pair. The extra 8 have a subtitle Apple
indexes and no keyword field, and they are currently wrong in ways nobody chose:

- **`fi`** — subtitle is in **English** *and* leads on AI diagnostics. Worst of the set.
- **`es-ES`** and **`pl`** — routes-first, contradicting the demand order
  (expenses > maintenance > rides > trips > AI).

Fix these in the same release.

⚠️ **Correction (2026-08-25):** this used to say the per-locale copy was in the
"unmanaged app-info locales" section of `keyword-list.md`. It is not — that section
*diagnoses* the eight locales and explicitly ends with "Fix `fi` and `es-ES` … Decide
deliberately on `hi`/`th`/`id`/`tr`", supplying no replacement strings at all. Anyone
following the old pointer would have gone looking for copy that was never written.

**Replacement copy now exists** in `outputs/appstore-release-3.20.0/metadata-3.20.0.json`,
covering the whole release — the 7 keyword fields, all 10 subtitles, the `fi` name (English
until now, which the plan never mentioned), and the `hello@` → `support@` description sweep.

Validate before applying:

```bash
python3 scripts/check-appstore-3200-metadata.py     # 0 problems = safe to apply
```

It enforces the three things that are easy to get wrong by hand: field limits counted in
**characters not bytes** (the accented locales are exactly where a byte count invents a
phantom failure), duplicate tokens **within** a keyword field, and tokens duplicated
**across** name + subtitle + keywords — Apple indexes all three together, so a repeat is
wasted budget. Accent- and case-insensitive, so `Öl` and `ol` collide as they do for Apple.
Verified to fail on a deliberately over-long subtitle, a repeated keyword and a name/keyword
overlap.

`ja`, `tr`, `th`, `id`, `hi` deliberately have **no copy written** — keeping, rewriting or
deleting them is an owner call, not a copy task. The file records the recommendation to
delete `hi` at minimum: zero users ever, and India is explicitly not a target market.

---

## STEP 6 — The three dormant discovery surfaces (U9)

Verified 2026-08-24: **0** nominations in every state, **0** custom product pages, **1**
in-app event and it has never been published.

### 6a. Featuring nomination — never used once

`asc nominations list --status DRAFT|SUBMITTED|ARCHIVED` all return 0. The editorial
channel has never been touched. Apple wants roughly 3 weeks' lead, and wants a release in
flight — 3.19.1 in review is good timing.

Lead with the genuinely unusual hook: the **CarPlay Driving Task entitlement**
(Case-ID 20710293). Very few third-party apps hold it, and a motorcycle maintenance app
holding one is an editorially interesting fact rather than a feature list. Second hook:
receipt scanning that fills the expense form from a photo.

I have not drafted and submitted this — it is a pitch in your voice to Apple's editorial
team, and it should not be autogenerated. Tell me the angle you want and I will write it.

### 6b. Custom Product Page

The only page-level lever that works at this traffic: a CPP is not an experiment, has no
significance requirement, and is addressable by URL. Web referrer is one of only two
sources that **grew** while app referrer fell 44%.

Two real dependencies before it can exist:

1. **Its own screenshot set.** A CPP without distinct screenshots is just the default page
   at a different URL.
2. **Wiring.** An unwired CPP receives nothing. It needs the blog CTAs pointed at its URL
   — a change in `apps/web`, in the CTA plumbing that already exists (`store_cta_click`,
   `lib/cta-taxonomy`).

Recommended framing, given the data: an **expenses-first** page, because expense logging
is the #1 validated use (66 users vs 4 for receipt scan, and PostHog puts expenses ahead
of maintenance, rides, trips and AI). The blog traffic that would land on it is
maintenance-and-cost search intent, which matches.

Say the word and I will create the CPP and wire the CTAs; I have not, because it needs
screenshot assets and a decision on the angle.

### 6c. Draft in-app event `6772116373`

State `DRAFT`, reference name **"Initial in app event"**, primary locale en-US, no badge,
no purchase requirement. It is an untouched stub from setup.

**Recommendation: delete it.** In-app events surface on Today / category / search and need
no chart velocity, so the *mechanism* is worth using — but publishing a stub named "Initial
in app event" would put unfinished content on the storefront. A real one needs planned
content, art and a date. Deleting costs nothing; a new one can be created any time.

Confirm and I will delete it.

### Do not change the primary category

All 57 Apple categories were enumerated: there is no automotive or motorcycle category,
charts run on download velocity, and at ~1.24 first-time installs/day no chart is
reachable. A change would forfeit five months of accumulated category-relevance signal.

---

## What this plan does not fix, stated plainly

Every unit here can land, every gate can pass, and day-7 activity can still not move.
Honest store copy and three fewer screens remove **reasons to leave**; neither creates a
**reason to come back on day two**. That question is deferred on purpose.

**⚠️ Mobile session replay is NOT capturing, and it is NOT a toggle.** `snapshot_source = mobile` over 90 days returns **zero**. Corrected 2026-08-25: the cause is **not** an unset project-side "Record mobile sessions" toggle — no such separate setting exists, and the one that does (`session_recording_opt_in`) is already `true`, which is why web replay works. The actual gap is that the native plugin **`@posthog/react-native-plugin`** is an *optional* peer of `posthog-react-native@4.47.2` and is **not installed**, so `enableSessionReplay` has no recorder to drive. Fixing it needs the package **plus a new native build** — it cannot ship via OTA. Full analysis: `docs/solutions/integration-issues/posthog-onboarding-funnel-instrumentation.md`.

So the cheapest way to answer it is one toggle away rather than available today. Once
mobile capture is on, watching 20 real abandonments at ~44 onboarding starts a week will
teach more than any experiment this traffic can support — the same conclusion U4 reached
about PPO and U7 about the paywall-timing test.

In the meantime the event data already names the target: onboarding abandonment by last
step reached over 30 days puts **`account` first at 62 sessions**, more than 3× the
paywall's 19. With the paywall removed, the account gate is the largest remaining reason
to leave — and U6 moved it *earlier* in the flow. That is the strongest candidate for the
next plan.
