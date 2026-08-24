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
python3 store/play/check-metadata.py                                             # REQUIRED gate — see below
gplay metadata validate --dir store/play/metadata                                # offline, char limits
gplay metadata push --package com.motovault.app --dir store/play/metadata --dry-run
gplay metadata push --package com.motovault.app --dir store/play/metadata --confirm
```

**`check-metadata.py` is not optional, and `gplay metadata validate` is not a
substitute.** `validate` only checks character limits; the repo gate is what enforces
the hardcoded-price, `App Store`, keyword-bearing-title, subscription-disclosure and
mixed-script rules below. It exits non-zero on any violation, so it can gate CI.

Pulling **overwrites** `store/play/metadata`, which is the reviewed source of truth — so
never pull straight over it. Pull into a scratch directory and diff, then copy across
only what you actually intend to adopt:

```bash
tmp=$(mktemp -d)
gplay metadata pull --package com.motovault.app --dir "$tmp"
diff -ru store/play/metadata "$tmp"     # review Console-side drift before adopting any of it
```

A non-empty diff means someone edited the listing in the Play Console, bypassing review.
Reconcile deliberately rather than letting a pull silently revert repo changes.

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
- **State the subscription terms in every locale**: auto-renewal, the 24-hour
  cancellation deadline, and where to manage or cancel. Four pre-existing listings said
  only "cancel anytime in the Play Store" and omitted the rest.
- **A price regex must match the currency symbol on either side of the amount.** The
  first version only caught prefix-`$` and suffix `€/EUR/USD`, so the French listing's
  `3,99 $/mois` passed the gate and shipped.
- **Never write a free-tier number in prose.** 43 of 46 locales advertised a free tier
  that does not ship — 40 promised "unlimited bikes" and "5 AI diagnostic scans per
  month", and fr-FR/id/hi-IN promised 3 AI scans, when the real limits are **1 bike and
  1 AI scan**. Four locales also invented a "trip planner (up to 3 saved routes)" limit
  that exists nowhere in the code. The free-tier sentence is now **generated per locale**
  from `packages/types/src/constants/limits.ts` (see `free_tier_claims.py`) and must
  appear verbatim, so a number cannot drift from the constant that enforces it.
- **Do not trust a scrape to find these.** The audit that first counted the damage
  pattern-matched English-shaped phrasing and reported 31 affected locales, clearing
  pl-PL and hu-HU while both were broken. A later hand survey missed pt-PT because its
  bike word was `motas`. That is why the second-site check is an **allowlist by content
  hash** (`ACKNOWLEDGED_CLAIMS`) rather than a classifier: an unrecognised
  "unlimited"+bike sentence fails CI until a human writes down why it is acceptable.

`check-metadata.py` enforces all of the above. Run it after any bulk edit — and note
that its `EXPECTED_LOCALES` tuple is a deliberate ratchet: adding or removing a locale
means editing that list, so a directory disappearing can never silently shrink the
checked set into a false pass.

### If you change a free-tier constant

The guard **hard-fails** when `limits.ts` disagrees with `AUTHORED_FOR` in
`free_tier_claims.py`, and it will not auto-substitute the new value. That is
deliberate: "1 bike" is singular, and most of these 46 languages inflect the noun by
quantity, so blindly rendering `2` would ship 46 grammatically broken claims that nobody
reviewed. Re-author the affected sentences first, then update `AUTHORED_FOR`.

## Why 46 locales

Store listings are one-time text and feed Play search ranking per language, so breadth
is cheap discovery. This is deliberately **not** the same decision as app UI locales,
which are taxed on every PR by the i18n ratchet (`scripts/check-i18n-new-keys.ts`).
See `docs/Locale-Coverage-Decision-2026-08-10.md`.

Release notes are a separate field and still only exist for 8 locales; the rest fall
back to `en-US`.
