# Play open items — 2026-08-10

Two items that cannot be closed from code. The first is a **live revenue bug** and is the
reason this document exists; the second is a compliance check with no API.

---

## 1. The live paywall's annual plan costs more than paying monthly

**Status: needs a decision. Live right now.**

The app serves `offerings.current` (`apps/mobile/src/lib/subscription.ts` falls back to it
when no placement matches). In RevenueCat that is the offering `paywall_v4`, whose Play
products are:

| Plan | Product | Base plan | US price | State |
|---|---|---|---|---|
| Monthly | `motovault_pro_v4_monthly_v4` | `motovault-pro-monthly-v4` | **$9.99 / month** | ACTIVE |
| Annual | `motovault_pro_v4_annual_v4` | `motovault-pro-v4-annual` | **$149.99 / year** | ACTIVE |

Twelve months at $9.99 is **$119.88**. The annual plan is **$149.99** — so choosing annual
costs **$30.11 (25%) more** than simply paying monthly for a year. The annual discount is
inverted: there is no price at which the annual plan is the rational choice.

EU prices carry the same inversion (DE/ES/FR 154.99 EUR annual vs 9.99 EUR monthly;
IT 159.99 vs 9.99).

**This looks like a typo, not a strategy.** The previous generation priced annual at
`$49.99` (`motovault_pro_v3_annual_v3`), and `$149.99` is `$49.99` with a leading 1.

Price history across generations, for context:

| Generation | Monthly | Annual | Annual vs 12× monthly |
|---|---|---|---|
| original | $9.99 | $59.99 | 0.50× (fine) |
| `_v2` | $4.99 | $29.99 | 0.50× (fine) |
| `_v3` | $7.99 | $49.99 | 0.52× (fine) |
| **`_v4` (live)** | **$9.99** | **$149.99** | **1.25× (inverted)** |

Why this was not fixed automatically: changing a live subscription price is an
outward-facing billing action affecting real customers, and Play/RevenueCat have their own
rules about existing subscribers on a changed price. That is the owner's call.

**Options**

These are two *different* rationales and they do not land on the same number — worth keeping
apart:

- **(a) Correct the suspected typo: annual → $49.99.** Justified by the digit, not by a
  ratio: `$149.99` is `$49.99` with a leading `1`, and `$49.99` is what `_v3` charged. At
  today's $9.99 monthly this is **0.42×** of 12× monthly, i.e. a deeper discount than any
  previous generation gave.
- **(b) Restore the historical 0.5× ratio: annual → $59.99.** 12 × $9.99 = $119.88, so the
  0.5× point is **$59.94** — which is essentially the original generation's $59.99. Pick
  this if the intent is "annual is half price", not "undo the typo".
- **(c) Pick a deliberate round ratio** — e.g. 10× monthly = **$99.90** for the common "2
  months free" framing.
- **(d) Stop offering annual** on the paywall, so users are never shown a plan that is
  strictly worse for them.

**Recommendation: (b), $59.99.** It is the only option justified by the pricing model rather
than by guessing at a keystroke, it matches what this app charged annually before the
discounting experiments, and at the current $9.99 monthly it is the honest "half price"
claim. Choose (a) instead only if you know $49.99 was the intended number.

Note this interacts with the revenue problem recorded in
`docs/SEO-Conversion-Plan-2026-07-15.md`: traffic converting at ~zero is easier to explain
when the headline annual plan is worse value than monthly.

### Secondary: offering sprawl

13 offerings exist, 7 of them `active`, spanning four product generations plus two web
offerings and one `default-web-test`. Only `paywall_v4` is current. The rest are experiment
leftovers (`exp7_pain_copy`, `lower_price`, `v2_claude_design`, `new_offering_4_29`,
`new_offering_4_29_24_4`, `new_offering_4_29_24_4_v2`, …).

Not archived here on purpose: an older app build that requests an offering by identifier
would break if that identifier disappears, so archiving needs a check of which identifiers
shipped builds actually ask for. Worth doing, but deliberately.

Re-run the audit with:

```text
mcp: revenuecat list-offerings  project_id=proj46e69448  expand=[items.package, items.package.product]
gplay subscriptions list --package com.motovault.app --output json
```

---

## 2. `ACCESS_BACKGROUND_LOCATION` — declaration cannot be verified via any API

**Status: manual Play Console check. Genuinely no API.**

The permission is **required and must stay**: background ride recording runs through
`Location.startLocationUpdatesAsync` with a background task
(`apps/mobile/src/utils/ride-location.ts:105`), not a foreground `watchPositionAsync`, and
the manifest correctly declares `FOREGROUND_SERVICE_LOCATION` (mandatory from Android 14).
So this is not a permission to strip — it is a declaration to keep approved.

Everything available was tried and none of it can read the declaration's state:

- `gplay data-safety` exposes only `update` — write-only, no read.
- The Android Publisher API has no app-content/sensitive-permissions resource at all.
- `gplay checks` (Google Checks API) needs a Checks account ID that is not configured and
  is not derivable from the Publisher credentials.
- `gplay preflight` reports the *requirement* ("requires an approved Location Permissions
  declaration and a demo video") but cannot see whether one is on file.

**What to check by hand:** Play Console → the app → **Policy → App content → Sensitive app
permissions → Location permissions**. Confirm the declaration is present and **Approved**
(not "Action required"), and that the linked demo video still resolves — Play periodically
requires re-attestation, and an expired declaration blocks new releases rather than pulling
the live one.

Since 3.17.0 shipped to production with the permission, a declaration is almost certainly on
file; the open question is only whether it is still current. Worth confirming before the next
store build, because it fails at submission time.
