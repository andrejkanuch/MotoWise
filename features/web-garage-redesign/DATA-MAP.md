# Web garage redesign: data map (Phase 0)

Source of truth for what the redesigned `/garage` + `/profile` may render. The
design frames (`Main`, `Profile-768/390`, `Empty-*`, `Handoff-*`,
`Components-Garage`, `Components-Status`) were checked field by field against
`apps/api/schema.graphql`, the operations in `apps/web/src/graphql` and the
generated documents in `@motovault/graphql` (codegen scans every app, so a
document written for mobile is importable on web).

Legend

- **AVAILABLE**: the web already fetches it, or a generated document in
  `@motovault/graphql` already selects it (import and use, no new `.graphql`).
- **AVAILABLE-NEEDS-NEW-QUERY-DOC**: the field is in the schema, but no existing
  document selects it. Add a web `.graphql` under `apps/web/src/graphql/queries`
  and run `pnpm generate`.
- **AVAILABLE (non-GraphQL)**: comes from Supabase auth or the RevenueCat JS SDK.
- **DERIVED**: computed on the client from AVAILABLE fields (rule given).
- **MISSING**: no API field. Owner rule: **hide the element**, do not add API
  fields, do not show a placeholder.

## 1. Header / nav (all frames)

| Element | Source | Status |
| --- | --- | --- |
| Display name / initial ("Rider", "R") | Supabase `user.user_metadata.display_name ?? full_name ?? email` (already passed to `CommunityNav`) | AVAILABLE (non-GraphQL) |
| Pro badge in the nav | `useProStatus().isPro` (RevenueCat JS, falls back to `getGPXQuotaStatus`) | AVAILABLE (non-GraphQL) |
| Sign out | `supabase.auth.signOut()` (existing `CommunityNav`) | AVAILABLE |

## 2. Page eyebrow and title

| Element | Source | Status |
| --- | --- | --- |
| "Garage · N bike(s)" | `myMotorcycles.length` (`MyMotorcyclesDocument`) | AVAILABLE |
| "Read-only on the web" | static copy | n/a |

## 3. Bike hero card

| Element | Field | Status |
| --- | --- | --- |
| Make · year overline | `Motorcycle.make`, `.year` | AVAILABLE |
| Model (serif 60) | `Motorcycle.model` | AVAILABLE |
| Variant line ("DCT") | `Motorcycle.variant` (nullable, hide when null) | AVAILABLE |
| Nickname (not in the frame) | `Motorcycle.nickname` | AVAILABLE (optional) |
| Photo | `Motorcycle.primaryPhotoUrl` (nullable; null → striped placeholder **with no text label**, the `[Bike photo]` label must not ship) | AVAILABLE |
| Odometer value | `Motorcycle.currentMileage` (nullable → hide the odometer block) | AVAILABLE |
| Odometer unit (km / mi) | Rider setting `User.measurementSystem` (`MeDocument`). Odometer is stored RAW in the rider's unit (#164), so label only, **never convert**. `Motorcycle.mileageUnit` exists but is not the rider setting; prefer `measurementSystem`, fall back to `mileageUnit`, then `km`. | AVAILABLE |
| Which bike leads (multi-bike) | `Motorcycle.isPrimary`, else first. The sheet says "the most recent one leads"; `createdAt` is available, but the current garage and the app both lead with `isPrimary`. Recommend `isPrimary`. | AVAILABLE |
| "Also in your garage · N" thumbs | `make/model/year/primaryPhotoUrl/currentMileage` of the other bikes | AVAILABLE |
| **Health grade letter (A–F)** | No API field (`HealthReport` has no grade; schema has no score). The mobile app computes it **client-side** in `apps/mobile/src/lib/health-score.ts` (`computeHealthScore`, date-only, active tasks). | **MISSING (API)**. Default: **hide the letter disc**. Showing it is only acceptable if the exact mobile algorithm is moved to a shared package so web and app always agree; that is an owner call, not done here. Canvas note 2 (`[GRADE]` placeholder) resolved: never ships. |
| "Health · N overdue" | DERIVED overdue count (rule in section 4) | DERIVED. Without the grade, render the overdue part only (triangle + "N overdue"), and nothing when N = 0. |
| Health "No data" chip ("Health appears after your first service is logged.") | Depends on the grade | Hidden with the grade. |
| Recall count (not in the frame) | `Motorcycle.recallCount` | AVAILABLE, unused |

## 4. Next-service card

| Element | Field | Status |
| --- | --- | --- |
| Task list | `allMaintenanceTasks` (`AllMaintenanceTasksDocument`, already prefetched). The server already returns **active tasks only** (`pending`, `in_progress`) for non-deleted bikes, ordered by `due_date`. Filter by `motorcycleId` for the shown bike. | AVAILABLE |
| Task title | `MaintenanceTask.title` | AVAILABLE |
| Due date | `MaintenanceTask.dueDate` (nullable) | AVAILABLE |
| Due mileage | `MaintenanceTask.targetMileage` (nullable, same raw unit as the odometer, label with the rider unit) | AVAILABLE |
| "N scheduled" | count of active tasks for the bike | DERIVED |
| **Overdue** | DERIVED, never from the design's assumptions: overdue **by date** when `dueDate` < today (local calendar day); overdue **by distance** when `targetMileage != null && currentMileage != null && currentMileage >= targetMileage`. Label "Overdue by date" / "Overdue by distance" (both true → date). | DERIVED |
| Order | overdue first; then nearest by date or distance; max 3 rows (sheet rule) | DERIVED |
| Empty ("No service scheduled.") | zero active tasks for the bike | DERIVED |

Canvas note 1 resolved: with real data, every task whose due date is before
today renders as overdue (Chain Clean & Lube and Coolant would too). The frames'
single overdue item is not a rule.

Note: mobile's health score treats overdue **by date only**. If the grade is
ever shown, its overdue count must come from the same function as the grade,
or the chip will contradict itself.

## 5. This-year spend card

| Element | Field | Status |
| --- | --- | --- |
| Per-currency year total | `ExpenseDashboardSummary.currencies[].currentYearTotal` + `.currency` (`ExpenseDashboardDocument`, per bike) | AVAILABLE |
| Category split for the year | `currencies[].monthlyBuckets` filtered to `year == current year`, then summed per `categories[].category` **within that currency**. Do **not** use `categoryTotals`: the RPC computes them over **all time** (00186). | DERIVED |
| Year label ("Spent in 2026") | current calendar year | DERIVED |
| **"22 expenses" (this year)** | `expenseCount` exists but is the **all-time** row count (top-level is summed across currencies; per-currency is all-time too). No year-scoped count. | **MISSING**: hide the count. (Or label it honestly as all-time; owner call. Default hide.) |
| Multi-currency | one total per currency, side by side, separated by `·`; each with its own category split. **Never sum across currencies** (#275). | AVAILABLE |
| Empty ("Nothing logged in 2026.") | no currency with `currentYearTotal > 0` | DERIVED |
| Category labels | `Garage.cat*` messages via `expenseCategoryMessageKey` (all locales covered) | AVAILABLE |
| Whole-unit category amounts, total keeps cents | formatting only. Canvas note 3 resolved: the category amounts are rounded for display, so they may not add up to the total. Render as computed, never fudge. | n/a |
| Spend across all bikes | `expenseDashboard` takes one `motorcycleId`. Garage-wide spend needs one call per bike. Recommend: show the lead bike only, as today. | AVAILABLE (per bike) |

## 6. Rides card

| Element | Field | Status |
| --- | --- | --- |
| **Rides this calendar year (count)** | `RideOverview` has `thisWeek`, `thisMonth`, `last7Days`, `last30Days` only. `myRides.totalCount` and `getRiderProfile.rideStats.totalRides` are all-time. | **MISSING** |
| **Distance this calendar year** | same | **MISSING** |
| Last ride date | `rideOverview.lastRide.date` (`RideOverviewDocument`, generated from mobile, not used on web yet) | AVAILABLE |
| All-time rides / distance (possible substitute) | `myRides(first: 1) { totalCount }` (any user), or `getRiderProfile.rideStats.{totalRides,totalDistance}` (needs a public username, already prefetched by the garage page). Distance is in meters: convert to the rider unit for display. | AVAILABLE (via `MyRidesDocument` or new small web doc `my-ride-count.graphql`) |
| Empty ("No rides yet.") | `lastRide == null` | DERIVED |

Decision: the "Rides 2026" count and distance are hidden (owner rule). The sheet
says "Year = calendar year, labelled with the year, never 'this year' alone", so
relabelling all-time totals as "2026" is **not** allowed. The page agent may show
all-time totals only with an explicit "all time" label. Owner call; default:
last ride date + the "Record your next ride" link only.

## 7. Account / Pro row

| Element | Source | Status |
| --- | --- | --- |
| Email | `me.email` (`MeDocument`) or Supabase `user.email` | AVAILABLE |
| Signed-in method ("Signed in with email", Google / Apple account line) | Supabase `user.app_metadata.provider` (`email` / `google` / `apple`) | AVAILABLE (non-GraphQL) |
| Pro / Free / Trial | `useProStatus()` → `isPro`, `isTrialing` | AVAILABLE (non-GraphQL) |
| Trial "N days left" | `useProStatus().trialDaysLeft` (nullable → hide the number; `[N]` must not ship) | AVAILABLE (non-GraphQL) |
| Manage link: web billing | `useManageSubscription()` → `web` (RevenueCat `managementURL`) / `web_portal` (Stripe portal via `createBillingPortalSession`) | AVAILABLE |
| Manage link: App Store vs Google Play | RevenueCat `customerInfo.entitlements.active.pro.store` (`app_store` / `play_store`). `resolveManageSubscription` currently collapses both into `store`; split it (small client change, no API). When the store is unknown (RevenueCat failed and the fallback tier query was used), show the generic "Manage in your app store" copy. | AVAILABLE (non-GraphQL), needs a small client change |
| Free: "See what Pro adds" → `/pro` | static | n/a |

## 8. Handoff (rail / band / bar / empty hero / post-signup page)

| Element | Source | Status |
| --- | --- | --- |
| QR code | Generated in code with `uqr` (already a web dependency, used by `/get`). Encodes `https://motovault.app/get`, ECC M, no border (tile padding is the quiet zone), dark modules `--mv-qr-ink` on `--mv-qr-tile`. | n/a |
| "Sign in with the same account: email" | Supabase `user.email` / provider (section 7) | AVAILABLE |
| Promoted reason | DERIVED: overdue service (title from section 4) › no rides (`lastRide == null`) › nothing logged this year (section 5 empty). One promoted card per page at most. | DERIVED |
| Store links | `STORE_LINKS` in `apps/web/src/lib/store-links.ts` (App Store id6760291360, Play com.motovault.app) | AVAILABLE |
| Official store badge SVGs | Not in the repo | Clean text buttons with platform glyphs instead (canvas note 6). |
| `?src=web-profile` attribution on the QR / links | Needs a new `GetSource` value (canvas note 5) | Not added: links use the plain `/get` (counted as `other`). Optional follow-up. |

## 9. Auth frames (Sign up / Sign in / Auth states)

Out of this redesign's data scope: copy, providers, the 6-character password
minimum and the errors already come from `/signup`, `/login` and
`lib/auth-errors.ts`. The `[Hero photo]` slot and the unverifiable
testimonial/stats (canvas note 3) must not ship; hide the slot unless a real
photo asset is supplied.

## MISSING summary (hide these)

1. Health grade letter (A–F) and its "No data" chip: not in the API.
2. Expense count for the year ("22 expenses"): only an all-time count exists.
3. Rides count this calendar year ("19 rides"): no year-scoped ride stats.
4. Ride distance this calendar year ("366 km"): no year-scoped ride stats.

Also never ship: `[GRADE]`, `[Bike photo]` labels, `[Bike 2]`/`[Bike 3]`,
`[odometer]`, `[N]`, `[Manage link by billing source]`, `[OFFICIAL BADGE]`,
`[Hero photo]`, `[Category]`.
