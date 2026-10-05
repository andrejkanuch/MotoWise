# dashboard-survey — items 3 (Social → Paid dashboard) and 4 (core_action_milestone survey)

Agent: `dashboard-survey`, 2026-10-05. Project 155556 (EU). All changes additive; nothing deleted; `onboarding_ab_2026` untouched; no project settings changed.

## Investigation

- Project test-account filter (default on) already excludes cohort 100593, `internal=true` persons, 3 distinct_ids and `$geoip_country_code = SK`. Every tile sets `filterTestAccounts: true`, so Slovakia and test accounts are out.
- Event volume, last 90 days, Slovakia excluded:

  | Event | Events | People | Note |
  |---|---|---|---|
  | Application Installed | 845 | 806 | install denominator |
  | store_cta_click | 342 | 312 | utm_source mostly null (30 chatgpt.com) |
  | store_cta_click_server | 508 | 1 (constant anon id) | utm_source only since #260 |
  | referral_source_selected | 271 | 262 | no facebook/reddit answers yet (3.21.0 only) |
  | get_link_opened | 27 | 1 (constant anon id) | all on 2026-10-05, the day /get shipped |
  | purchase_completed | 23 | 22 | mixes trials and paid |
  | install_attribution_captured | 17 | 17 | all `organic_unknown` |
  | checkout_initiated | 2 | 2 | 2026-09-15 |
  | checkout_completed, core_action_milestone, rc_* | 0 | 0 | not ingested yet |

- From the code: `install_source` is a `$set_once` **person** property (`apps/mobile/src/lib/meta-attribution.ts`), not an event property. `get_link_opened` and `store_cta_click_server` are sent server-side under one constant distinct_id with `$process_person_profile: false` (`apps/web/src/lib/anonymous-counter.ts`), so they can only be counted as totals. /get sources are instagram, tiktok, facebook, youtube, other (`apps/web/src/lib/get-link.ts`).
- **A trap I found and worked around:** the project runs person-on-events with *event-time* person properties. On `purchase_completed`, `person.properties.heard_from` was null for 15 of 22 purchasers, but the current person has it (the TikTok purchaser disappears with event-time props). The person-level tiles therefore read `pdi.person.properties.*` (the current person row). Checked: this yields 20 other/direct, 1 instagram, 1 tiktok over 90 days, which matches the audit (22 purchasers, 1 TikTok, 1 Instagram). A `modifiers.personsOnEventsMode` override was silently ignored by the query tool, so it was not used.

## Research (sources)

- PostHog skill `posthog:debugging-surveys` (instance-versioned): React Native supports event-based triggers and flag targeting; URL/selector conditions make RN skip the survey entirely; `surveyPopupDelaySeconds` and the "wait period" are not implemented on RN; partial responses are web-only.
- RN SDK source in the repo, `node_modules/posthog-react-native` 4.47.2, `dist/surveys/getActiveMatchingSurveys.js`: a survey with event conditions shows only after the event is captured in-session, and the internal targeting flag must evaluate true (`!!flags[key] === true`) unless the survey repeats.
- https://posthog.com/docs/surveys/creating-surveys (display conditions, event-triggered "every time or just once") and https://posthog.com/docs/references/posthog-react-native/types/PostHogSurveyProviderProps (`autoPresentSurveys`: a deferred survey stays armed and fires no "survey shown" until presentation is re-enabled).
- https://github.com/PostHog/posthog-js/issues/2961: RN ignores `schedule: 'always'`; only `repeatedActivation` repeats. Not used here.
- From agent rc-posthog: the integration is NOT live (no rc_* events since 2026-06-26; the fix waits on the owner in RevenueCat). The project used custom names without `_event` (rc_initial_purchase, rc_trial_converted, rc_non_subscription_purchase, …), but the owner may switch to the defaults, so tile 7 matches both. Properties: revenue, currency, store (APP_STORE / STRIPE seen; PLAY_STORE expected), product_id, period_type, platform (missing on 3 of 23 events). Paid = initial purchase with revenue > 0 and not a trial, OR trial converted, OR non-subscription purchase.
- RevenueCat → PostHog default event names (https://www.revenuecat.com/docs/integrations/third-party-integrations/posthog): `rc_initial_purchase_event`, `rc_trial_started_event`, `rc_trial_converted_event`, `rc_renewal_event`, `rc_non_subscription_purchase_event`, …; properties `revenue`, `currency`, `product_id`, `store`.

## Execution

### Item 3: dashboard "Social → Paid"

Dashboard **999445**: https://eu.posthog.com/project/155556/dashboard/999445 (tags attribution, social, 3.21.0)

All insight tiles are TrendsQuery tables: last 28 days (`-28d`) compared with the previous 28 days (`compareFilter.compare`), weekly interval, test accounts filtered.

Platform bucket used in tiles 2, 5 (event `utm_source`):
`multiIf(lower(toString(properties.utm_source)) IN ('instagram','tiktok','facebook','youtube'), lower(toString(properties.utm_source)), 'other / direct')`

"Any signal" bucket used in tiles 6, 7 (current person): `install_source` link, then `$initial_utm_source`, then the survey answer `heard_from`, each checked against instagram/tiktok/facebook/youtube, else `other / direct`.

| # | Tile (insight id / short_id) | Query | Verified result (last 28 d vs prev 28 d) |
|---|---|---|---|
| — | Text "How to read this dashboard" (tile 7151518) | what each step means, the 4-week rule, "any one signal counts", caveats | n/a |
| 1 | Bio-link opens (/get) by platform (6353611 / `BbBvktvL`) | `get_link_opened` total, breakdown `source` × `platform` | 27 opens, all on 2026-10-05 (launch day, likely the owner's own checks; geoip on these server-side events is the server's, so the SK filter cannot catch them). Real reads start next window. |
| 2 | Store button clicks by platform (6353612 / `Yq6p6pig`) | `store_cta_click` + `store_cta_click_server` totals, event bucket | 146 vs 137 (consented), 214 vs 197 (counter); 100% other/direct, as the audit predicted |
| 3 | App installs by recorded install source (6353613 / `dp6jXDxR`) | `Application Installed` + `install_attribution_captured` unique people, bucket on current `install_source` (social / organic (no link) / other link / no source recorded) | 286 vs 296 installs; 5 vs 5 recorded a source, all organic. Social rows appear once Android 3.21.0 bio-link installs land. |
| 4 | "How did you hear about us?" answers (6353622 / `06cfzgcN`) | `referral_source_selected` unique people by `referral_source` | TikTok 10 vs 6, Instagram 3 vs 3, YouTube 6 vs 7; facebook/reddit rows appear with 3.21.0 |
| 5 | Web checkout started / completed by platform (6353624 / `8e5S0D6S`) | `checkout_initiated` + `checkout_completed` unique people, event bucket | 2 starts (other/direct), 0 completions. `checkout_completed` has never fired: it first ships with #260. |
| 6 | Purchasers by platform (any signal), includes trials (6353627 / `irV3u9Ji`) | `purchase_completed` unique people, any-signal bucket | 7 (6 other/direct, 1 instagram) vs 7 |
| 7 | PLACEHOLDER: Paid subscribers by platform × store (RevenueCat), empty until RC events flow (6353633 / `BCy5zCFf`) | Unique people in an OR-group (see "Tile 7 definition" below), any-signal bucket (adds the web first-touch `ft_utm_source`) × event `store` | The saved insight parses and runs. The 28-day window is empty, as expected. Over 365 days the same query returns 2 people (other/direct, STRIPE) from the Apr–Jun historical events, which are mostly sandbox. |

Layout: text full width at top, then tiles 1–6 in a 2-column grid, then tile 7 full width at the bottom.

### Tile 7 definition (final, per team-lead 2026-10-05)

RevenueCat data comes from **our API's webhook capture** (agent rc-posthog, `apps/api/src/modules/webhooks/revenuecat-posthog.ts` on branch `feat/api-revenuecat-posthog`), not from RevenueCat's dashboard integration. Paid = the first paid conversion only. Each branch maps to one node of the OR-group:

| Branch | Event | Filter |
|---|---|---|
| Webhook (custom names) | `rc_initial_purchase` | `period_type != 'TRIAL'` |
| Webhook | `rc_renewal` | `is_trial_conversion` true (the one renewal that converts a trial; plain renewals are excluded) |
| Webhook | `rc_non_renewing_purchase` | none (lifetime) |
| Old dashboard integration (kept) | `rc_initial_purchase_event` | `revenue > 0 AND period_type != 'TRIAL'` |
| Old dashboard integration (kept) | `rc_trial_converted`, `rc_trial_converted_event` | none |
| Old dashboard integration (kept) | `rc_non_subscription_purchase`, `rc_non_subscription_purchase_event` | none |

The source bucket reads current person properties: `install_source`, then `ft_utm_source` (web first touch from #260, the same field rc-posthog's query uses), then `$initial_utm_source`, then `heard_from`; else other / direct. The second breakdown is `store` (STRIPE = web checkout).

Caveat: the webhook sends events from riders without analytics consent under a constant distinct_id with person processing off. All such riders count as **one** person, in "other / direct". Their sources are unknown anyway.

Change log for insight 6353633 (my own object):
- v1: default names only (`rc_initial_purchase_event`, `rc_trial_converted_event`, `rc_non_subscription_purchase_event`), no filters, platform bucket only.
- v2: added the custom names, the `revenue > 0 AND period_type != TRIAL` filter and the `store` breakdown.
- v3 (current): added the webhook branches (`rc_initial_purchase` with period_type != TRIAL, `rc_renewal` with is_trial_conversion, `rc_non_renewing_purchase`) and `ft_utm_source` in the bucket; renamed the tile. Every earlier event branch is kept.

Tile 6 is unchanged; its bucket does not include `ft_utm_source`.

### Item 4: survey

Survey **01a10d4c-86e9-0000-a583-fd5f9d992644** "How would you feel without MotoVault?": https://eu.posthog.com/project/155556/surveys/01a10d4c-86e9-0000-a583-fd5f9d992644

- Type popover, rendered by the app's existing `PostHogSurveyProvider` (`apps/mobile/src/app/_layout.tsx:1058`).
- Q1 single choice (required): "How would you feel if you could no longer use MotoVault?" with Very disappointed / Somewhat disappointed / Not disappointed (question id `772f03a8-917a-490b-99b5-300cdfdd45db`).
- Q2 open, optional: "What would you pay for in MotoVault?" with helper text "One thing is enough. Skip if nothing comes to mind." (id `2d6c9b49-75eb-45e8-843c-1c74a282f3e8`).
- Thank-you message: "Thanks, that helps a lot."
- **Targeting:** `conditions.events = [core_action_milestone]`, `repeatedActivation: false`, `schedule: once`. No URL or device conditions (RN would drop the survey if it had a URL condition) and no person targeting. "Once per person" is enforced by the internal targeting flag `survey-targeting-35fc068e28-custom` (id **301161**): it requires `$survey_dismissed/<id>` and `$survey_responded/<id>` to be unset. A rider who dismisses it is never asked again. The milestone event fires once per kind (ride_saved, service_logged), so a rider can trigger it twice, but they still see it once.
- Launched 2026-10-05T18:21:28Z with `survey-launch`. Today only 3.21.0 internal testers (TestFlight build 94, Play internal vc 90) send `core_action_milestone`.
- **Fix applied after launch:** the launch left internal flag 301161 at `active: false`. With an inactive flag, `/flags` omits the key and the RN SDK (`isSurveyFlagEnabled`) treats it as false, so the survey would **never** have shown. I enabled it with `feature-flag-enable` (before: active=false, version 1; after: active=true, version 2; filters unchanged). Only the survey's own auto-created flag was touched.

## Self-review / verification

- Ran `insight-query` on all 7 saved insights: tiles 1–6 return the numbers above, and tile 7 returns "no data" as expected.
- `dashboard-get` confirms 8 tiles with non-overlapping layouts. The text tile's agent_context had a stray `"}`, which I fixed.
- Survey: `survey-get` shows start_date set, no end_date, not archived. The public SDK endpoint `GET eu.i.posthog.com/api/surveys/?token=…` lists the survey with its event condition and internal flag key. `POST /flags?v=2` for a probe distinct_id now returns `survey-targeting-35fc068e28-custom: enabled=true (condition_match)`. Before the fix it returned nothing.
- Not verified on a device: no `survey shown` yet, because `core_action_milestone` has never been ingested (0 events). Expect zero responses until a 3.21.0 tester saves a 3rd ride or service on one install.

## Left for the owner

1. **Device check (5 minutes):** on a 3.21.0 build, with analytics consent on, save 3 rides (or log 3 services). The milestone counter starts at 0 on 3.21.0 per install, so older rides do not count. The popover should appear, and the answer should land in the survey's Results tab. If a formSheet is open when the event fires, check `autoPresentSurveys`: the provider does not set it, so the default `true` applies.
2. **Appearance:** the survey uses PostHog's default light popover in a dark-first app. If it looks off, set colors in the survey's Customization tab (or `defaultSurveyAppearance` on the provider in code). I left it at the defaults on purpose.
3. **Tile 7:** it covers the webhook names and both older integration spellings (custom, and default with `_event`). It needs editing only if the event names change again. Once it shows data, read tile 7 instead of tile 6. Its history before 2026-10-05 is mostly sandbox, but that falls outside the 28-day window.
   - Change log for insight 6353633 (my own object): the first version used only the default `_event` names, with no revenue/trial filter and no store breakdown. The update added the custom names, the `revenue > 0 AND period_type != 'TRIAL'` filter on initial purchase, and the `store` breakdown, and renamed the tile to "… by platform × store …".
4. **First honest read:** 4 weeks after 3.21.0 reaches the stores. Before that, the facebook/reddit survey answers, Android bio-link installs and `checkout_completed` have little or no data.
5. Discount codes (RIDEIG/RIDETT/RIDEFB) are not on the dashboard: code redemptions reach PostHog only through RevenueCat (`offer_code`) once the integration is live. Add a breakdown on that property to tile 7 then.
6. Optional: report to PostHog that `survey-launch` left the internal targeting flag inactive (not filed).
