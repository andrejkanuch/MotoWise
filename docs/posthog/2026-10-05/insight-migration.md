# insight-migration — items 5 + 6 (2026-10-05)

PostHog project 155556 (EU). Agent: `insight-migration`.

## TL;DR
- **Item 5: no saved object needed a migration.** I searched every saved insight (142), dashboard (10), cohort (7), action (8), feature flag, experiment and survey (1). None filters on a mobile `$screen_name` value or on any of the four removed Meta alias events. Only two insights touch `$screen` at all (DAU / WAU), and they count it with no screen-name filter, so 3.21.0 leaves them unchanged. I made no edits to existing objects.
- **Item 6: the first 3.21.0 `$screen` events arrived during this run** (4 events, 2 people, 18:18–18:20 UTC). All 3 screens pass: route-template names, `feature_area` set, no `route_*` keys. No dynamic route (`[id]`, `[token]`, `[username]`) has been visited yet, so the placeholder check is **not yet exercised**. I saved the check as a new insight so the owner can re-run it after testers use the build.
- New object (additive): insight **6353602 / `yS1dc5xy`**, "3.21.0 $screen privacy check (route templates, no ids/tokens)": https://eu.posthog.com/project/155556/insights/yS1dc5xy

## Phases

### Investigation
- Code: `apps/mobile/src/lib/analytics-screen.ts` and `hooks/use-screen-tracking.ts` (3.21.0). Before #262, `app/_layout.tsx` called `trackScreen(pathname, { previous_screen })` with the raw `usePathname()` (groups and `index` dropped, ids inline), and `privacy.tsx` also sent a manual `trackScreen('Privacy')`. `lib/analytics.ts` `META_ALIASES` sent `diagnostic_started→ai_diagnosis_started`, `diagnostic_completed→ai_diagnosis_completed`, `maintenance_task_created→maintenance_log_added` and `trip_viewed→trip_plan_viewed`, each a second capture tagged `_meta_alias: true`.
- PostHog inventory: SQL over `system.insights` / `system.dashboards` / `system.cohorts` / `system.actions` / `system.feature_flags` / `system.experiments` (I checked the columns in `system.information_schema.columns` first), plus `surveys-get-all`. I searched `toString(query|filters|groups|steps_json|variables)` for `screen` (this catches `$screen`, `$screen_name`, `previous_screen` and PathsQuery `includeEventTypes`) and for each alias name.
  - Insights: 142 live. 2 mention screens (3783599 DAU, 3783600 WAU), and 0 mention an alias. The 2 HogQL insights contain neither.
  - Dashboards (filters/variables), cohorts, actions, flags and experiments: 0 hits.
  - The one survey ("MotoVault User Feedback Survey", inactive) targets only person properties. No screen or event conditions.
- Alias parity, last 90 days (count / people): ai_diagnosis_started 39/26 = diagnostic_started 39/26; ai_diagnosis_completed 5/4 = diagnostic_completed 5/4; maintenance_log_added 52/19 = maintenance_task_created 52/19; trip_plan_viewed 104/48 = trip_viewed 104/48. The originals are exact 1:1 substitutes, so anyone building on an alias later should use the original.

### Research
- PostHog React Native `screen()` captures `$screen` with the name in `$screen_name`: https://posthog.com/docs/libraries/react-native#capturing-screen-views
- Expo Router `useSegments()` returns group segments (e.g. `['(search)', 'profile']`): https://docs.expo.dev/router/reference/typed-routes. That `index` is omitted is confirmed by the live 3.21.0 data (`/(onboarding)` for `(onboarding)/index.tsx`) and matches `routeTemplateFromSegments([]) === '/'` in `analytics-screen.test.ts`.

### Plan
No existing object depends on the changed names, so no OR-conditions are needed. The only additive work is to save the item-6 verification as an insight (done) and give the owner the old→new mapping plus match recipes, so future insights cover both versions.

### Execution
| Object | id | Name | Change | Verified |
|---|---|---|---|---|
| Insight | 3783599 | Daily active users (DAUs) | None. `$pageview` OR `$screen`, math=dau, no screen-name filter, so 3.21.0 does not affect it | Query JSON read in full |
| Insight | 3783600 | Weekly active users (WAUs) | None. Same as above | Query JSON read in full |
| Insight (new) | 6353602 / yS1dc5xy | 3.21.0 $screen privacy check | Created (additive) | Ran via `insight-query`, returns rows (see below) |

### Self-review
- Detector test on old data (3.19.1 + 3.20.0, 30 days) fired as intended: 649 events "uuid in name" (`/bike/<uuid>`, `/document/<uuid>`, `/<uuid>`), 5 events "raw value after dynamic parent" (`/article/<slug>`), 6 events "not a path" (`Privacy`), and the rest "feature_area missing".
- Literal test on every new route template (`/(tabs)/(garage)/bike/[id]`, `/t/[token]`, `/(tabs)/(profile)/rider/[username]`, `/route/[country]/[region]/[slug]`, `/(tabs)/(profile)/rider/followers`, `/(tabs)/(garage)/manage-document-categories`, …): no false positives. Synthetic leaks `/t/Ab3dEf9hIjKlMnOp` and `/(tabs)/(profile)/rider/some_rider` were flagged.
- An earlier draft flagged `/add-maintenance-task` as token-like (any segment of 20+ characters). I fixed this: a token-like segment now needs 16+ characters including a digit, and no route file name contains a digit.

## Old → new `$screen_name` mapping (≤3.20 → 3.21.0+)
Old = raw pathname (groups and `index` stripped, ids inline). New = route template. Old volume is from the last 30 days.

| Old (≤3.20) | New (3.21.0+) | feature_area | Old 30d |
|---|---|---|---|
| `/` (**ambiguous**: every tab root, `(auth)/index`, `(onboarding)/index`) | `/(tabs)/(garage)`, `/(tabs)/(learn)`, `/(tabs)/(diagnose)`, `/(tabs)/(discover)`, `/(tabs)/(profile)`, `/(tabs)/(home)`, `/(auth)`, `/(onboarding)`, `/` | per group | 3659 |
| `/bike/<uuid>` | `/(tabs)/(garage)/bike/[id]` + `route_id` | garage | 824 |
| `/start-ride` | `/(modals)/start-ride` | rides | 718 |
| `/ride-hud` | `/(modals)/ride-hud` | rides | 580 |
| `/ride-summary` | `/(modals)/ride-summary` | rides | 497 |
| `/ride-detail` | `/(modals)/ride-detail` | rides | 124 |
| `/ride-flyover` | `/(modals)/ride-flyover` | rides | 9 |
| `/rides` | `/(tabs)/(profile)/rides` | rides | 301 |
| `/heatmap` | `/(tabs)/(profile)/heatmap` | rides | 14 |
| `/carplay`, `/carplay/onboarding`, `/carplay/cues` | `/(modals)/carplay`, `/(modals)/carplay/onboarding`, `/(modals)/carplay/cues` | rides | 13/4/3 |
| `/ride/<uuid>` | `/ride/[id]` + `route_id` | rides | 0 |
| onboarding: `/experience` `/bike-setup` `/goals` `/reveal` `/commitment` `/account` `/heard-about` `/personalizing` `/maintenance` `/sign-in` `/no-bike-value` `/bike-make` `/bike-model` `/bike-year` `/bike-type` `/bike-photo` `/currency` `/insights` `/smart-maintenance` | `/(onboarding)/<same>` | onboarding | 555/532/314/303/267/254/172/164/115/59/44/… |
| `/paywall` | `/(onboarding)/paywall` | **paywall** | 121 |
| `/notifications` (**ambiguous**) | `/(onboarding)/notifications` or `/(tabs)/(profile)/notifications` | onboarding / profile | 178 |
| `/scan-receipt` (**ambiguous**) | `/(onboarding)/scan-receipt` or `/(modals)/scan-receipt` | onboarding / expenses | 111 |
| `/frequency` `/last-service` `/stay-on-top` `/building-plan` | none (retired onboarding steps, ≤3.19 only) | — | 124/120/113/62 |
| `/login`, `/register` | `/(auth)/login`, `/(auth)/register` | auth | 117 |
| `/whats-new` | `/(modals)/whats-new` | other | 206 |
| `/add-bike` `/edit-bike` `/health-report` `/add-document` `/manage-document-categories` | `/(tabs)/(garage)/<same>` | garage | 164/56/44/19/1 |
| `/document/<uuid>` | `/(tabs)/(garage)/document/[id]` + `route_id` | garage | 11 |
| `/add-expense` `/expense-dashboard` `/expense-detail` | `/(tabs)/(garage)/<same>` | expenses | 108/61/43 |
| `/add-ride-expense` | `/(modals)/add-ride-expense` | expenses | 4 |
| `/add-maintenance-task` `/edit-maintenance-task` `/complete-task` `/bike-tasks` | `/(tabs)/(garage)/<same>` | maintenance | 67/18/17/37 |
| `/recalls` | `/(modals)/recalls` | maintenance | 12 |
| `/new`, `/<uuid>` | `/(tabs)/(diagnose)/new`, `/(tabs)/(diagnose)/[id]` + `route_id` | diagnose | 19/4 |
| `/article/<slug>` | `/(tabs)/(learn)/article/[slug]` + `route_slug` | learn | 7 |
| `/create-trip` `/trip-detail` `/create-group-ride` `/group-ride-detail` | `/(modals)/<same>` | discover | 44/31/0/0 |
| `/trips` `/saved` | `/(tabs)/(profile)/<same>` | discover | 22/7 |
| `/trip/<uuid>`, `/routes/<uuid>`, `/route/<c>/<r>/<slug>` | `/trip/[id]`, `/routes/[id]`, `/route/[country]/[region]/[slug]` + `route_*` | discover | 0 |
| `/t/<token>` | `/t/[token]` (token **not** forwarded) | discover | 0 |
| `/settings` `/edit-profile` `/privacy` `/support` `/rider/followers` | `/(tabs)/(profile)/<same>` | profile | 77/26/8/7/1 |
| `Privacy` (manual duplicate) | none (dropped; `/(tabs)/(profile)/privacy` only) | — | 8 |
| `/rider/<username>` | `/(tabs)/(profile)/rider/[username]` (username **not** forwarded) | profile | 0 |
| `/analytics-consent`, `/+not-found` | `/analytics-consent`, `/+not-found` | other | — |

**Counting caveat for cross-version trends:** 3.21.0 also fires `$screen` on tab switches (de-duplication is on template plus pathname). Before 3.21.0, a tab switch kept pathname `/` and fired nothing. So "screen views per user" will jump on 3.21.0 without any change in behaviour. Compare per version, or count people rather than events.

### Recipes for future insights that must span both versions
- One screen, both versions: property `$screen_name` **matches regex** `^/(\(tabs\)/\(garage\)/)?bike/` (bike detail), `^/(\(modals\)/)?start-ride$` (start ride), `^/(\(onboarding\)/)?paywall$` (paywall). The general pattern is `^/(<groups>/)*<static-path>$`.
- Feature-level views on 3.21.0+ only: filter or break down on `feature_area` (null on ≤3.20).
- Removed aliases: always use `diagnostic_started`, `diagnostic_completed`, `maintenance_task_created` and `trip_viewed` (identical history, still sent). Alias history before 3.21.0 still carries `_meta_alias: true`.

## Item 6: verification on real data
**Result now (18:21 UTC, 2026-10-05):** 4 `$screen` events from `$app_version = 3.21.0`, from 2 people (internal testers), from 18:18 to 18:20 UTC:

| verdict | screen | feature_area | route_keys | events |
|---|---|---|---|---|
| ok | `/(onboarding)/sign-in` | onboarding | [] | 2 |
| ok | `/` | other | [] | 1 |
| ok | `/(onboarding)` | onboarding | [] | 1 |

- 0 FAIL rows. 3 of 4 events carry `previous_screen`.
- **Not yet proven:** no dynamic route (`bike/[id]`, `t/[token]`, `rider/[username]`, `article/[slug]`, `document/[id]`) has been visited on 3.21.0, so placeholders and `route_*` allowlisting are untested on real data. Re-run the insight after a tester opens a bike, an article and a shared link.
- Side observation (not my area; for `hygiene` or the lead): `$os` is null on all 4 events from 3.21.0, which looks odd. Check this after more events arrive, before relying on `platform` / `$os` breakdowns.

**How to re-run:** open https://eu.posthog.com/project/155556/insights/yS1dc5xy, or run the SQL below in SQL editor. Pass = every row's `verdict` is `ok`, and among the dynamic routes, `route_keys` holds only `route_id` / `route_slug` / `route_country` / `route_region`. `/t/[token]` and `/rider/[username]` must show `[]`.

```sql
SELECT verdict, screen, feature_area, route_keys, count() AS events, uniq(pid) AS people
FROM (
    SELECT
        toString(properties.$screen_name) AS screen,
        toString(properties.feature_area) AS feature_area,
        arrayFilter(k -> startsWith(k, 'route_'), JSONExtractKeys(properties)) AS route_keys,
        person_id AS pid,
        multiIf(
            match(screen, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'), 'FAIL uuid in name',
            match(screen, '/(t|rider|article|ride|trip|routes|bike|document|route)/[^\\[/(]') AND NOT match(screen, '/rider/followers$'), 'FAIL raw value after dynamic parent',
            arrayExists(seg -> length(seg) >= 16 AND match(seg, '[0-9]') AND NOT startsWith(seg, '['), splitByChar('/', screen)), 'FAIL token-like segment',
            NOT startsWith(screen, '/'), 'FAIL not a path',
            hasAny(route_keys, ['route_token', 'route_username']), 'FAIL forbidden route param',
            arrayExists(k -> k NOT IN ('route_id', 'route_slug', 'route_country', 'route_region'), route_keys), 'FAIL unlisted route param',
            feature_area IS NULL OR feature_area IN ('', 'null'), 'FAIL feature_area missing',
            'ok'
        ) AS verdict
    FROM events
    WHERE event = '$screen'
      AND properties.$app_version = '3.21.0'
      AND timestamp > now() - INTERVAL 30 DAY
)
GROUP BY verdict, screen, feature_area, route_keys
ORDER BY verdict = 'ok', events DESC
```

Extra leak check, run on any event type rather than only `$screen` (property values that look like a share token or a UUID in a `route_*` key other than id):
```sql
SELECT event, arrayJoin(arrayFilter(k -> startsWith(k, 'route_') AND k NOT IN ('route_id','route_slug','route_country','route_region'), JSONExtractKeys(properties))) AS bad_key, count()
FROM events
WHERE properties.$app_version = '3.21.0' AND timestamp > now() - INTERVAL 30 DAY
GROUP BY event, bad_key
```
Expected: 0 rows.

## Left for the owner
1. After testers visit bike detail, a document, an article, a shared trip link (`/t/…`) and a rider profile on 3.21.0, re-run insight `yS1dc5xy` and confirm 0 FAIL rows.
2. Optional: when 3.21.0 reaches production, build any new per-screen insight with the regex recipes above, or with `feature_area` if 3.21.0+ only is acceptable.
