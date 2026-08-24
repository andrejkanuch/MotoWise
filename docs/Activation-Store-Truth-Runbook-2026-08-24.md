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
  flow. It goes inert when the OTA lands.

---

## Order matters

```
STEP 1  Read PPO results in the ASC UI            (you — UI only)
STEP 2  Deploy U2: migration + secrets            (me, on your go-ahead)
STEP 3  Release 3.19.1 to both stores             (irreversible, public)
STEP 4  Wait for 3.19.1 adoption, then OTA        (the onboarding change lands here)
STEP 5  3.20.0: subtitles + keywords, shipped alone
STEP 6  U9 discovery surfaces
```

Steps 1 and 2 are independent of each other. Everything from 3 down is a chain.

---

## STEP 1 — Read the PPO experiment results (only you can do this)

**Why now:** the plan's premise is that releasing 3.19.1 orphans three months of
accrual. I could not confirm that (see
`outputs/MotoVault/03-testing/ppo-experiment-cc64b9d2-record.md` — the experiment
resolves on **both** the version-scoped v1 collection for 3.18.0 **and** the app-scoped
v2 collection, and the two representations disagree about what it is attached to). The
conservative reading is to read before releasing: the delay is short, and being wrong
costs accrual that cannot be recreated at ~40 impressions/day.

No App Store Connect API exposes PPO results. `asc product-pages experiments` has no
results verb, and the `asc web analytics product-pages` route needs an interactive Apple
ID login with 2FA (`asc web auth status` → `{"authenticated":false}`).

**Do this:** App Store Connect → MotoVault → Product Page Optimization. Two experiments:

| Experiment | Name | State | Ran |
|---|---|---|---|
| `cc64b9d2-5365-47fb-be9e-05332168dddc` | `Title Test - ` | APPROVED (running), 66% traffic, 3 arms | 2026-06-29 → end date already set to 2026-09-27 |
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

Once read, I can stop `cc64b9d2` via the API.

---

## STEP 2 — Deploy the canonical signup event (U2)

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

**Play.** Production is on 3.19.0 (version code 81) and needs its own 3.19.1.
U1's corrected listings for all 46 locales ride along:

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

## STEP 4 — OTA the onboarding change

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

Not in scope: putting the head term in the **name**. The research is explicit — do it in a
later release, never in the same one as the subtitle, or the result is uninterpretable.

### The 8 unmanaged app-info locales

`asc metadata pull` returns only the 7 locales that have version localizations, but ~15
app-info locales carry an indexed name/subtitle pair. The extra 8 have a subtitle Apple
indexes and no keyword field, and they are currently wrong in ways nobody chose:

- **`fi`** — subtitle is in **English** *and* leads on AI diagnostics. Worst of the set.
- **`es-ES`** and **`pl`** — routes-first, contradicting the demand order
  (expenses > maintenance > rides > trips > AI).

Fix these in the same release. Per-locale copy is in the "unmanaged app-info locales"
section of `keyword-list.md`.

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

**⚠️ Mobile session replay is NOT capturing.** Verified 2026-08-24: the project has `session_recording_opt_in: true` and web recordings are arriving today, but filtering to `snapshot_source = mobile` over 90 days returns **zero**. The 2026-06-09 replay fix listed the project-side "Record mobile sessions" toggle as still outstanding and it appears never to have been set. Flip it and confirm recordings arrive BEFORE relying on this. See `docs/Plan-Verification-2026-08-24.md`.

So the cheapest way to answer it is one toggle away rather than available today. Once
mobile capture is on, watching 20 real abandonments at ~44 onboarding starts a week will
teach more than any experiment this traffic can support — the same conclusion U4 reached
about PPO and U7 about the paywall-timing test.

In the meantime the event data already names the target: onboarding abandonment by last
step reached over 30 days puts **`account` first at 62 sessions**, more than 3× the
paywall's 19. With the paywall removed, the account gate is the largest remaining reason
to leave — and U6 moved it *earlier* in the flow. That is the strongest candidate for the
next plan.
