# Hygiene: data hygiene (item 2) and the 3.21.0 EU explainer (item 7)

Agent `hygiene`, 2026-10-05, PostHog project 155556 (EU). All counts are live queries run on 2026-10-05.

## Summary
- The project's test-account filters (`test_account_filters`) now have two more conditions. One excludes the Douyin "aweme" scraper and the other excludes the 2026-07-14 "bio`" test sessions. The existing four conditions were kept unchanged, and the Slovakia exclusion was already there.
- Verified: filtered web pageviews dropped by exactly the predicted amount in every month. Signups and purchases did not change.
- Every dashboard tile already applies the test-account filter (10 dashboards, 66 tiles), so all dashboards pick up the change with no edits. 68 older saved insights that are not on any dashboard have the filter off. They are listed for the owner below and were not changed.
- Three project annotations were added: 138558 (3.21.0 internal test), 138559 (placeholder on how to read EU numbers) and 138560 (this filter change).
- Two side findings for the lead and owner:
  - The server signup event is `signup_completed`, not `user_signed_up` (the brief has this wrong).
  - `signup_completed` is geo-located from the API server's IP, so every event reads as US.

## 1. Investigation

### Test-account filter configuration (before)
`test_account_filters_default_checked: true`. New insights filter by default.
```json
[{"key":"id","type":"cohort","value":100593,"operator":"not_in"},
 {"key":"internal","type":"person","value":["true"],"operator":"is_not"},
 {"key":"distinct_id not in ('65b941f3-…', '4c1e6e05-…', '6fb4b88f-…')","type":"hogql"},
 {"key":"$geoip_country_code","type":"event","value":["SK"],"operator":"is_not"}]
```
(The full values are in `test_account_filters.before.json` next to this file.) Cohort 100593 is "Internal / Test users" (48 people). **Slovakia is already excluded** by event GeoIP, so nothing needed adding for it.

### Who uses the filter
- **Dashboards:** all 10 dashboards (636265, 651619, 655463, 679456, 680821, 735464, 738337, 749644, 771518, 861165) show only insights with `filterTestAccounts: true`, 66 of 66 tiles.
- **Saved insights:** 74 have the filter on. 66 have it explicitly off and 2 HogQL insights don't have the setting at all. All 68 were created between April and June 2026: the default template insights, the Apr-08/Apr-09/Apr-22/Apr-29 batches and the "Feature Flag Called" pairs. **None of them is on a dashboard.** That is the "filterTestAccounts off in places" the earlier audit found. Today it only affects someone who opens those old insights directly.
- **Other project-level configs with their own switch, both OFF at the time:** `revenue_analytics_config.filter_test_accounts` and `marketing_analytics_config.filter_test_accounts`. The Revenue analytics and Marketing analytics screens therefore included Slovakia, the scraper and the test rows. **Both were turned on in the follow-up (section 4).**

### Douyin "aweme" scraper
- **Volume:** 3,217 events from 668 "persons" since 2026-05-28, still active today. Each person has exactly 1 `$pageview`, plus `$opt_in`, `$consent_granted`, `$web_vitals` and `web_vitals_attribution`. Every referrer is `$direct`, and the pages are mostly `/blog/*`. Countries: CN 310 pageviews, US 354, plus 1 each from VN, JP, NL and AU.
- **User agent:** one frozen UA covers 664 of the 668: `Android 10; HD1900 … Chrome/75 (2019) … aweme_230400 … AppName/aweme … Region/CN … BytedanceWebview`. Four more pageviews come from a second Douyin UA (`aweme_250000`, PFFM10).
- **PostHog bot detection:** `isLikelyBot()` flags 0 of these events, which confirms the audit.
- **Every** aweme event contains the substring `AppName/aweme` (3,217 of 3,217).
- **Collateral check:** no TikTok-international traffic (`musical_ly`/`trill`) would be caught. The only other ByteDance webview traffic is `AppName/doubao` (14 pageviews from 21 persons, ByteDance's AI assistant). It is **kept**; see the owner section.

### The 2026-07-14 "backtick" rows
- `utm_campaign = "bio`"` (a stray backtick), with `utm_source` set to tiktok or instagram and `utm_medium = social`.
- **Volume:** 50 events, 10 sessions and 10 persons, all on 2026-07-14 between 11:01 and 16:17 UTC. 8 sessions were desktop Chrome/Edge in the US, and 2 were mobile pageviews in India (likely link-preview fetches). Every one landed on `/`.
- The value appears on no other day in the last 365 days. Every event in those sessions carries the tag (50 of 50), so an event-level filter removes whole sessions.
- **Why they are test traffic:** the bio link was being tested during the 07-14 audit, and no live profile carries a backtick link. The audit counted 11 rows; the live count is 10 sessions.

## 2. Research
- PostHog docs, "Internal and test users" (https://posthog.com/docs/data/test-accounts): each entry is a property filter describing the traffic to **keep**, and all entries are combined with AND. Negative operators (`does not contain`, `is not`) are the right shape. Event-property entries are supported.
- Tutorial, "How to filter out internal users" (https://posthog.com/tutorials/filter-internal-users): the filter applies project-wide to every insight that has it switched on.
- PostHog skill `filtering-bot-traffic` (served by the PostHog MCP): `isLikelyBot`/`$virt_is_bot` is a UA heuristic. The skill says a scraper PostHog doesn't detect should go into a custom bot rule (Settings → Custom bots). Custom bot rules write the admin-only `modifiers` team setting, which is a different project-wide setting from the one this brief allows, so I did not use them (see the owner section).

## 3. Plan
1. Append two negative event-property entries to `test_account_filters` and keep the four existing entries byte-for-byte.
   - `$raw_user_agent` `not_icontains` `AppName/aweme`. This is tighter than "aweme", and it matches all 3,217 scraper events and nothing else.
   - `utm_campaign` `is_not` `bio`` with the backtick: an exact value, used only on 2026-07-14.
2. Both operators let events with the property unset through. Mobile and server events have no `$raw_user_agent` and no `utm_campaign`, so they are unaffected. Verified with signup and purchase counts.
3. Verify with a fixed-window trend (2026-04-08 → 2026-10-04, `filterTestAccounts: true`) before and after. The expected drop is the per-month count of aweme and backtick pageviews outside Slovakia.

## 4. Execution

### Changed: project 155556 `test_account_filters` (the one allowed project-wide setting)
**Before** (4 entries): see above / `test_account_filters.before.json`.
**After** (6 entries, the first 4 unchanged):
```json
[{"key":"id","type":"cohort","value":100593,"operator":"not_in"},
 {"key":"internal","type":"person","value":["true"],"operator":"is_not"},
 {"key":"distinct_id not in ('<internal-id>', '<internal-id>', '<internal-id>')","type":"hogql"},
 {"key":"$geoip_country_code","type":"event","value":["SK"],"operator":"is_not"},
 {"key":"$raw_user_agent","type":"event","value":"AppName/aweme","operator":"not_icontains"},
 {"key":"utm_campaign","type":"event","value":["bio`"],"operator":"is_not"}]
```
Applied 2026-10-05 18:20 UTC (project `updated_at` 2026-10-05T18:20:13Z). **To undo:** PATCH `test_account_filters` back to the four-entry list.

### Changed (follow-up, authorized by team-lead): test-account filtering in Revenue and Marketing analytics
Applied 2026-10-05 about 18:35 UTC. I re-read both configs just before the change and they were unchanged since the first read. I sent each full object back with only `filter_test_accounts` flipped, so nothing else could be reset.
- `revenue_analytics_config`: **before** `{"base_currency":"USD","events":[],"filter_test_accounts":false}`, **after** the same with `"filter_test_accounts":true`.
- `marketing_analytics_config.filter_test_accounts`: **before** `false`, **after** `true`. Everything else in that object is unchanged: `sources_map {}`, the single `purchase_completed` conversion goal (id 0e473c48-…, same schema_map), `attribution_window_days 90`, `attribution_mode last_touch` and the empty mappings. Only the key order changed in the response.
- **Side effect I did not send:** `managed_viewsets.revenue_analytics` went from `false` to `true` in the same response. PostHog turns on its managed `revenue_analytics_*` warehouse views when the revenue config is saved. It is additive: with `events: []` and no Stripe source the views are empty. It cannot be changed back through `project-settings-update` (the field isn't in its schema). Flag it to rc-posthog in case item 1 relies on it.
- Effect: the Revenue analytics and Marketing analytics screens now exclude the same traffic as everything else: the internal/test cohort, `internal` people, the three hard-coded distinct_ids, Slovakia, the aweme scraper and the 07-14 test sessions.
- **To undo:** PATCH both `filter_test_accounts` back to `false`.

### Created: annotations (project scope), at https://eu.posthog.com/project/155556/data-management/annotations
| id | date_marker | what |
|---|---|---|
| 138558 | 2026-10-05 12:00Z | "3.21.0 INTERNAL TEST": TestFlight build 94 and Play internal vc 90; 3.21.0 events are testers only; lists what 3.21.0 changes |
| 138559 | 2026-10-05 12:05Z | "PLACEHOLDER: how to read EU numbers after 3.21.0" (the full explainer below, condensed). **The owner must move its date to the production release day.** I edited the text once at 18:21 to fix the server event name and add the geo caveat. |
| 138560 | 2026-10-05 18:20Z | "DATA HYGIENE": what this filter change does, so the retroactive drop in web numbers isn't a mystery |

Nothing was deleted. The existing annotations 111074 and 111404 were not touched. The `onboarding_ab_2026` flag was not touched.

## 5. Verification (self-review)
I re-read the project afterwards: `test_account_filters` holds the six entries above and `default_checked` is still true.

Trend with `filterTestAccounts: true`, window 2026-04-08 → 2026-10-04. I shifted `date_from` by one day for the "after" run because the first re-run returned a cached result; April has 0 pageviews either way.

| month | $pageview before | after | Δ | predicted Δ (aweme + backtick) | unique users before → after | user_signed_up | purchase_completed |
|---|---|---|---|---|---|---|---|
| May | 358 | 353 | −5 | 5 + 0 | 280 → 275 | 41 → 41 | 10 → 10 |
| Jun | 804 | 787 | −17 | 17 + 0 | 659 → 642 | 33 → 33 | 7 → 7 |
| Jul | 1,728 | 1,640 | −88 | 78 + 10 | 1,563 → 1,475 | 25 → 25 | 7 → 7 |
| Aug | 2,442 | 2,198 | −244 | 244 + 0 | 2,246 → 2,002 | 56 → 56 | 9 → 9 |
| Sep | 3,284 | 3,015 | −269 | 269 + 0 | 3,044 → 2,775 | 44 → 44 | 9 → 9 |
| Oct 1–4 | 481 | 435 | −46 | 46 + 0 | 436 → 390 | 5 → 5 | 1 → 1 |

The drop matches the prediction exactly in every month, and the mobile and server events (signups, purchases) are unchanged, so nothing legitimate was excluded. **Saved insights can show the old numbers until they recalculate (cache).**

## 6. How to read EU numbers after 3.21.0
Source: `apps/mobile/src/lib/analytics-consent.ts` and `apps/api/src/modules/analytics/signup-events.service.ts` on `main`.

**What changes.** 3.21.0 has one consent gate for PostHog events (including the SDK's own lifecycle events), session replay, install attribution and RevenueCat attribution.
- **Opt-in regions:** the EEA, UK and Switzerland, plus devices whose region is **unknown**. Nothing is sent until the rider taps accept.
- **Riders already on the app:** an existing EU rider whose stored value is the old pre-3.21 "yes" is asked once and is silent until they answer. A legacy "no" is honoured.
- **Everywhere else:** opt-out, so events flow by default.
- **How the region is decided:** from the **device locale region** (`expo-localization`), not from GeoIP.

**Metrics that drop (EU, UK and CH mobile only).** These move from "every rider" to "riders who accepted":
- installs and first opens, onboarding funnels, DAU/WAU/MAU, `$screen`
- every feature event (`expense_added`, `ride_saved`, `core_action_milestone`, receipt scan…)
- the **client-side** `user_signed_up`
- paywall views, retention and lifecycle, replay volume
- `install_attribution_captured`, `referral_source_selected`

Riders who decline never appear at all, so there is no "declined" event to count.

**Metrics that don't drop.**
- **Web (motovault.app):** it has its own cookie banner (`$opt_in`/`$consent_granted`), which 3.21.0 does not change.
- **Mobile outside the EU, UK and CH.**
- **The server event `signup_completed`** (`emitted_by = server_sweep`). It is complete for everyone. For decliners it arrives under a single distinct_id `signup-no-consent` with `analytics_consent = false` and no person profile. Count it with **Total count**, never Unique users (all decliners collapse into one "user"). Decliners cannot appear in any funnel step.
- **Revenue:** take it from RevenueCat or the stores, not from PostHog EU funnels.

**Reading rules.**
1. A step down in EU mobile series on the release date is the consent model, not broken tracking.
2. Compare EU before and after only on `signup_completed` totals or on store and RevenueCat data.
3. To estimate the EU opt-in rate, divide `analytics_consent_granted` by `signup_completed`, both restricted to EU riders. `analytics_consent_granted` only exists from 3.21.0, and today it comes from internal testers only.
4. `signup_completed` has **no usable country**: its `$geoip_country_code` is the API server's location, always "US" (238 of 238 events in the last 60 days). Use its `currency` property (EUR/GBP/CHF…) as the EU proxy.
5. Client events are geo-located by IP while consent uses the device's locale region. An EU-locale rider abroad, or a US-locale rider in the EU, will make country breakdowns differ slightly from the consent line.
6. While 3.21.0 is internal-only, any 3.21.0 events are testers'. The 3.21.0 internal-test annotation (138558) marks this.

## 7. Left for the owner
1. **Move annotation 138559** to the 3.21.0 production release date (Data management → Annotations → edit date), and delete the word "PLACEHOLDER". The lead owns this and will do it at release.
2. ~~Revenue and marketing analytics have the test-account filter off.~~ **Done** 2026-10-05 on the lead's authorization; see section 4. Its side effect is that `managed_viewsets.revenue_analytics` is now true.
3. **Optional: add a custom bot rule for the scraper.** In Settings → Environment → Custom bots, add a rule `$raw_user_agent contains AppName/aweme`, name "Douyin scraper". This makes `$virt_is_bot` and Web analytics' bot handling agree with the test filter. It writes the admin-only `modifiers` setting, which is why I left it.
4. **Decide on Doubao** (`AppName/doubao`, ByteDance's AI assistant in-app browser, 14 pageviews). It is probably AI-assistant fetches rather than riders, and was left in on purpose. If you want it out, add `$raw_user_agent not_icontains AppName/doubao` the same way.
5. **The 68 older saved insights with the filter off** are not on any dashboard. Either flip `filterTestAccounts` on as you open them, or ignore them. The full id list is reproducible with the query in section 1:
   - the default templates 3783599–3783604
   - the batches 3783903–3784101, 3791544–3791549, 3794712–3794716, 3931473–3931475, 3934743–3934755, 4017973–4018054
   - the Feature Flag Called pairs 4143138/9 and 4495892/3
6. **Code follow-up (for the lead's PR):** in `apps/api/src/modules/analytics/signup-events.service.ts` → `buildEvent`, set `properties.$geoip_disable = true`. That stops every `signup_completed` being tagged as a US visit from the server IP. As it stands, any country breakdown or a country-based test filter (the SK entry) cannot apply to this event.
7. **Brief correction:** the server-side signup event is `signup_completed`. `user_signed_up` is the mobile-SDK event (lib `posthog-react-native`) and **will** drop for EU decliners.
