# aso-v4 per-market screenshot pipeline: runbook

Real in-app screenshots per market (US MX BR CO ES PH AR FR GB CA AU IT DE), each in that market's
app language, units and currency, with a locally popular bike and the country's iconic road as the
hero ride, composed into store images at the exact store sizes in the owner's canvas design.

Steps marked **[OWNER]** write to production or publish, and need the owner's explicit go-ahead
for that run. Everything else is local and safe to repeat.

```
1 generate SQL ─ 2 local check ─ 3 [OWNER] create accounts + account.sql ─ 4 [OWNER] apply seed
  ─ 5 capture build + preflight + capture ─ 6 compose ─ 7 review ─ 8 [OWNER] upload ─ 9 [OWNER] teardown
```

## Hard rules for every capture run

1. **Nothing reaches RevenueCat.** No `Purchases.configure`, logIn, getCustomerInfo, getOfferings,
   setAttributes or paywall: they show up as spikes in the owner's RC charts.
2. **No analytics.** No PostHog, no Meta events, no PostHog signup event from the server sweep.
3. **No paywall, onboarding paywall, purchase or restore control** is ever reached.
4. **Teardown by SQL + Auth Admin API only**, never the app's delete-account flow (the API's
   `UsersService.cancelSubscription` calls RevenueCat `DELETE subscriber` on that path).

How the pipeline enforces each one:

| Rule | Mechanism | Where |
|---|---|---|
| 1, 2 | The capture build is a LOCAL Release simulator build made with the RC, PostHog and Meta variables set to empty strings in the process environment (Expo's dotenv never overrides a variable already set). With no RC key, `doInit()` in `src/lib/subscription.ts` returns before `Purchases.configure`, and every RC call goes through `initRevenueCat()`/`withRevenueCat()`, which then no-op. With `POSTHOG_API_KEY` empty, `analytics.ts` has no key; with `EXPO_PUBLIC_META_APP_ID` empty, the Meta plugin is not added at prebuild, so the SDK is not linked | §5 build recipe |
| 1, 2 | expo-updates is switched off in the build (`EXUpdatesEnabled = false`), so the app can never load a production OTA, whose bundle has the keys baked in. Never use a store/TestFlight build | §5 build recipe |
| 1, 2 | **`capture/preflight.sh` (static):** refuses unless the installed `.app` (and any Metro bundle on :8081) holds no `appl_`/`goog_`/`phc_` key, none of the exact values from `apps/mobile/.env*` (compared, never printed), no `FacebookAppID`/`FacebookClientToken` in `Info.plist`, and `EXUpdatesEnabled = false` in `Expo.plist` | `capture_market.sh` runs it first; no bypass flag |
| 1, 2 | **`capture/preflight.sh` (network smoke):** launches the app, samples its sockets with `lsof` once a second for 45 s, fails if any remote address is one that `api.revenuecat.com`, `api-paywalls.revenuecat.com`, `api-diagnostics.revenuecat.com`, `{eu,us}.i.posthog.com`, their asset hosts, `graph.facebook.com`, `graph.instagram.com` or `connect.facebook.net` resolve to, and scans the app process's unified log for those names. **Chosen instead of an `/etc/hosts` sinkhole**, which needs sudo and owner approval; the sinkhole (`0.0.0.0 api.revenuecat.com` etc. in the Mac's `/etc/hosts`, which the simulator uses) is the stronger, optional addition. Limits: a socket opened and closed between two samples can be missed (the static check is the primary gate); a CDN address shared with another host fails safe | same |
| 2 | The flows decline the analytics consent prompt; the seed sets `users.preferences.privacy.analyticsEnabled = false`; `account.sql` pre-claims `signup_event_log`, so the 00174/00183 sweep never emits a signup for the account (it waits 10 minutes before claiming, so run `account.sql` right after creating the account) | flows/_signin.yaml, seed.sql, account.sql |
| 3 | The account is onboarded by the seed (`onboarding_completed_at`), so the app never runs onboarding. Flows only use deep links and the Garage tab. After sign-in and after every slot, `flows/_no_paywall.yaml` fails the run if the localized "upgrade unavailable" alert (what any paywall request becomes with RC unconfigured) or "Restore purchases" is visible. The garage's "More bikes with Pro" row is never tapped | capture/flows |
| 4 | `teardown.sql` (same email guard) + `DELETE /auth/v1/admin/users/<id>`; the auth admin delete goes straight to Supabase Auth, not through the API | §9 |

## Layout

| Path | What |
|---|---|
| `SCHEMA.md` | the three input formats (seed-ready market, route GeoJSON, caption copy) |
| `gen_seed_market.py` | `../markets/<CC>.json` + `<CC>-route.geojson` → `out/seed/<CC>/{seed,teardown,account}.sql, ids.json, summary.json`. Never connects to a DB |
| `lib/seedlib.py` | SQL quoting, polylines, OSRM + Open-Meteo with an on-disk cache, the scoped 00137 rollup rebuild |
| `adapt_market.py` | legacy: converted the first research-only market files into seed drafts. The market files now follow SCHEMA.md directly, so it is not needed |
| `capture/preflight.sh` | the RC/analytics/OTA gate above |
| `capture/capture_market.sh`, `capture/labels.py`, `capture/flows/*.yaml` | simulator locale/region/status bar + Maestro flows for the 10 slots |
| `compose/compose.py`, `compose/review_page.py` | store images in the canvas template + manifest + local review page |
| `fixtures/markets/` | stub US (and a CO currency-limit probe) from the first dry run |
| `proof/` | the dry-run outputs (see "Proof" at the end) |

## 1. Generate the SQL (local)

```bash
cd marketing/store-previews/aso-v4/pipeline
python3 gen_seed_market.py <CC> --validate                       # schema + DB-constraint check only
python3 gen_seed_market.py <CC> --user-id <uuid from step 3>     # final SQL
```

- Without `--user-id` the SQL carries a placeholder id and **fails its own guard**, on purpose.
- Ids are uuid5 per market, so a re-run replaces the account's rows. The seed first deletes
  everything the account owns in the seeded tables; the guard refuses unless
  `users.id = <uuid> AND users.email = 'screenshots+<cc>@motovault.app'`.
- Validation fails on what Postgres would reject: a currency outside `chk_users_currency` (00131),
  an expense over 99,999.99 (00036), a purchase price over 999,999.99 (00052), unknown
  categories / service types / waypoint types / bike types.
- Routes (other rides, trip) come from the public OSRM demo server, elevation from Open-Meteo;
  both cached in `out/seed/<CC>/cache/`. `--offline` uses the cache, else synthetic geometry, and
  lists every fallback in `summary.json → geo_fallbacks`. **Never seed with a fallback listed.**
- Review `summary.json`: hero km / moving time / gain / lean, season totals, this year's cost by
  category, the service total. That is what the screens will show.

What the seed writes per account: users (units, currency, display name, city,
`onboarding_completed_at`, analytics off), the `signup_event_log` pre-claim, 1-2 bikes (raw
odometer in mi/km; `distance_unit` set by the 00180 trigger from `measurement_system`), odometer
readings, the dealer service with line items + tax + its linked maintenance expense (no trigger
creates it), older services, overdue + upcoming tasks (absolute `target_mileage`), fixed expenses +
generated fill-ups, the hero ride with ~900 waypoints (speed and lean derived from the road's
curvature), named + filler rides to the season totals, one success-but-unreviewed `receipt_scans`
row (powers the review screen: no AI call, no quota), one private draft trip with stops +
organiser row, then `ride_rollups`/`ride_records` rebuilt from 00137 scoped to the user.

## 2. Check the SQL locally (local, recommended)

The dry run did NOT execute the SQL anywhere (Docker did not respond on this Mac). Every
generated file was parsed with libpg_query (`pglast`, Postgres's own grammar): syntax only, not
constraints or triggers. Before step 4:

```bash
pnpm db:start && pnpm db:reset            # local Supabase with every repo migration
# create a local auth user with the same email, generate with --user-id <local uuid>, then:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f out/seed/<CC>/account.sql
psql … -f out/seed/<CC>/seed.sql
psql … -f out/seed/<CC>/teardown.sql      # must also run clean
```

## 3. [OWNER] Create one account per market, then run account.sql at once

Proposed email: `screenshots+<cc>@motovault.app`; one password per account in the password manager.
Auth Admin API, so no email is sent and the account is confirmed (the prod email limit is 30/h):

```bash
curl -sS -X POST "https://tpsoneenbrmdwvzcbifw.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"screenshots+us@motovault.app","password":"<pw>","email_confirm":true,
       "user_metadata":{"analytics_consent":false}}'          # -> "id"
python3 gen_seed_market.py US --user-id <id>                 # writes account.sql + seed.sql for that id
# within 10 minutes: apply out/seed/US/account.sql (step 4 route)
```

- `account.sql` inserts the `signup_event_log` row and sets analytics off, so the signup sweep
  (00174, 10-minute wait from 00183) never claims the account. `analytics_consent:false` in the
  user metadata is the 00184 fallback if the sweep ever ran first.
- **No RevenueCat at all:** no API calls, no dashboard grants, no promotional entitlements for these
  accounts. Captures are non-Pro by design (see "Pro-gated screens").
- Never use `test@test.com` (it holds the en-US set and the hidden Africa Twin).

## 4. [OWNER] Apply account.sql / seed.sql to production

Management API route (`reference_prod_admin_access_routes` memory, project `tpsoneenbrmdwvzcbifw`):

```bash
TOKEN="$(security find-generic-password -s 'Supabase CLI' -a supabase -w | sed 's/^go-keyring-base64://' | base64 -d)"
python3 - "$TOKEN" out/seed/US/seed.sql <<'PY'
import json, sys, urllib.request
tok, path = sys.argv[1], sys.argv[2]
req = urllib.request.Request("https://api.supabase.com/v1/projects/tpsoneenbrmdwvzcbifw/database/query",
    data=json.dumps({"query": open(path).read()}).encode(), method="POST",
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
print(urllib.request.urlopen(req).status)
PY
```

- Each file is one `BEGIN … COMMIT` starting with `BEGIN;` (a query that starts with a comment
  block once returned 201 and ran nothing). Seeds are 100-200 KB. If the API rejects the size, do
  not split the file (wipe + inserts must stay one transaction): lower `season.rides` instead.
- Verify after: ride count = `summary.season.rides`; the primary bike's expenses this year =
  `ids.json → expense_year_total`; `SELECT 1 FROM signup_event_log WHERE user_id = '<id>'`.
- 4b (optional): upload a rendered receipt to the private `receipts` bucket at
  `<uid>/<scan_id>.webp` and set `receipt_scans.storage_path`, so the review shows the photo.

## 5. Capture

### Build (local only)

```bash
cd apps/mobile
# Empty strings, set in the process env, override every .env* value (Expo dotenv never overrides).
export EXPO_PUBLIC_RC_IOS_KEY= EXPO_PUBLIC_RC_ANDROID_KEY= POSTHOG_API_KEY= \
       EXPO_PUBLIC_META_APP_ID= EXPO_PUBLIC_META_CLIENT_TOKEN= SENTRY_DSN= SENTRY_DISABLE_AUTO_UPLOAD=true
export EXPO_PUBLIC_API_URL=https://motowise.onrender.com/graphql   # plus the other EXPO_PUBLIC_* the app needs (Supabase URL/anon key, Mapbox)
npx expo prebuild --platform ios --clean
/usr/libexec/PlistBuddy -c 'Set :EXUpdatesEnabled false' ios/MotoVaultDev/Supporting/Expo.plist \
  || /usr/libexec/PlistBuddy -c 'Add :EXUpdatesEnabled bool false' ios/MotoVaultDev/Supporting/Expo.plist
xcodebuild -workspace ios/MotoVaultDev.xcworkspace -scheme MotoVaultDev -configuration Release \
  -sdk iphonesimulator -destination "id=<udid>" -derivedDataPath build \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES build
xcrun simctl install <udid> build/Build/Products/Release-iphonesimulator/MotoVaultDev.app
```

Do NOT `source .env.production` for this build (the old README did): that is what puts the keys
in. Ad-hoc signing with entitlements is required, or SecureStore loses the session. Simulators:
iPhone 17 Pro Max (1320×2868 capture, scaled into the 1290×2796 canvas) and, for the iPad set,
iPad Pro 13" (2064×2752). Keep `SENTRY_DSN` empty too, so test crashes don't land in Sentry.

### 5a. Preflight (automatic) and capture

```bash
xcrun simctl list devices booted                           # exactly one booted simulator
capture/preflight.sh <UDID>                                # also run by capture_market.sh; must PASS
TEST_PASSWORD='<pw>' capture/capture_market.sh US <UDID>
TEST_PASSWORD='<pw>' capture/capture_market.sh US <UDID> --slots receipt_scan,trip_planning
capture/capture_market.sh US <UDID> --dry-run              # print every command, run nothing
```

Optional, stronger network block (needs sudo + owner approval, not applied by the pipeline):
add `0.0.0.0 api.revenuecat.com api-paywalls.revenuecat.com api-diagnostics.revenuecat.com
eu.i.posthog.com us.i.posthog.com graph.facebook.com` to `/etc/hosts`, `sudo dscacheutil
-flushcache`, remove after the run.

What `capture_market.sh` does: preflight; then **language + region** via `xcrun simctl spawn
<UDID> defaults write -g AppleLanguages -array <langs>`, `… AppleLocale -string <ll_CC>`, `…
AppleMetricUnits -bool <metric>` and a reboot (skipped when `AppleLocale` already matches; the
app's UI language follows `AppleLanguages[0]`'s language code, units and currency come from the
account); dark mode; photos/camera/location granted; **status bar** `simctl status_bar <UDID>
override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active
--cellularBars 4 --operatorName "" --batteryState charged --batteryLevel 100` (`clear` resets);
then Maestro with env from `capture/labels.py` (every visible-text selector from
`apps/mobile/src/i18n/locales/<lang>.json`, regex-escaped, plus the seed ids; saved without the
password to `out/captures/<CC>/capture-env.json`).

| Slot | Screen | How it is reached |
|---|---|---|
| garage | Garage tab | tap the localized tab, wait for `garage-bike-plate-<bike>` |
| ride_tracking | ride detail, map + resting sheet | `motovault://ride-detail?rideId=` |
| ride_stats | ride detail, sheet lifted | same + swipe up |
| expenses | Expense Insights, this year | `motovault://expense-dashboard?motorcycleId=…&currentMileage=…&mileageUnit=…` |
| costs_overview | bike hub Costs | `motovault://bike/<id>?segment=costs` |
| maintenance_reminders | Service → Active | `…?segment=service`, tap `service-tab-active` |
| service_history | Service → History | tap `service-tab-history`, wait `service-history-<task>` |
| receipt_scan | receipt review | `motovault://scan-receipt?resumeScanId=<seeded scan>`. **Never tap Save** |
| trip_planning | own trip detail | `motovault://trip-detail?tripId=<seeded trip>` |
| season_summary | Roads ridden + year recap | `motovault://heatmap` |

Gotchas: don't drive one simulator with the Maestro MCP and the CLI at once; Maestro attaches to
the wrong simulator if two are booted; the "Open in MotoVault?" prompt appears only when the app
is in the background. On Xcode 27 use the Maestro MCP (not axe) for ad-hoc screenshots.

### Pro-gated screens (captures are non-Pro: RevenueCat is off)

`isPro` comes only from RevenueCat customer info (`subscription.store.ts`, `use-pro-gate.ts`), so
with RC off every capture is the free tier. Checked on origin/main (fab287b9) for the 10 slots:

| Slot | What a free account shows | Effect |
|---|---|---|
| garage | an "Add bike · More bikes with Pro" row with a crown under the bikes (`garage/index.tsx` `atFreeLimit`) | visible upsell row; never tapped |
| costs_overview | the receipt-scan entry shows "N free" (or an upsell badge when exhausted) | honest free-tier badge |
| trip_planning | GPX export asks for Pro only on tap | none (not tapped) |
| ride_tracking, ride_stats | ride teasers are off (`RIDE_TEASER_LIVE = false`) | none |
| season_summary | the planned Pro glass on Roads ridden (`project_routes_ridden_premium`) is not on main | none today; re-check when #305 ships |
| expenses, maintenance_reminders, service_history, receipt_scan | no Pro gating on screen | none |

Proposal for owner approval (NOT implemented; no app code changed): if the garage upsell row is
unwanted, (a) crop it out in the composer (the canvas already shows only the top of the screen),
or (b) a capture-only flag `EXPO_PUBLIC_SCREENSHOT_FORCE_PRO=1`, read in `subscription.ts` only when
no RC key is configured and `__DEV__ || APP_VARIANT !== 'production'`, that calls
`useSubscriptionStore.getState().setPro(true)` without any RC call; plus a CI guard that fails if
the variable is set in `eas.json` or an EAS environment. Recommendation: (a), since showing the
free tier is truthful (logging is free) and needs no app change.

## 6. Compose (local)

```bash
python3 compose/compose.py US                       # out/captures/US -> out/store/US
python3 compose/compose.py US --ipad-captures out/captures/US-ipad --guides
```

**Design = the owner's canvas** "MotoVault Store Screenshots" (claude.ai/artifact/E3jxrkkw3xixkA7vNwDDX1),
primary slides Main/Expenses/History/Rides/Garage: a 430×932 artboard, rendered with CSS zoom
(3× = 1290×2796). Headline at padding 64/36, Barlow Condensed 700 upper case 54px, line-height
0.96, both lines in #F4F1EA (the canvas does not colour line 2; `--accent-line2` paints it
#D4622E if wanted); subline DM Sans 17px/1.45 #B9B5AC, gap 16px; phone frame left 60, top 330
(receipt_scan 372 with the capture offset −88, as in Main.dc.html), 310×660, radius 48, 10px bezel
#050506, inner radius 38 on #121315, shadow `0 30px 80px rgba(0,0,0,.6)` + 1px #2C2D31 ring;
capture 290px wide. A copy file can override per slot with `slots.<slot>.layout = {frame_top,
img_offset}`. The only deviation: if a localized headline line is wider than the column, that
headline shrinks until it fits instead of wrapping into the phone. Play 1080×1920 uses the same
artboard (430 wide, shorter, so less of the phone shows); the iPad set has no canvas artboard and
centres a wider tablet frame under the same text block. The wide assets (header, search, feature
graphic) have no canvas slide; they reuse the same type, colours and frame.

Copy: App Store `../copy/<store_locales.ios>.json`; Play `../copy/<file>.json` with MX →
`es-MX-play`, CO → `es-CO`, AR → `es-AR`, PH → `en-PH`, else `<store_locales.play>.json`. Order:
`order` (iOS, 10) and `order_play` (Play, 8). Missing captures are skipped and listed in
`manifest.json → warnings`. The composer checks every output's size and that it has no alpha.

| Output | Size | Spec (checked 2026-11-03) |
|---|---|---|
| `ios/iphone-6.9/` | 1290×2796 | Apple "iPhone with Dynamic Island (large)": 1320×2868, 1290×2796 or 1260×2736; up to 10; scaled down for smaller iPhones. `asc screenshots validate --device-type IPHONE_69` passes |
| `ios/ipad-13/` | 2064×2752 | required (the app sets `supportsTablet: true`); 2064×2752 or 2048×2732. `IPAD_PRO_3GEN_129` validates |
| `ios/asset-library/header.png` | 3840×1646 | product page header, 21:9 (the 16:9 5244×2950 PNG variant is not rendered) |
| `ios/asset-library/search.png` | 3840×2560 | search results, 3:2, min 1920×1280, max 3840×2560 |
| `play/phone/` | 1080×1920 | 320-3840 px, long side ≤ 2× short, up to 8; ≥4 at 9:16 ≥1080×1920 for screenshot-format promotion |
| `play/feature-graphic.png` | 1024×500 | 24-bit PNG/JPEG, no alpha |

Safe areas: Apple publishes header/search safe areas only inside its design templates. The
composer keeps text and phones inside a conservative centred box (header 64%×76%, search
86%×86%, feature graphic 84%×80%); `--guides` writes `*-guides.png` twins. Confirm in ASC's product
page preview before shipping.

## 7. Review

`python3 compose/review_page.py US` → `out/store/US/review.html` (local file; demo data only).

## 8. [OWNER] Upload

**App Store screenshots** (asc 5.4.0, env-var auth per `reference_asc_credentials`, `</dev/null`):

```bash
asc screenshots upload --app 6760291360 --version "<x.y.z>" --path out/store/US/ios/iphone-6.9 \
  --device-type IPHONE_69 --replace --dry-run            # preview, then --replace --confirm
asc screenshots upload --app 6760291360 --version "<x.y.z>" --path out/store/US/ios/ipad-13 \
  --device-type IPAD_PRO_3GEN_129 --replace --confirm
```

One run per App Store localization. Apple localizations are per language: es-MX serves MX, CO, AR;
en-GB serves GB and PH. es-ES, en-CA and en-AU are not live yet; adding them gives Spain, Canada and
Australia their own page. Otherwise a per-country set needs a Custom Product Page
(`asc product-pages custom-pages …`), reached only by its own link or ads.

**Header + search (Asset Library):** not in asc 5.4.0; raw API with the same team key
(`project_screenshot_ab_test_1006`): POST `v1/appAssetLibraryImages` {category CREATIVE_ASSETS,
fileName, fileSize, rel assetLibrary = appAssetLibraries/6760291360} → PUT each uploadOperation →
PATCH {uploaded: true} (no checksum attribute: 409) → POST `v1/appAssetLibraryPlacements`
{placementType PRODUCT_PAGE_HEADER_ASSET | APP_STORE_SEARCH_RESULTS_ASSET} with `image` + an
`appStoreVersionLocalization` (or custom product page / experiment treatment localization).

**Google Play** (package `com.motovault.app`):

```bash
EDIT=<id from: gplay edits create --package com.motovault.app>
gplay images delete-all --package com.motovault.app --edit $EDIT --locale en-US --type phoneScreenshots
for f in out/store/US/play/phone/*.png; do
  gplay images upload --package com.motovault.app --edit $EDIT --locale en-US --type phoneScreenshots --file "$f"
done
gplay images upload --package com.motovault.app --edit $EDIT --locale en-US --type featureGraphic \
  --file out/store/US/play/feature-graphic.png
gplay edits validate --package com.motovault.app --edit $EDIT && gplay edits commit --package com.motovault.app --edit $EDIT
```

That reaches the **default listing**, one translation per language. **Custom store listings
(MX, CO, AR, PH) are console-only:** the Android Publisher API v3 `edits.listings`/`edits.images`
address the default listing by language only and gplay has no custom-listing command; upload
those by hand in Play Console → Grow users → Store presence → Custom store listings. Store listing
experiments are console-only too.

## 9. [OWNER] Teardown

`out/seed/<CC>/teardown.sql` through the step 4 route (same email guard) deletes every seeded
row; then `DELETE https://tpsoneenbrmdwvzcbifw.supabase.co/auth/v1/admin/users/<uuid>` (service
role) deletes the auth user, cascading `public.users` and `signup_event_log`. **Never** sign in
and use the app's delete-account screen: that path calls RevenueCat. The accounts can also be kept
for the next refresh (the seed is re-runnable).

## UI locales

The app ships `en es de fr it pt-BR` (plus pl ja hi th id tr sk) and resolves the UI language from
the device language code. Every market gets a native-language UI: US GB CA AU PH → en (no Filipino
in the app), MX CO AR ES → es (one flat, Latin-neutral `es.json`), BR → pt-BR, FR → fr, IT → it,
DE → de.

## Blockers and app issues

- **PH (PHP) and CO/AR (amounts) need migrations 00194 + 00195** from branch
  `fix/expense-currency-limits` (11ef82d7): they raise `expenses.amount` and
  `motorcycles.purchase_price` to MONEY_AMOUNT_MAX = 99,999,999.99 (today 99,999.99 / 999,999.99,
  00036 / 00052) and add PHP to the currency allowlists. Not live on prod yet. Until then:
  - the current `../markets` files work without the fix (PH in USD at PHP/58, no CO/AR purchase
    price, every amount under 99,999.99);
  - a real peso / full-price COP/ARS set is generated with
    `python3 gen_seed_market.py PH --assume-currency-fix …`. That flag accepts PHP and amounts up to
    99,999,999.99, and the SQL then starts with a precondition that raises unless `chk_users_currency`
    contains PHP and `expenses_amount_check` has the new cap on the target database. Apply such a seed
    only after 00194/00195 (and the API/app release that the commit's deploy order names) are live.
- **Product fix to propose: money is formatted en-US in every language.** `formatCurrency` in
  `apps/mobile/src/lib/expense-constants.ts` hard-codes `Intl.NumberFormat('en-US', …)`, so
  German/French/Spanish/Italian/Brazilian screens show `€1,833.77` instead of `1.833,77 €`, and
  COP/ARS show the ISO code (`COP 185,000`). Proposal (not implemented, needs owner approval): format
  with the app's resolved i18n language plus the device region (e.g. `de-DE`, `es-CO`, `pt-BR`),
  keep the per-locale formatter cache, keep `CURRENCY_SYMBOLS` for input prefixes, and pin it with a
  test per shipped locale. Until it ships, every non-English screenshot shows en-US number format.
- **Unverified on a device:** own draft trip in trip detail; the resume-scan review with
  `storage_path = NULL`; Mapbox tiles with the production public token in a local build.
- **iPad:** the proof puts iPhone captures on the iPad canvas (not uploadable; guideline 2.3.3).
- `subscription-actions.ts` (Profile → manage/restore) calls `react-native-purchases` directly;
  unconfigured it throws locally, and the flows never open Profile.

## Proof (this dry run)

- `out/seed/<CC>/` for all 13 markets from `../markets` (seed, teardown, account SQL; ids;
  summary). Placeholder user id, so each refuses to run. All 39 files parse. A PHP variant of PH and
  a full-price CO variant were also generated with `--assume-currency-fix` as a test: both pass,
  both carry the 00194 precondition, and both are refused without the flag.
- `proof/US/`: the canvas template rendered from the 2026-10-18 en-US captures
  (`proof/captures/US/`, 9 slots; no trip capture exists) with aso-copy's en-US captions;
  `review.html`. `proof/copy-mapping.txt`: which copy file each market and store reads.
- `proof/capture-dryrun-US.txt`, `proof/capture-dryrun-DE.txt`: every command a capture would run.
- `proof/preflight-static-on-production-keyed-build.txt`: the static preflight run against the
  app currently installed on the "MV E2E iPhone 17 Pro" simulator (a build made with the
  production env): it FAILS on the RC key, the PostHog key, the Meta app id/token and enabled
  expo-updates, which is the intended refusal.
- `proof/seed-fixture-US/`: the first stub-fixture seed (offline).
