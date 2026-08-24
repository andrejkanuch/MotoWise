# Next-session prompt — Play hygiene for vc 81 + locale coverage decision

Copy everything below the line into a fresh session.

---

Start by pulling the newest `main` (PR #196, the Expo SDK 57 / RN 0.86 upgrade, was
squash-merged as `9515e8ca`; `chore/expo-sdk-57-upgrade` is done and can be deleted).
Work from a new branch off `main`.

## Context you can trust (verified 2026-08-10, don't re-derive)

- `com.motovault.app` **versionCode 81 / versionName 3.19.0** is live on the Play
  **internal** track, status `completed`. Edit ID `01313589684005103277`.
- Production is still **vc 80 / 3.17.0**. Beta is stale at vc 71 / 3.13.0. Do **not**
  promote anything to production in this session without asking.
- Release notes for vc 81 were published in 8 locales: `en-US, de-DE, fr-FR, es-ES,
  es-419, it-IT, pt-BR, pl-PL`. The exact JSON is committed alongside this file at
  `outputs/play-release-3.19.0/release-notes-3.19.0.json` (every locale verified
  ≤ 500 chars). `hi-IN, th, id, tr-TR, ja-JP` were deliberately left to fall back to
  `en-US`.
- `gplay` CLI is authed via the `default` service-account profile
  (`~/.gplay/piel-play-publisher.json`), which has access to `com.motovault.app`.
  `gplay status --package com.motovault.app --pretty` is the quickest state check.
  Note: this build of `gplay` has **no `--dry-run` flag** on `release`, despite what
  the `gplay-release-flow` skill doc says.

## Task 1 — Commit the phantom 3.19.0 version bump (do this first)

`origin/main` still says `version: '3.18.0'` in `apps/mobile/app.config.ts`. The
`3.19.0` bump was an **uncommitted local edit** that never made it into PR #196, so the
version now sitting on Play does not exist anywhere in git history.

This is not cosmetic. The EAS runtime version policy is `appVersion`, so an OTA
published from `main` as-is would target `3.18.0` builds and **would never reach the
3.19.0 build that is on Play**. Fix the bump on `main`, then confirm what
`apps/mobile/eas.json` / the EAS runtime version resolves to before anyone publishes an
OTA against vc 81.

## Task 2 — Clear the preflight warnings

`gplay preflight --file <aab> --output json --pretty` on vc 81 reported these. Fix them
in `apps/mobile/app.config.ts` / the relevant config plugin so the *next* build is
clean — vc 81 itself is already uploaded and can't be edited.

| Finding | Severity | Action |
|---|---|---|
| `requestLegacyExternalStorage` set but `targetSdk 36` ignores it | warning | Dead config — remove it. |
| `READ_EXTERNAL_STORAGE` declared without `android:maxSdkVersion` | warning | Add `android:maxSdkVersion="32"`; superseded by `READ_MEDIA_*` from Android 13. |
| `SCHEDULE_EXACT_ALARM` | warning | Needs written justification in Play Console, and it's a common rejection reason. Check whether the maintenance-reminder scheduling actually needs *exact* alarms — if `setAndAllowWhileIdle` or WorkManager suffices, drop the permission instead of justifying it. Trace which dependency pulls it in. |
| `SYSTEM_ALERT_WINDOW` | warning | Overlays are heavily restricted and a frequent rejection. Almost certainly pulled in transitively (check the RN dev-menu / a Sentry or Facebook SDK) rather than used deliberately — if nothing uses it, strip it with a manifest `tools:node="remove"`. |

Also **re-verify, don't assume**: `ACCESS_BACKGROUND_LOCATION` requires an approved
Location Permissions declaration plus a demo video in Play Console. 3.17.0 shipped to
production with it, which strongly implies the declaration is already on file — confirm
it is still approved and hasn't expired, since Play periodically requires re-attestation.

For each permission, find the *source* before editing: run
`~/Library/Android/sdk/build-tools/36.1.0/aapt2 dump xmltree --file AndroidManifest.xml`
against the extracted AAB manifest to see the merged result, and grep the plugin
manifests to attribute each one.

## Task 3 — R8 mapping: verify, then almost certainly do nothing

I previously told the user no R8 mapping was uploaded and offered to push one with
`gplay deobfuscation upload`. **That was wrong** — I checked the AAB afterwards and it
embeds `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map` (99 MB), plus
per-ABI native debug symbols under
`BUNDLE-METADATA/com.android.tools.build.debugsymbols/`. Play ingests both
automatically on AAB upload, so Java **and** native crashes on vc 81 should symbolicate
without any manual step.

So: confirm in Play Console (or via `gplay vitals crashes`) that vc 81 stack traces
come back deobfuscated, and only fall back to `gplay deobfuscation upload` if they
don't. Do not upload a mapping speculatively.

Separately, check that **Sentry** has the matching mapping/symbols for vc 81 — Sentry
does *not* get them from the Play upload, it needs its own
`sentry-cli upload-proguard` / debug-file upload during the build. That's a distinct
pipeline from Play and is the more likely gap.

## Task 4 — Decide which languages to actually support (the real thinking task)

The current locale coverage is inconsistent across three surfaces, which is the thing to
resolve:

- **Mobile app** (`apps/mobile/src/i18n/locales/`) — 13: `en, de, fr, es, it, ja, pl,
  pt-BR, hi, id, th, tr, sk`
- **Web** (`apps/web/src/i18n/routing.ts`) — 8: `en, de, fr, es, it, ja, pl, pt-BR`
- **Play Store listing** — 13: `en-US, es-ES, es-419, fr-FR, de-DE, it-IT, pt-BR,
  ja-JP, hi-IN, th, id, tr-TR, pl-PL`

Note the mismatches: mobile ships **Slovak** with no Play listing for it; Play has
**es-419** but mobile has only a single flat `es`; and `hi/id/th/tr` are translated in
the app but disabled on web.

**Pull real data before proposing anything.** Two sources:

1. **Google Play** — `gplay reports stats` downloads the aggregated statistics reports
   from GCS; these break installs down by **country and by language**. That is the
   authoritative install-side signal. `gplay vitals crashes` also accepts a
   `countryCode` dimension if you need a cross-check.
2. **PostHog** — via the `posthog` MCP `exec` tool, query country/locale distribution of
   active users and of the money events. Be careful with two known traps recorded in
   memory: **Slovakia must be excluded** (that's the developer's own usage and it skews
   everything), and `filterTestAccounts` has historically been off on some insights.

Then produce a written recommendation that answers:

- Which locales earn their keep, ranked by actual installs/revenue — not by population.
- Which of the 13 mobile locales should be **dropped** (carrying a stale translation is
  worse than English: it rots and it costs review time). `sk` and, per standing
  guidance, `hi` are the obvious candidates.
- Which new locales are worth **adding**, with the install/revenue evidence for each.
- Whether to split `es` into `es-ES` / `es-419` in the app to match the Play listing.
- The concrete cost per locale: app strings, web pages, Play listing text + screenshots,
  and release notes on every future build.

**Hard constraint from standing project guidance: target markets are Europe and the
Americas only — not India.** So if the Play data shows large Indian or South-East Asian
install volume, the correct read is that those are low-intent installs to *de-prioritise*
or actively exclude, not a translation opportunity. Say so explicitly rather than
ranking by raw volume; if the data genuinely contradicts the Europe/Americas focus,
surface that as a question for the user instead of quietly acting on it.

Deliver the recommendation as a doc under `docs/` with the queries and raw numbers
included, so the next person can re-run it.

## Guardrails

- Do not promote to `production` or `beta`, and do not change the rollout percentage,
  without explicit confirmation.
- Do not publish an OTA update until Task 1 is resolved — the version mismatch means it
  would land on the wrong builds. Remember `eas update` bundles whatever
  `EXPO_PUBLIC_*` vars are in the shell, so it must be run with
  `apps/mobile/.env.production`.
- Any Play Console change should go through `gplay` so it's reproducible and auditable,
  not through the dashboard.
