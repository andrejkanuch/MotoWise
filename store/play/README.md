# Play Store listing metadata

Source of truth for the Google Play store listing text, in 46 locales. Edit the files
here and push; **do not edit listings in the Play Console** — the Console is not
reviewable and drifts silently from the repo.

```
store/play/metadata/<locale>/
  title.txt              max 30 chars
  short_description.txt  max 80 chars
  full_description.txt   max 4000 chars
```

## Workflow

```bash
gplay metadata validate --dir store/play/metadata                                # offline, char limits
gplay metadata push --package com.motovault.app --dir store/play/metadata --dry-run
gplay metadata push --package com.motovault.app --dir store/play/metadata --confirm
gplay metadata pull  --package com.motovault.app --dir store/play/metadata       # overwrite local from Play
```

Limits are **characters, not bytes** — `wc -c` overstates every non-Latin locale by 2-3x
(Devanagari, Thai, CJK, Cyrillic, Greek, Arabic). Count with Python, or just let
`gplay metadata validate` do it.

## Rules that came from real defects

- **No trailing newline in any file.** `gplay` pushes the file bytes verbatim, so a
  trailing `\n` lands inside the store title (caught in a `--dry-run` as
  `title="MotoVault: Garaje Moto\n"`).
- **Never hardcode a price.** Every locale that quoted one was wrong: `en-US` advertised
  "$4 per month or $36 per year", `de-DE`/`it-IT` "3,99 €/35,99 €", and `es-ES` quoted
  **Mexican pesos on the Spain listing** — while Play actually charges 4.99-9.99 monthly
  and 29.99-149.99 annually, varying by region and by which of the 8 live subscription
  products a user is served. Say "the price is shown in the app before you confirm".
- **Say "Google Play", never "App Store".** The `en-US` description told Play users to
  cancel in their App Store settings.
- **Every title must carry a keyword**, not just "MotoVault" — title is the
  highest-weight ASO field on Play. Six locales shipped with the bare app name.
- **Watch for Latin letters inside non-Latin words.** A Serbian line read `миris`
  (Cyrillic + Latin), which no spellchecker in the pipeline would catch.

The QA script that enforces all of the above lives in the commit that added this file;
re-run it after any bulk edit.

## Why 46 locales

Store listings are one-time text and feed Play search ranking per language, so breadth
is cheap discovery. This is deliberately **not** the same decision as app UI locales,
which are taxed on every PR by the i18n ratchet (`scripts/check-i18n-new-keys.ts`).
See `docs/Locale-Coverage-Decision-2026-08-10.md`.

Release notes are a separate field and still only exist for 8 locales; the rest fall
back to `en-US`.
