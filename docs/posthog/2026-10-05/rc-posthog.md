# rc-posthog — item 1: RevenueCat → PostHog (2026-10-05)

> **UPDATE: the lead chose Option B. It is implemented in PR https://github.com/andrejkanuch/MotoWise/pull/263** (branch `feat/api-revenuecat-posthog`; open, not merged). The webhook now captures RevenueCat events into PostHog itself, using the signup sweep's consent rule.
> - The RevenueCat dashboard PostHog integration must stay **OFF**, so §4 no longer applies.
> - The current paid-subscribers query is in §8; it replaces §6.

Nothing was changed in PostHog or RevenueCat. The integration can only be configured in the RevenueCat dashboard, so the owner has to make the change. Steps are below.

## 1. Investigation (what is true today)

**The integration ran from 2026-04-28 to 2026-06-26, then stopped.** PostHog project 155556 has no RevenueCat events in the last 90 days. Over the last 2 years it holds 23 `rc_*` events:

| event | n | first | last |
|---|---|---|---|
| rc_renewal | 11 | 2026-04-28 | 2026-06-25 |
| rc_expiration | 4 | 2026-04-28 | 2026-06-26 |
| rc_initial_purchase | 4 | 2026-05-07 | 2026-05-07 |
| rc_cancellation | 3 | 2026-05-14 | 2026-06-25 |
| rc_billing_issue | 1 | 2026-06-20 | 2026-06-20 |

- **Event names were customized** to `rc_<type>` without RevenueCat's default `_event` suffix. Six persons still carry the `rc_subscription_status` person property from that period.
- **The data was mostly test data.** One person who appears to be a test account got 8 renewals of an *annual* product on consecutive days in June. That pattern only happens with sandbox purchases, so sandbox events reached the production project. The 4 `rc_initial_purchase` events were all `store=STRIPE` on one day (2026-05-07); two of them came from SK (the owner). No event carries an `environment` property, so in PostHog sandbox events cannot be told apart from real ones.
- **Delivery was partial even while it was on.** The API's own webhook log (`public.revenuecat_webhook_events`, read-only check through the Supabase Management API) recorded 7 INITIAL_PURCHASE in May and 3 in June. PostHog received 4 and 0. Since July the webhook has recorded 9 INITIAL_PURCHASE and 13 RENEWAL (e.g. a Play purchase on 2026-10-01, a cancellation on 2026-10-03); PostHog received none of them.
- **Identity is already wired correctly in the app.**
  - Mobile: `loginRevenueCat` calls `Purchases.logIn(supabaseUuid)` and then `setAttributes({$posthogUserId: supabaseUuid})` (`apps/mobile/src/lib/subscription.ts:310-324`).
  - Before sign-in, `stampAnonymousPosthogId` stamps the PostHog anonymous distinct_id on an anonymous RevenueCat customer (`subscription.ts:299-308`).
  - PostHog `identify(userId)` uses the same UUID (`apps/mobile/src/lib/analytics.ts:434`, `apps/web/src/lib/analytics.ts:155`).
  - RC events therefore land on the same person, either through `$posthogUserId` or through RevenueCat's documented fallback to `app_user_id`.
- **Web Billing is included.** Web checkout configures `Purchases.configure({ apiKey, appUserId: userId })` (`apps/web/src/app/pro/checkout/page.tsx:48`), so the identity is the Supabase UUID. The May events show Web Billing purchases arriving with `store: "STRIPE"` and Stripe `prod_…` product ids. RevenueCat's PostHog doc has no "Web Billing" column, only "Stripe", and the historical data confirms that column covers Web Billing.
- **Sources available for the breakdown (person properties):**
  - `ft_utm_source`: web first touch, from #260.
  - `install_source`: from `install_attribution_captured`, `$set_once`. Almost always `organic_unknown`.
  - `heard_from`: HDYHAU self-report. About 290 persons; top values are ai_chat, google_search, other, app_store_search and tiktok.
  - `$initial_utm_source`.
- **Mobile `purchase_completed` cannot replace the RC events.** In the last 90 days there were 23 events, but only 9 have a UUID distinct_id; the rest are pre-sign-up anonymous ids. The event also never sees renewals, expirations or web purchases.

## 2. Research (sources)

- RevenueCat PostHog integration: https://www.revenuecat.com/docs/integrations/third-party-integrations/posthog (also the `.md` copy at the same path).
  - It is set up in the dashboard: Project settings → Integrations → PostHog.
  - It needs the PostHog **Project API key** (a public key; no personal key is needed).
  - The region can be US (default), EU or self-hosted.
  - Event names are configurable. The defaults are `rc_initial_purchase_event`, `rc_trial_started_event`, `rc_trial_converted_event`, `rc_trial_cancelled_event`, `rc_renewal_event`, `rc_cancellation_event`, `rc_uncancellation_event`, `rc_non_subscription_purchase_event`, `rc_subscription_paused_event`, `rc_expiration_event`, `rc_billing_issue_event` and `rc_product_change_event`.
  - Identity is `$posthogUserId`, falling back to the RevenueCat app user id.
  - Stores covered: App Store, Play Store, Amazon and Stripe. Transfer events are not sent.
  - Sandbox: "You can input both keys" (production and sandbox). The sandbox key should point at a separate project, or be left empty.
  - Events carry `revenue`, `currency`, `product_id`, `store`, `period_type`, `rc_subscription_status` and `subscriber_attributes`, and set person property `rc_subscription_status`.
- RevenueCat API v2 "Integration" endpoints (https://www.revenuecat.com/docs/api-v2/integration) manage **webhooks only**. Third-party integrations such as PostHog cannot be configured through the API. The RevenueCat MCP server needs interactive OAuth, which I did not attempt.

## 3. Plan

1. The owner re-enables or repairs the integration in the dashboard (steps in §4) and keeps the historical event names so old and new data line up.
2. The integration must **not** receive sandbox events in project 155556.
3. After the change, run the verification query (§5).
4. Hand the paid-by-source query (§6) to `dashboard-survey`.

**Decision needed from the owner: consent.** From 3.21.0, EEA/UK/CH riders opt in to analytics. RevenueCat sends purchase events server-side and keys them by `$posthogUserId`, falling back to the app user id (the Supabase UUID). `loginRevenueCat` sets `$posthogUserId` without checking consent. So once the integration is on, the purchases of riders who said **no** become identified PostHog events. The signup sweep handles this by bucketing those users (`signup-events.service.ts`, `analytics_enabled === false` → `signup-no-consent`). There are two options:

- **A. Dashboard integration (fast, no code).** Accept the consent gap or clear it legally. Sandbox can only be separated by key.
- **B. Server-side capture from the existing webhook (`apps/api/src/modules/webhooks/revenuecat.service.ts`), recommended if consent must hold.**
  - It mirrors the signup sweep: same EU host and the same consent rule, and it emits `rc_*` events with `store`, `environment`, `revenue`, `product_id` and `period_type`.
  - It skips `environment = SANDBOX`.
  - It covers RC_BILLING/STRIPE, because the webhook already receives every store.
  - This is code work for the lead's PR, not a PostHog change. If B is chosen, keep A turned off to avoid double counting.

## 4. Owner steps (Option A, dashboard-only)

1. In the RevenueCat dashboard, open the MotoVault project → **Integrations** (left sidebar).
   - If **PostHog** is listed, open it.
   - Otherwise click **+ New** → **PostHog**.
2. Check what you see there:
   - Does it show an error or "disabled"?
   - Which region is selected?
   - Is the sandbox key the same as the production key?

   Note the answers. Together they explain why delivery stopped after 2026-06-26 and why sandbox data arrived.
3. **PostHog Project API key (production):** in PostHog, open project 155556 → **Settings → Project → General → Project API key** (starts with `phc_`) and paste it into the production field.
   - Do not use a personal API key.
   - Do not paste it into a chat or document.
4. **Sandbox API key:** leave it **empty**, or use the key of a separate test project. Never use project 155556.
5. **Region:** **EU** (`https://eu.i.posthog.com`).
6. **Event names:** keep the historical custom names so old data lines up:
   - `rc_initial_purchase`, `rc_trial_started`, `rc_trial_converted`, `rc_trial_cancelled`
   - `rc_renewal`, `rc_cancellation`, `rc_uncancellation`
   - `rc_non_subscription_purchase` (lifetime), `rc_expiration`, `rc_billing_issue`, `rc_product_change`, `rc_subscription_paused`

   Enable all optional events, especially non_subscription_purchase, because Lifetime Pro is a NON_RENEWING_PURCHASE.
7. **Revenue:** choose to report revenue **net of** store commission and taxes if offered (it matches the RC dashboard proceeds). Either choice works; write down which one you picked.
8. Save. Then use RevenueCat's **Send test event** if the page offers it, or wait for the next real event (purchases come in roughly every few days).

## 5. Verification query (run after the owner saves)

```sql
SELECT event, count() AS n, uniq(person_id) AS persons,
       countIf(length(distinct_id) = 36) AS uuid_ids,
       groupUniqArray(toString(properties.store)) AS stores,
       max(timestamp) AS last_ts
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY AND startsWith(event, 'rc_')
GROUP BY event ORDER BY n DESC
```

Pass criteria:

- New `rc_*` rows appear.
- `uuid_ids` matches `n` for signed-in purchasers.
- `stores` includes PLAY_STORE or APP_STORE.
- Every new event appears in the webhook log for the same day:

  ```sql
  SELECT event_type, store, environment, count(*)
  FROM public.revenuecat_webhook_events
  WHERE processed_at > now() - interval '7 days'
  GROUP BY 1, 2, 3
  ```

  Every PRODUCTION INITIAL_PURCHASE / RENEWAL there should have a PostHog counterpart, and no SANDBOX row should.

## 6. Hand-over to `dashboard-survey`: "paid subscribers per source per 4 weeks"

- **Definition:** a person counts once, in the 4-week bucket of their **first paid event**. A first paid event is one of:
  - `rc_initial_purchase` with revenue > 0 and `period_type` ≠ TRIAL
  - `rc_non_subscription_purchase` (lifetime)
  - `rc_trial_converted`

  The default `_event` names are also matched in case they are re-enabled.
- **Exclusions:** SK and `internal` persons. The `hygiene` agent may replace this with the project test filter.
- **Buckets:** 28 days, anchored on Monday 2026-01-05.
- **Source:** measured first, then `unattributed`; the self-report is a separate column.
- **Check:** this query was run against the historical data. It executes and returns 1 paid US Stripe subscriber (2026-04-27 bucket, unattributed); the SK test purchases were correctly excluded. Expect empty buckets until events flow again.

```sql
SELECT addDays(toDate('2026-01-05'), 28 * intDiv(dateDiff('day', toDate('2026-01-05'), toDate(first_paid)), 28)) AS period_start,
       source, self_reported, store, count() AS paid_subscribers
FROM (
  SELECT person_id, min(timestamp) AS first_paid,
         argMin(toString(properties.store), timestamp) AS store,
         any(coalesce(nullIf(toString(person.properties.ft_utm_source), ''),
                      if(person.properties.install_source IN ('organic_unknown', ''), NULL, toString(person.properties.install_source)),
                      nullIf(toString(person.properties.$initial_utm_source), ''),
                      'unattributed')) AS source,
         any(coalesce(toString(person.properties.heard_from), 'not_asked')) AS self_reported
  FROM events
  WHERE timestamp > now() - INTERVAL 365 DAY
    AND ((event IN ('rc_initial_purchase','rc_initial_purchase_event','rc_non_subscription_purchase','rc_non_subscription_purchase_event')
          AND toFloat(properties.revenue) > 0 AND ifNull(toString(properties.period_type), '') != 'TRIAL')
         OR event IN ('rc_trial_converted','rc_trial_converted_event'))
    AND ifNull(person.properties.$initial_geoip_country_code, '') != 'SK'
    AND NOT ifNull(person.properties.internal, false)
  GROUP BY person_id)
GROUP BY period_start, source, self_reported, store
ORDER BY period_start, paid_subscribers DESC
```

Suggested tiles:

1. This query as a table.
2. A stacked bar of `period_start` × `source`.
3. The same with `self_reported` instead of `source`. Self-report is the only signal for most mobile installs today.

Also consider an "active paid now" tile: persons whose `rc_subscription_status` = active, broken down by the same source expression.

## 7. Self-review

- PostHog: no objects were created or edited (read-only SQL only). Nothing to roll back.
- Supabase: read-only `SELECT`s through the Management API; no PII was read or written. `app_user_id` was counted, never printed.
- Open for the owner:
  - The steps in §4.
  - The consent decision (A or B).
  - Whether RevenueCat shows why delivery stopped after 2026-06-26.

## 8. Option B as built (PR #263) and the final query

**Events.** Sent only for `environment = PRODUCTION`, and only after the webhook's entitlement RPC has accepted the event:

| RevenueCat type | PostHog event |
|---|---|
| INITIAL_PURCHASE | `rc_initial_purchase` |
| RENEWAL | `rc_renewal` |
| CANCELLATION | `rc_cancellation` |
| EXPIRATION | `rc_expiration` |
| BILLING_ISSUE | `rc_billing_issue` |
| UNCANCELLATION | `rc_uncancellation` |
| PRODUCT_CHANGE | `rc_product_change` |
| NON_RENEWING_PURCHASE | `rc_non_renewing_purchase` |

**Identity and consent.**
- `distinct_id` is the Supabase user id.
- A rider who declined analytics goes to `revenuecat-no-consent` with `$process_person_profile: false`.
- The rule lives in `apps/api/src/modules/analytics/analytics-consent.ts` and is shared with the signup sweep.
- If the account can't be read, the event fails closed to the anonymous bucket.

**Properties.**
- `revenue` (USD) and `currency=USD`, only on INITIAL_PURCHASE, RENEWAL and NON_RENEWING_PURCHASE.
- `price_usd`, `price_in_purchased_currency`, `purchased_currency`.
- `product_id`, `new_product_id`, `store`, `purchase_source` (ios/android/web), `environment`.
- `period_type`, `is_trial`, `is_trial_conversion`, `is_paid_conversion`.
- `cancel_reason`, `expiration_reason`, `renewal_number`, `presented_offering_id`.
- `rc_event_id`, which is also the PostHog `uuid`.
- `emitted_by = revenuecat_webhook`.

**Checks.**
- `pnpm --filter @motovault/api test`: 874/874 pass.
- `tsc` on `tsconfig.build.json` is clean.
- Biome is clean, and the pre-push precheck passed.

**Paid subscribers per source per 4 weeks.** A subscriber is one of:
- an event from PR #263 with `is_paid_conversion = true`: a non-trial initial purchase, a lifetime purchase, or the trial-converting renewal;
- an event from the old integration (no `emitted_by`): a non-trial `rc_initial_purchase` with revenue.

A rider who declined counts once per paid event, under source `consent_declined`. I ran the query against the old data: it executes and returns 1 web subscriber (2026-04-27 bucket, unattributed).

```sql
SELECT addDays(toDate('2026-01-05'), 28 * intDiv(dateDiff('day', toDate('2026-01-05'), toDate(first_paid)), 28)) AS period_start,
       source, self_reported, purchase_source, count() AS paid_subscribers
FROM (
  SELECT if(distinct_id = 'revenuecat-no-consent', concat('nc:', toString(properties.rc_event_id)), toString(person_id)) AS subscriber,
         min(timestamp) AS first_paid,
         argMin(coalesce(toString(properties.purchase_source),
                         multiIf(properties.store = 'APP_STORE', 'ios', properties.store = 'PLAY_STORE', 'android',
                                 properties.store IN ('STRIPE', 'RC_BILLING'), 'web', 'unknown')), timestamp) AS purchase_source,
         any(if(distinct_id = 'revenuecat-no-consent', 'consent_declined',
                coalesce(nullIf(toString(person.properties.ft_utm_source), ''),
                         if(person.properties.install_source IN ('organic_unknown', ''), NULL, toString(person.properties.install_source)),
                         nullIf(toString(person.properties.$initial_utm_source), ''),
                         'unattributed'))) AS source,
         any(if(distinct_id = 'revenuecat-no-consent', 'consent_declined',
                coalesce(toString(person.properties.heard_from), 'not_asked'))) AS self_reported
  FROM events
  WHERE timestamp > now() - INTERVAL 365 DAY
    AND startsWith(event, 'rc_')
    AND (properties.is_paid_conversion = true
         OR (properties.emitted_by IS NULL AND event = 'rc_initial_purchase'
             AND toFloat(properties.revenue) > 0 AND ifNull(toString(properties.period_type), '') != 'TRIAL'))
    AND ifNull(person.properties.$initial_geoip_country_code, '') != 'SK'
    AND NOT ifNull(person.properties.internal, false)
  GROUP BY subscriber)
GROUP BY period_start, source, self_reported, purchase_source
ORDER BY period_start, paid_subscribers DESC
```

**Open for the owner.**
- Review and merge #263.
- Keep the RevenueCat dashboard PostHog integration OFF.
- Confirm `POSTHOG_PROJECT_TOKEN` is set on Render; the signup sweep already uses it.
- After deploy, run the verification query in the PR's test plan.
