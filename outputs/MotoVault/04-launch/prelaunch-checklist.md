# MotoVault — per-release ASO gate

**This is not a pre-launch checklist.** MotoVault has been live since
2026-03-20. This is the gate **every store release passes through**, on both
platforms, every time. Run it top to bottom on the day you submit.

App Store id `6760291360` · Play package `com.motovault.app` ·
Locales: iOS 7 (`en-US`, `en-GB`, `de-DE`, `fr-FR`, `it`, `es-MX`, `pt-BR`) ·
Play 46 (source of truth: `store/play/metadata/`).

Last run: **2026-08-24, for 3.19.1 (build 88)**.

---

## Gate 0 — Lever isolation (fails the release, not just the item)

The 90-day calendar (`timeline.md`) exists to keep each change attributable. One
release train changes **one** class of lever. This gate is the enforcement.

- [ ] Name the lever this release changes: `keywords/text` **or** `screenshots/icon`. Not both.
- [ ] Everything in the other class is **byte-identical** to the live version. Prove it,
      don't assume it — pull the live metadata and diff:
      ```bash
      asc metadata pull --app 6760291360 --version <LIVE_VERSION> --dir ./aso-live
      asc metadata plan --app 6760291360 --version <NEW_VERSION> --dir ./aso-next
      ```
      `plan` writes a review artifact showing exactly which fields change. Read it.
- [ ] No live PPO or Play Store Listing Experiment is running on the lever being changed.
      Check it, don't recall it — experiment *config* is queryable even though results are not:
      ```bash
      asc product-pages experiments list --v2 --app 6760291360
      asc product-pages experiments view --id <EXPERIMENT_ID>
      asc product-pages experiments treatments list --experiment-id <EXPERIMENT_ID>
      ```
      Known history: `060bdd96` ("Title Test – Maintenance Angles") at **75%** traffic
      through 2026-06-24, nothing 06-25 → 06-28, then `cc64b9d2` ("Title Test", 3 arms)
      at **66%** from 2026-06-29 to 2026-09-27. Both vary **screenshots** — PPO cannot
      vary text, whatever the experiment is named. A screenshot change before 09-27
      rewrites `cc64b9d2`'s control.
- [ ] **Custom Product Pages are exempt from this gate.** A CPP is a separate page
      served only to traffic on its own URL: it cannot contaminate the default page's
      read window and needs no version release. It still goes through App Review, so
      run Gates 1 and 3 against its copy and assets.
- [ ] The previous release's read window has closed (21 days after it went live).
      If it has not, this release is either a code-only hotfix or it waits.

**Code-only hotfixes are always allowed inside a read window.** That is the whole
reason code and store copy are separated here. A crash fix with zero metadata
delta does not contaminate anything.

---

## Gate 1 — App Review metadata accuracy (the trap we already fell into)

The 3.18.0 description shipped three claims that were false against the shipped
product. Each is a live rejection risk under App Review **2.3.1** (accurate
metadata) and **3.1.2** (subscription disclosure). Re-verify every one of these
against `packages/types/src/constants/limits.ts` on **every** release — the
constants change and the copy does not follow automatically.

Current values, read from source on 2026-08-24:

| Constant | Value | Copy must never claim |
|---|---|---|
| `FREE_TIER_LIMITS.MAX_BIKES` | **1** | "unlimited bikes free", "add all your bikes free" |
| `FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH` | **1** | "5 AI scans per month", any number ≠ 1 |
| `FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH` | **3** | any number ≠ 3 |
| `FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH` | **2** | any number ≠ 2 |
| `GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS` | **1** | "free GPX export" without the limit |
| `AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH` | **3** | any number ≠ 3 |
| `AI_FEATURE_LIMITS.FREE_RIDE_SUMMARIES_PER_MONTH` | **2** | any number ≠ 2 |

- [ ] Every numeric free-tier claim in every locale's description, promo text and
      What's New matches the table above. Grep the metadata JSON for digits and check each hit.
- [ ] **No price appears anywhere in localized store copy.** Not in the
      description, not in promo text, not in What's New. A localized listing is
      served across many territories, so a USD figure is wrong in most of them —
      this is the same failure that put MXN prices in the `es-ES` Play listing.
      Live `paywall_v4` for reference only: iOS monthly $9.99 / annual $79.99 /
      lifetime $149.99, Play annual $59.99. Reference, not copy.
- [ ] Auto-renew / subscription terms disclosed in the description (3.1.2) without
      quoting a figure. Point at the paywall, not at a number.
- [ ] **The free promise is stated and true**: logging maintenance and expenses is
      free forever, never paywalled, never count-limited. If a release ever
      contradicts that, the release is wrong, not the copy.
- [ ] AI diagnostics are **not** the hero and appear **last** in any feature list.
      PostHog demand order is expenses > maintenance > rides > trips > AI, and AI is
      the least-used feature.
- [ ] No claim about a feature that is not in the attached build. CarPlay and
      Receipt Scan are in the 3.19.x tree; verify before promoting either.

---

## Gate 2 — Metadata mechanics

- [ ] `asc metadata validate` passes on the canonical files (offline char-limit and
      shape check) before anything is pushed.
- [ ] All 7 iOS locales present for every field being changed. A missing locale
      silently falls back to `en-US` and the localized listing quietly degrades.
- [ ] Keyword field length checked per locale. **Unused characters are wasted
      indexing.** 3.19.1 shipped en-US 94, en-GB 96, de-DE 95, fr-FR 96, it 93,
      es-MX 92, pt-BR 93 of 100 — 4–8 free characters per locale left on the table.
- [ ] Keywords do not repeat words already in the title or subtitle (Apple indexes
      those separately; repetition burns characters).
- [ ] No terms targeting non-markets. Target markets are **Europe + Americas only**.
      IN / TR / PH / TH / VN appear in impressions organically; do not court them.
- [ ] Locale-correct vocabulary spot-checked: en-GB "tyre"/"petrol"/"Motorbike",
      es-MX not es-ES, pt-BR not pt-PT.
- [ ] Support and marketing URLs resolve (200, not a redirect chain).
- [ ] **Support address is `support@motovault.app`** — decided 2026-08-24, canonical
      everywhere. Store copy, App Store support URL, privacy policy, web footer and
      `apps/mobile/src/lib/store-review.ts:25` (`FEEDBACK_EMAIL`, still
      `hello@motovault.app`) must all agree. Keep `hello@` as a live alias
      indefinitely — it has been given out in public.

---

## Gate 3 — Screenshots (only on a screenshot-lever release)

- [ ] Order follows the demand order: **Expenses → Maintenance → Receipt Scan →
      Rides → Trips → Discover → Crew.** The live `motovault-v2` set is currently
      mis-ordered (Trips → Rides → Expenses #3 → Maintenance #4).
- [ ] 6.9"/6.7" (1290×2796) set present — required.
- [ ] Captions legible at store-thumbnail size.
- [ ] Frames show the **shipped** UI of the attached build, not a mockup or a stale build.
- [ ] Localized caption sets updated wherever they exist, not just en-US.
- [ ] Understand before shipping: **this change is not measurable.** At ~12.4 page
      views/day, a 21-day window holds ~260 observations and the minimum detectable
      change on a 10% base is roughly ±5pp. Ship it on the demand-order argument and
      read it directionally over six weeks. A null read is not a failure.

---

## Gate 4 — Release mechanics

- [ ] Build uploaded, processed, and **attached to the version**
      (`asc versions attach-build`). A prepared version with no build attached
      cannot be submitted.
- [ ] What's New written in **all 7 locales**, each naming a rider-visible change —
      never "bug fixes and improvements" alone.
- [ ] `releaseType` checked deliberately. **3.19.1 is `MANUAL`: Apple approving it
      does not publish it.** Someone must run `asc versions release` or press the
      button in ASC. This is how a release sits approved and invisible.
- [ ] Demo account for App Review present and its garage is pre-populated so a
      reviewer sees value on first screen: `test@test.com` / `testClient123`.
- [ ] Export-compliance / encryption declaration current.
- [ ] Privacy nutrition labels match actual data use (RevenueCat, PostHog, Supabase, Sentry).
- [ ] Availability = Europe + Americas.
- [ ] Crash-free rate healthy in the outgoing build (Sentry + ASC). ~65% of
      first-time installs already delete; do not add churn on top of it.

---

## Gate 5 — Cross-store parity

The two stores diverged and it cost three weeks of a shipped feature reaching
nobody: the rating soft-ask merged `c5fb8253` on 2026-08-03 into the 3.19.x tree,
Play shipped 3.19.0, the App Store stayed on 3.18.0, and
`runtimeVersion: appVersion` means an OTA built from `main` cannot reach a 3.18.0
user. The soft-ask therefore delivered to **zero iOS users**.

- [ ] Live version on both stores recorded, and the gap named if there is one.
      ```bash
      curl -s "https://itunes.apple.com/lookup?id=6760291360&country=us" \
        | python3 -c "import json,sys;d=json.load(sys.stdin)['results'][0];print(d['version'],d['currentVersionReleaseDate'])"
      ```
- [ ] If a **code** feature is being counted on for an ASO outcome, confirm which
      store versions actually carry it. "Merged to `main`" is not "reaching users",
      and an OTA update only reaches builds whose `appVersion` matches.
- [ ] Play listing changes mirrored into `store/play/metadata/` (source of truth,
      46 locales). Play limits are **characters, not bytes**.
- [ ] Play release cut within a week of the iOS release, or the divergence is
      recorded as a deliberate decision with a reason.

---

## Gate 6 — Baseline capture (so the release can be read at all)

Do this **before** the release goes live. Without a saved pre-release baseline
the read window 21 days later has nothing to compare against.

- [ ] Impressions/day, imp→PV, PV→DL from the **WEEKLY** analytics instances —
      never summed across DAILY instances (see `05-optimization/ongoing-tasks.md`
      for why that multi-counts).
- [ ] First-time installs/day and deletes, from r6.
- [ ] Ratings count + average per territory:
      `asc reviews ratings --app 6760291360 --all` (the `--all` matters; querying
      only the 8 localized storefronts is what produced the false "1 rating"
      baseline and missed every positive rating).
- [ ] Written-review queue at zero: `asc reviews --app 6760291360 --only-unresponded`.
- [ ] `currentVersionReleaseDate` recorded immediately after release — that date is
      the divider for every before/after comparison of this release.

---

## Submission decision

| Gate | Blocking? |
|---|---|
| 0 · Lever isolation | **yes — void the read, void the release** |
| 1 · Metadata accuracy vs `FREE_TIER_LIMITS`, no prices | **yes — rejection risk** |
| 2 · Metadata mechanics, 7 locales, one support address | **yes** |
| 3 · Screenshots (screenshot releases only) | yes, when in scope |
| 4 · Release mechanics incl. `releaseType` | **yes** |
| 5 · Cross-store parity | no — but record the gap |
| 6 · Baseline capture | **yes — no baseline, no read** |

**Ship rule:** a release that changes two lever classes at once, or that ships a
free-tier claim not verified against `packages/types/src/constants/limits.ts`, does
not go out. Everything else is negotiable.
