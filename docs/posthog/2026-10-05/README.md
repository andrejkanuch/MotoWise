# PostHog setup for 3.21.0 — 2026-10-05

PostHog now matches the app that ships in 3.21.0. RevenueCat purchases reach PostHog again, from our own server (PR #263). Bot and test traffic is filtered, and a Social → Paid dashboard and a milestone survey are live. No saved insight needed migrating. Everything was changed additively; nothing was deleted.

Follow-up to the [Social Campaign Attribution Audit](https://claude.ai/code/artifact/7c902bb4-59d3-417e-ab79-9c4cc4564cde) and to PRs #260, #261 and #262. PostHog project 155556 (EU).

## What was done

| # | Item | Result | Record |
|---|------|--------|--------|
| 1 | RevenueCat → PostHog | The dashboard integration last delivered in June, and most of what it sent was sandbox data. It is replaced by server-side capture from our webhook (PR #263), which skips sandbox purchases and covers web purchases. It applies consent (see "Purchase consent rule" below). A declined rider's purchase is anonymous, carries no RevenueCat id and is dated to the day only. The web now saves the rider's cookie-banner choice to their account. | [rc-posthog.md](rc-posthog.md) (§9–§16 record each review round) |
| 2 | Data hygiene | The project test-account filter now also drops the Douyin `AppName/aweme` scraper and the 2026-07-14 backtick test rows. Slovakia was already excluded. Test filtering is also on in Revenue and Marketing analytics. | [hygiene.md](hygiene.md) |
| 3 | Social → Paid dashboard | Dashboard [999445](https://eu.posthog.com/project/155556/dashboard/999445), 7 tiles on 28-day vs previous 28-day windows, plus a how-to-read tile. | [dashboard-survey.md](dashboard-survey.md) |
| 4 | Milestone survey | A two-question survey (Sean Ellis + "what would you pay for"), triggered by `core_action_milestone` and shown once per person. Launched. Its targeting flag (301161) was activated, without which React Native never shows it. | [dashboard-survey.md](dashboard-survey.md) |
| 5 | Saved insights | 142 insights, 10 dashboards, cohorts, actions, flags and the survey were searched. None filter on mobile `$screen_name` values or on the removed Meta alias events, so none were edited. | [insight-migration.md](insight-migration.md) |
| 6 | 3.21.0 screen names | The first 3.21.0 `$screen` events pass: route templates, `feature_area` set, no ids. The privacy check is saved as insight [yS1dc5xy](https://eu.posthog.com/project/155556/insights/yS1dc5xy) ([screen-check.sql](screen-check.sql)). | [insight-migration.md](insight-migration.md) |
| 7 | EU numbers after 3.21.0 | Annotations 138558–138560 mark the internal test and the filter change. The explainer is below. | [hygiene.md](hygiene.md) |

## Purchase consent rule (PR #263)

- **App Store / Play purchases:** sent under the rider's account unless they said "no". A missing decision counts as consent for now, because app versions before 3.21.0 never saved one.
- **Web purchases:**
  - a "no" in the app or on the web banner keeps the purchase anonymous;
  - otherwise a clicked "yes" sends it under the rider's account;
  - with no decision saved, the buyer's RevenueCat country decides: outside the EEA/UK/Switzerland it is sent under the account; inside, or when the country is missing, it stays anonymous.
- **The web banner and the account:**
  - only a clicked choice is saved to the account, never the automatic "yes" given outside the EU;
  - the background sync can only fill an empty account value or change "yes" to "no"; a "no" becomes a "yes" only through an Accept click;
  - Undo clears only a saved "yes".
- **One country list in three places:** the API, the web site and the app all use the same 39-country opt-in list (EEA, UK, Switzerland and the EU's overseas regions); change all three together. The web's copy is in `apps/web/src/lib/consent-region.ts`.

## How to read EU numbers after 3.21.0

Riders in the EEA, the UK and Switzerland must opt in before the app sends anything.

- **Will drop:** EU mobile installs, onboarding, active users, screens, feature events, paywall views, retention, replay and attribution. Riders who decline send nothing. Upgraded EU riders send nothing until they answer the consent screen.
- **Will not drop:**
  - web
  - mobile outside those regions
  - store revenue
  - server-side `signup_completed`, which counts everyone. Decliners land under one id, `signup-no-consent`, so count totals, never unique people.
- **Region comes from the device's locale setting, not the IP country.**
- **3.21.0 screen views:** tab switches now count as screen views, so screen views per user rise with no change in behaviour. Compare by app version, or count people.

## Left for the owner

1. **Keep RevenueCat's own PostHog integration off.** PR #263 sends the events now, so leaving it on counts every purchase twice.
2. **After PR #263 deploys:** run the verification query in its test plan.
3. **At the 3.21.0 production release:**
   - Move annotation 138559 to the release date and drop "PLACEHOLDER".
   - Re-run insight yS1dc5xy once testers have opened a bike, an article, a shared trip link and a rider profile.
4. **Optional:**
   - Add a custom bot rule for `AppName/aweme`, so Web Analytics agrees with the test filter.
   - Decide whether to filter `AppName/doubao`, ByteDance's AI browser (14 pageviews). It is currently kept.
5. **Known data gap:** `signup_completed` before PR #263 always records the country as the US, because the event came from the API server's IP. Use its `currency` property as the EU stand-in for that period.
