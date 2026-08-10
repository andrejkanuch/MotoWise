# Locale coverage decision — 2026-08-10

Which languages MotoVault should actually support, decided on install and revenue
data rather than population. Every number below is re-runnable; the queries are
included so this can be re-decided in a quarter without redoing the archaeology.

## Recommendation in one line

**Shrink the app from 13 locales to 7** (`en, de, es, fr, it, pl, pt-BR`), drop the
four Play listings that would promise a localized app we no longer ship, leave the
web at 8, and **do not** split `es`. Add nothing yet.

## The three surfaces today, and how they disagree

| Surface | Count | Locales |
|---|---|---|
| Mobile app (`apps/mobile/src/i18n/locales/`) | 13 | `en, de, es, fr, hi, id, it, ja, pl, pt-BR, sk, th, tr` |
| Web (`apps/web/src/i18n/routing.ts`) | 8 | `en, de, fr, es, it, ja, pl, pt-BR` |
| Play store listing | 13 | `en-US, de-DE, es-ES, es-419, fr-FR, it-IT, pt-BR, ja-JP, hi-IN, id, th, tr-TR, pl-PL` |

Mismatches: the app ships **Slovak** with no Play listing and no web pages; Play has
**es-419** but the app has a single flat `es`; and `hi/id/th/tr` are translated in the
app and listed on Play but absent from the web.

## What the data says

Source: PostHog project 155556, mobile events only (`$lib = 'posthog-react-native'`),
**Slovakia excluded** (developer's own usage). Device `$locale` is the right proxy for
app language because the app resolves its language from the device via
expo-localization. Note the whole dataset only starts **mid-April 2026**, so "365 days"
is really ~4 months — the 90d and 365d windows agree, which is what matters.

### App users by language, 90 days

| lang | users | installs | onboarded | logged data | saw paywall | **payers** |
|---|---|---|---|---|---|---|
| en | 662 | 389 | 109 | 32 | 224 | **18** |
| es | 103 | 74 | 16 | 3 | 39 | 0 |
| fr | 49 | 31 | 16 | 4 | 17 | **2** |
| pt | 38 | 26 | 3 | 0 | 7 | 0 |
| it | 36 | 14 | 3 | 1 | 7 | **1** |
| de | 28 | 19 | 9 | 1 | 14 | 0 |
| **nl** | **21** | 13 | 5 | 1 | 10 | 0 |
| zh | 17 | 10 | 3 | 0 | 5 | 0 |
| ar | 14 | 8 | 0 | 0 | 2 | 0 |
| ru | 12 | 8 | 0 | 0 | 2 | 0 |
| **cs** | **11** | 6 | 1 | 0 | 3 | 0 |
| pl | 7 | 5 | 2 | 1 | 4 | 0 |
| hu | 6 | 2 | 1 | 0 | 1 | 0 |
| ro / id / tr | 5 each | 3–4 | ≤1 | 0 | 2–3 | 0 |
| th | 3 | 2 | 1 | 0 | 2 | 0 |
| sk | 2 | 1 | 0 | 0 | 0 | 0 |
| ja | 1 | 0 | 0 | 0 | 0 | 0 |
| **hi** | **0** | **0** | **0** | **0** | **0** | **0** |

Bolded rows are the ones that decide something. Over the full 365-day window the tiny
shipped locales stay tiny and several have gone dormant: `ja` 4 users (last seen
**2026-05-13**), `th` 3 (last 2026-07-21), `id` 9 (last 2026-07-24), `tr` 11 (last
2026-06-23), `sk` 3. **`hi` returns no rows at all** — not one Hindi-locale device has
ever opened the app. India is nonetheless the #2 country by users (67), but every one
of them is on `en-IN`, and they produced 1 payer.

### Revenue is an English-language product

21 payers total. 18 English, 2 French, 1 Italian. Zero from Spanish (103 users),
German (28), Portuguese (38 — one payer at 365d), Polish, or any other locale.
US alone: 402 users → 11 payers.

### Web tells a different story than the app

Localized page trees, 90 days, by URL prefix:

| url locale | visitors | store CTA users |
|---|---|---|
| en (no prefix) | 2799 | **82** |
| es | 124 | **11** |
| pt-BR | 32 | 0 |
| ja | 26 | 0 |
| pl | 22 | 0 |
| fr | 15 | 0 |
| it | 11 | 0 |
| de | 3 | 0 |

Two things worth noticing. Web locale ranking is nearly the **inverse** of app usage —
`ja` (26) and `pl` (22) beat `fr` (15), `it` (11) and `de` (3) on the web while being
the smallest in the app. That is SEO traffic, not product usage, and it is the reason
the web recommendation differs from the app one. And **only English and Spanish pages
produce any store-click intent at all**; the other six localized trees produced zero
across 90 days.

## Decisions

### 1. Mobile: 13 → 7. Drop `hi, ja, id, th, tr, sk`.

Keep `en, de, es, fr, it, pl, pt-BR`.

The cost of a shipped locale here is not the one-time translation — it is a **tax on
every feature PR**. `scripts/check-i18n-new-keys.ts` (wired into `precheck:push` and
the CI `i18n` job) blocks any new `en.json` key that is missing from *any* locale. Each
locale file carries ~2,270 keys, so every one of the 13 is a mandatory translation stop
on every PR that adds copy. Six of them serve a combined 32 users and zero payers.

Per-locale justification:

- `hi` — zero users ever, on either window. Also directly against the standing
  Europe/Americas-only constraint. Unambiguous drop.
- `ja` — 4 users in 4 months, none since 2026-05-13, 0 installs in 90d.
- `id`, `th`, `tr` — 9 / 3 / 11 users, all dormant for 6+ weeks, all outside the target
  markets.
- `sk` — 3 users, and it exists because it is the developer's own language. No Play
  listing, no web pages.
- `pl` is deliberately **kept** despite only 7 app users: it is a target European
  market, it is still active (last seen today), and it has 22 web visitors.

### 2. Play: expand to 46 locales. **Superseded — see the decision note below.**

> **Owner decision, 2026-08-10 (supersedes this section).** Store listings were
> **expanded from 13 to 46 locales**, not cut. The reasoning is sound and the original
> recommendation here was wrong to treat listings like app strings: a listing is
> **one-time text with no recurring cost**, whereas an app locale is taxed on every PR
> by the i18n ratchet. Listings are also the *discovery* surface — they feed Play search
> ranking per language — so breadth is how we find out which languages convert, which is
> exactly the open question. Cheap optionality on the acquisition side, no per-PR drag.
>
> The cut recommendation stands for **app UI strings** (decision 1) and is unaffected.
> The one real trade-off accepted: a listing can now be localized in a language the app
> UI does not offer, which can attract users who then meet an English interface. Watch
> per-locale ratings and uninstalls for the languages outside decision 1's keep-list.
>
> Implementation: `store/play/metadata/` (version-controlled, `gplay metadata push`).

Original recommendation, kept for the record: drop the `hi-IN`, `id`, `th`, `tr-TR`
listings, because once the app stops shipping those UI languages a store listing in
those languages advertises a localized app that does not exist.

### 3. Web: no change. Keep all 8, including `ja`.

`/ja` has 26 visitors in 90 days — small, but these are indexed SEO assets that cost
nothing per PR (web copy is not under the mobile i18n ratchet), and removing locale
routes turns indexed URLs into 404s. Given this repo's history with soft-404s and the
404 contract, deleting live localized routes to save nothing is a bad trade.

### 4. Do not split `es` into `es-ES` / `es-419`.

The Play listing already carries both. In the app, splitting doubles the Spanish
maintenance cost for a language with **103 users and 0 payers**. What the data does say
is that the *variant* is wrong: `es-US` (63 users) is the single largest Spanish locale
and beats `es-ES` (22) three to one, with `es-MX/AR/CO/VE/PA` behind it. So keep one
`es.json` and bias its wording to **neutral/Latin-American** Spanish rather than
Castilian, and treat `es-419` as the priority variant of the two Play listings.

### 5. Add nothing yet — but `nl` is first in line.

Dutch is the largest **unserved** language (26 users / 15 installs over 365d,
NL+BE = 31 users by country) and outranks five locales we currently ship. Czech (13) is
second. Neither has produced a payer. Adding a locale means adopting the per-PR
translation tax permanently, so the trigger should be evidence a locale *converts*:
revisit when any non-English locale shows a `paywall_viewed` → `purchase_completed`
path. Right now none does.

## The uncomfortable finding

Locale coverage is not the growth constraint and this exercise should not be mistaken
for one. English converts at ~2.7% (US: 402 users → 11 payers) and every other language
converts at approximately zero despite 39 Spanish and 14 German users reaching the
paywall. Adding or polishing translations cannot fix a funnel that leaks in its best
language. The value of the decision above is **subtraction** — it removes a per-PR tax
on six locales serving 32 users, freeing attention for the conversion problem
documented in `docs/SEO-Conversion-Plan-2026-07-15.md`.

## What is missing from this analysis

Play's own **installs-by-language** breakdown (`gplay reports stats`) could not be
pulled: it downloads from a GCS bucket and needs `--bucket-id`, which is only
obtainable from Play Console → Download reports → *Copy Cloud Storage URI*. It is not
in `~/.gplay/config.json` and is not derivable from the API. PostHog's `$locale` is a
good substitute (it is the actual device language the app resolves against, which is
what a translation decision hinges on) but it only sees users who opened the app, not
installs that never launched. If the Play numbers materially disagree with the table
above, `hi` is the only conclusion that cannot move — it is zero on every measure.

`gplay vitals crashes query --dimension countryCode` returns `null` for this app
(too little crash volume), so it is not a usable cross-check.

## Re-running this

```bash
# Play / listing state
gplay status --package com.motovault.app --pretty

# Play installs by language — needs the bucket URI from Play Console first
gplay reports stats download --bucket-id <gs://pubsite_prod_rev_...> \
  --package com.motovault.app --type installs
```

PostHog (project 155556, `execute-sql`). Always exclude `SK` and pin
`$lib = 'posthog-react-native'` to separate app from web:

```sql
-- App users + revenue by device language
SELECT
    splitByChar('-', properties.$locale)[1] AS lang,
    uniq(person_id) AS app_users,
    uniqIf(person_id, lower(event) = 'application installed') AS installs,
    uniqIf(person_id, event = 'onboarding_completed') AS onboarded,
    uniqIf(person_id, event IN ('expense_added', 'maintenance_log_added')) AS logged_data,
    uniqIf(person_id, event = 'paywall_viewed') AS saw_paywall,
    uniqIf(person_id, event = 'purchase_completed') AS payers
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND properties.$lib = 'posthog-react-native'
  AND properties.$locale IS NOT NULL
  AND properties.$geoip_country_code != 'SK'
GROUP BY lang
ORDER BY app_users DESC

-- Localized web pages → store-click intent
SELECT
    if(match(splitByChar('/', properties.$pathname)[2], '^([a-z]{2}|pt-BR|es-419)$'),
       splitByChar('/', properties.$pathname)[2], 'en (no prefix)') AS url_locale,
    uniqIf(person_id, event = '$pageview') AS visitors,
    uniqIf(person_id, event IN ('store_cta_click', 'app_store_click', 'store_cta_click_server')) AS store_cta_users
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND event IN ('$pageview', 'store_cta_click', 'app_store_click', 'store_cta_click_server')
  AND properties.$pathname IS NOT NULL
  AND properties.$geoip_country_code != 'SK'
GROUP BY url_locale
ORDER BY visitors DESC
```

Swap `INTERVAL 90 DAY` for `365 DAY` to check whether a small locale is dormant or
merely slow — that distinction is what retired `ja`, `id`, `th` and `tr` above.
