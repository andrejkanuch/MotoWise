---
title: CI failure from missing i18n translation keys in non-English locales
category: integration-issues
date: 2026-03-25
tags: [i18n, ci, testing, locales, translations]
component: apps/mobile/src/i18n
severity: medium
---

## Problem

CI test job fails with `i18n.test.ts` asserting that non-English locale files are missing keys present in `en.json`. Happens whenever new translation keys are added to `en.json` without updating all 12 other locale files.

Error output:
```
Expected: []
Received: ["profile.ridesEmptyTitle", "profile.ridesEmptySubtitle", "profile.ridesEmptyStartRide", "profile.ridesEmptyAddBike"]
```

## Root Cause

The i18n test (`apps/mobile/src/__tests__/i18n.test.ts`) extracts all keys from `en.json` and asserts every other locale file contains the same keys. Adding keys to `en.json` alone passes lint and typecheck but fails the test job.

This is easy to miss because:
1. Lint and typecheck pass locally — only the test suite catches it
2. The app works fine with missing keys (i18next falls back to English)
3. CI only runs on `push` to `main` or `pull_request` targeting `main`, not on branch pushes

## Solution

When adding new i18n keys to `en.json`, immediately add them to all locale files in `apps/mobile/src/i18n/locales/`:

```
de.json, es.json, fr.json, hi.json, id.json, it.json,
ja.json, pl.json, pt-BR.json, sk.json, th.json, tr.json
```

Keys must be placed in the same nested object (e.g., `"profile"` section) with translated values.

## Prevention

1. **Before committing new i18n keys**, run `pnpm test` locally (or at minimum the i18n test) to catch mismatches early
2. **Treat locale files as a batch operation** — never edit just `en.json`; always update all 13 files together
3. Consider adding a pre-commit hook or lint rule that checks key parity across locales
