---
title: "Two dependency bots with contradictory rules: Renovate only, one branch"
category: build-errors
date: 2026-08-24
tags: [renovate, dependabot, dependencies, expo, react-native, pod-install, sentry, expo-doctor]
module: repo dependency automation, mobile build pipeline
symptom: "Duplicate dependency branches for the same GitHub Actions digests; a bot bumped react-native ahead of the Expo SDK and broke pod install; expo-doctor failed the duplicate-native-module check"
root_cause: "Dependabot and Renovate both ran for six weeks with contradictory rules; expo and react-native were also declared outside apps/mobile, pinning a different SDK"
---

# Two dependency bots with contradictory rules: Renovate only, one branch

This document holds the narrative that used to live in the root `CLAUDE.md`
("Repo maintenance"). The text of each section is moved from there unchanged. The
one-line rules stay in the instruction files; this is the why.

## The rules

- `renovate.json` is the single source of dependency automation. Do not re-add
  `.github/dependabot.yml`.
- In `renovate.json` the catch-all group goes first and every `enabled: false`
  safety rule after it, because the last matching rule wins.
- `lockFileMaintenance` stays off. Nothing auto-merges.
- GitHub Dependabot **alerts** stay enabled; Dependabot **security updates** stay off.
- `expo` and `react-native` are declared in `apps/mobile` only. Run Expo CLI from
  `apps/mobile`, or through a `pnpm --filter` script for the mobile package.
- `@sentry/react-native` stays in `expo.install.exclude` in `apps/mobile/package.json`
  while it is pinned ahead of what Expo recommends.

## Dependencies: Renovate only, one branch (2026-08-24)

`renovate.json` is the *single* source of dependency automation. `.github/dependabot.yml` was deleted — the repo ran **both** bots for six weeks with contradictory rules (Dependabot had an `expo-and-react-native` group that bumped exactly the packages Renovate disables; that group is how #150 pushed RN ahead of the Expo SDK and broke `pod install`), and each bot opened its own branch for the same GitHub Actions digests. Do **not** re-add `dependabot.yml`. The shape that keeps it to one branch: a catch-all `matchPackageNames: ["*"]` group covering minor/patch/digest across *every* manager, `major.dependencyDashboardApproval` so majors queue behind a checkbox on the Dependency Dashboard issue instead of opening branches, and `lockFileMaintenance` off (Renovate **never** groups lock file maintenance with other updates, so enabling it always adds a second standing branch). Renovate applies `packageRules` in order with **last match winning** — the opposite of Dependabot, where the first matching group wins — so the catch-all group goes **first** and every `enabled: false` safety rule after it. Nothing auto-merges. The one sanctioned second branch is a `vulnerabilityAlerts` PR, which needs GitHub **Dependabot alerts** left enabled (Renovate reads that feed; it has no advisory source of its own here). Dependabot *security updates* stay off — they would reintroduce the duplicate-PR problem.

## `expo` + `react-native` belong to `apps/mobile` ONLY

Never add them to the repo root or `apps/web` — neither runs React Native, and a second declaration pins a *different* SDK (the root and `apps/web` sat on `expo@~56` while mobile moved to 57, and `expo-doctor` failed the duplicate-native-module check for the whole `expo-modules-core` tree). A stray root `app.json` (`{"expo": {}}`) and `android`/`ios` scripts in both manifests came from running `npx expo install` / `expo run:*` outside `apps/mobile` — all removed 2026-08-10. Run Expo CLI from `apps/mobile`, or via `pnpm --filter mobile <script>`.

Correction, 2026-10-10: "all removed" was true of the repo root and of the two
manifests' scripts only. `apps/api/app.json` and `apps/web/app.json`, strays of the same
kind, were still tracked on that date.

## `expo.install.exclude` in `apps/mobile/package.json`

`@sentry/react-native` is pinned **ahead** of Expo's `bundledNativeModules.json` (Expo recommends `~7.11`, we ship `8.x`) — the exclusion stops `expo install --fix` from downgrading it a major version. Re-verify against the [Sentry RN changelog](https://github.com/getsentry/sentry-react-native/blob/main/CHANGELOG.md) on each SDK bump, and drop the exclusion if Expo ever catches up. Exclusions for packages Expo already recommends at the installed version are dead config — `react-native-view-shot` was one and was removed.

## Where the config lives

- `renovate.json` — every rule above carries its own `description` field with the reason.
- `apps/mobile/package.json` — `expo.install.exclude`.
