# RevenueCat Trial & Billing Audit (2026-09-19)

Triggered by one customer (RC `c08826e2-56cd-4de0-b231-acb87dde3395`, MX, iOS + Android) who took three free trials and paid nothing. Three parallel read-only passes — RevenueCat project + customer data (v2 API), live App Store Connect / Play Console configuration (`asc`, `gplay`), and the codebase — plus a citation-backed research brief on Apple/Google/RevenueCat eligibility rules. Every store/RC fact below was pulled live; nothing was inferred from docs.

---

## Executive summary

1. **Every one of the three trials was legitimately granted by a store.** Apple keeps all 8 of our subscriptions in ONE group (so one Apple ID cannot trial twice) — the July and September iOS receipts have unrelated `original_transaction_id`s, i.e. two different Apple IDs on two iPhones. The Play trial was that Google account's first-ever purchase. **Our layer (app, backend, RC targeting) never had a say**: nothing in the codebase or RC config checks trial history, on any platform.
2. **Apple Billing Grace Period is OFF** (`optIn=false`). The September trial→paid conversion failed billing and RC expired the subscription in the same second. The customer lost access at 14:00, tapped Restore at 14:18 (which surfaced the old July receipt), and started the Android trial at 23:51. Turning grace period on is one toggle and would have kept a paying-intent customer.
3. **Google Play trial offers are scoped `thisSubscription`** and every product generation (v1→v4) is a distinct `productId`, so each generation re-opens a 7-day (or 1-month) trial for the same Google account. iOS is protected from this only by the single subscription group.
4. **Legacy trials are still live**: iOS `*_v2` intro offers are **1 month free** with no end date; Play `offer-trial-1-month`, `offer-monthly-1-month` and the misnamed `free-trial-7day` (actually 1 month) are all ACTIVE. Any offering that ever serves a v1/v2 product hands out a month.
5. **We cannot even detect the pattern**: `users.trial_started_at` exists (migration 00021) but is never written; `revenuecat_webhook_events` stores only `event_id/event_type/app_user_id/processed_at`; account deletion calls `DELETE /v1/subscribers/{id}` and cascades the audit rows.
6. Scale today is small — 32 trial starts since May, 8 conversions, 2 billing failures, **1 user** with >1 `INITIAL_PURCHASE` in our DB (this one). The structural fixes matter more than the incident.

---

## 1. Incident reconstruction

| # | When (UTC) | Store | Product | Offer | Outcome |
|---|---|---|---|---|---|
| 1 | 2026-07-07 20:09 | App Store | `motovault_pro_monthly_v2` | Apple intro: **1 month free** | Cancelled same day, expired 08-07. `original_transaction_id 340002740794229`. Events only **created in RC on 2026-09-15 14:18** and never delivered to our webhook → receipt was attached retroactively (restore / receipt sync on `iPhone12,5`, first seen 09-14). |
| 2 | 2026-09-08 14:00 | App Store | `motovault_pro_annual_v3` | Apple intro: 7 days free | `BILLING_ISSUE` + `CANCELLATION(BILLING_ERROR)` + `EXPIRATION(BILLING_ERROR)` at 09-15 14:00:24, `grace_period_expiration_at_ms: null`. `original_transaction_id 30003506440845`. |
| 3 | 2026-09-15 23:51 | Play Store | `motovault_pro_v3_annual_v3` | Play offer `motovault-pro-v3-annual-v3-free-7-` | TRIAL, `gives_access: true`, converts 09-22 at MX$ (US$49.99) unless cancelled. |

Why the stores allowed it:
- Apple: one intro offer per Apple ID **per subscription group** ([ASC help](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)). Our group `MotoVault Pro` (21974881) contains all 8 products, so #1 and #2 on the same Apple ID is impossible → two Apple IDs. Apple keeps `originalTransactionId` stable within a group for one account; the two IDs here are unrelated.
- Google: offer eligibility `thisSubscription` = "never had THIS productId" ([Play help](https://support.google.com/googleplay/android-developer/answer/12154973)). First Play purchase on that Google account → eligible. Google knows nothing about Apple.
- Us: RC app_user_id was the same Supabase uuid on all three, so **RC had the full picture and we asked it nothing**.

Answer to "should he have got the trial?": by our intended policy (one trial per person), no. By the rules we actually configured, yes — three times. There is no bug in RC or the stores; the missing piece is ours.

What to do about this customer: nothing. The Play trial is store-granted; revoking it would be a support incident. If it converts on 09-22 we get $49.99; RC will send `RENEWAL is_trial_conversion=true`.

## 2. Live configuration (verified)

### App Store Connect (app 6760291360)
- One subscription group **MotoVault Pro** (21974881). Levels 1–8: `annual`, `monthly`, `annual_v2`, `monthly_v2`, `monthly_v3`, `annual_v3`, `monthly_v4`, `annual_v4`. All APPROVED, sellable in 175 territories.
- Intro offers (no end dates): `annual_v2` / `monthly_v2` **FREE_TRIAL 1 MONTH** (since 2026-05-01); `annual_v3` / `annual_v4` FREE_TRIAL 1 WEEK (since 2026-05-28). Monthly v3/v4 and v1: none.
- Promotional offers: only `annual_cancel_40off_1yr` (v1 annual) and `monthly_cancel_40off_2mo` (v1 monthly). **`annual_v2_cancel_40off_1yr`, referenced by `.claude/skills/revenuecat-retention-offers/references/motovault-products.md` as RC retention "Associated offer 6", does not exist.**
- **Billing Grace Period: `{"optIn": false, "sandboxOptIn": false, "duration": null, "renewalType": null}`** — `GET /v1/apps/6760291360/subscriptionGracePeriod`.
- Lifetime IAPs `motovault_lifetime_v3` / `_v4` NON_CONSUMABLE, approved.

### Google Play (`com.motovault.app`)
| Product : base plan | Grace | Trial offer | State | Trial | Eligibility |
|---|---|---|---|---|---|
| `motovault_pro_annual : annual-autorenew` | 14d | `free-trial-7day` | ACTIVE | **1 month** (misnamed) | thisSubscription |
| `motovault_pro_monthly : monthly-autorenew` | 7d | `free-trial-3day` | INACTIVE | 3 days | thisSubscription |
| `motovault_pro_annual_v2 : annual-v2` | 14d | `offer-trial-1-month` | ACTIVE | 1 month | thisSubscription |
| `motovault_pro_monthly_v2 : monthly-v2` | 7d | `offer-monthly-1-month` | ACTIVE | 1 month | thisSubscription |
| `motovault_pro_v3_annual_v3 : motovault-pro-v3-annual-v3` | 14d | `motovault-pro-v3-annual-v3-free-7-` | ACTIVE | 7 days | thisSubscription |
| `motovault_pro_v4_annual_v4 : motovault-pro-v4-annual` | 14d | `motovault-pro-v4-annual-7-day-free` | ACTIVE | 7 days | thisSubscription |
| monthly v3 / v4 | 7d | — | | | |

No offer tags, no `anySubscriptionInApp` scope anywhere. Grace period is on (Play default). Account hold: mandatory since 2020, not visible via API.

### RevenueCat (proj46e69448)
- Current offering `paywall_v4`; running experiment `compare v3 and v4` (exp2b222d0895), **`enrollment_mode: new_and_existing`**, 100 %, both variants carry a trial on the annual package.
- **Targeting rules: none.** Audiences exist (Active / Expired / Non-subscription / Sandbox) but nothing consumes them.
- 13 offerings; `default`, `new_offering_4_29_24_4`, `new_offering_4_29_24_4_v2` are still `active` and still reference v1/v2 products (1-month trials).
- Single webhook → `https://motowise.onrender.com/webhooks/revenuecat`, all event types, both environments.
- Paywalls v2 attached to v3/v4; trial copy is shown/hidden by the paywall's intro-eligibility rules, which on iOS reflect Apple's per-group answer and on Android reflect what Google returns in `subscriptionOptions`.

### Codebase
- Mobile (`apps/mobile/src/lib/subscription.ts`): `Purchases.logIn(supabaseUuid)` on every session (`_layout.tsx:484`); `presentPaywall` (533-642) uses `offerings.current` or a placement; `presentPaywallIfNeeded` checks only the *active* entitlement. **No** `checkTrialOrIntroductoryPriceEligibility`, no read of `entitlements.all` / `allPurchasedProductIdentifiers`. Pro status = RC `entitlements.active` only. Pre-auth `restorePurchases()` on `(onboarding)/sign-in.tsx:58-71` while RC is anonymous. Dead custom paywall `(profile)/upgrade.tsx` hardcodes "7-day free trial".
- API webhook (`apps/api/src/modules/webhooks/*`, RPC in `supabase/migrations/00165_revenuecat_lifetime_entitlement.sql:16-89`): handles INITIAL_PURCHASE / RENEWAL / NON_RENEWING_PURCHASE / CANCELLATION / UNCANCELLATION / EXPIRATION / BILLING_ISSUE; **TRANSFER, PRODUCT_CHANGE, PAUSED, EXTENDED ignored**; passes only id/type/user/expiry/period_type to the RPC (drops product_id, store, environment, `grace_period_expiration_at_ms`, `aliases`, `transferred_from/to`); non-UUID (anonymous) app_user_ids skipped; sandbox processed as production. `BILLING_ISSUE → past_due`, and `gql-auth.guard.ts:174-211` treats `past_due` as free immediately. `trial_started_at` never written. `users.service.ts:275` deletes the RC subscriber on account deletion.
- Web (`apps/web/src/app/pro/checkout/page.tsx`): advertises "7-day free trial" unconditionally with stale $5.99/$49.99 copy; no Pro/trial-history check before checkout.
- Prod DB (read-only, 2026-09-19): `revenuecat_webhook_events` = 20 INITIAL_PURCHASE, 39 RENEWAL, 38 CANCELLATION, 29 EXPIRATION, **6 BILLING_ISSUE across 5 users**, 1 PRODUCT_CHANGE. Only this customer has >1 INITIAL_PURCHASE.

### RC metrics (May–Sep 2026)
32 trial starts → 8 conversions (25 %), 18 cancelled within 7 days, 2 billing failures, 1 elapsed. **August: 8 starts, 7 cancellations, 0 conversions. September so far: 3 / 0.** Trial leakage is not the dominant loss — cancel-within-7-days is — but it is the one that is free to close.

---

## 3. Plan

### Phase 0 — dashboard changes, no code, do today
| # | Where | Change | Why |
|---|---|---|---|
| 0.1 | ASC → App → Subscriptions → Billing Grace Period | **Enable, 16 days, "All Renewals"** | Trial→paid is a renewal ([Apple engineer](https://developer.apple.com/forums/thread/759883)); without this every card hiccup at conversion is an instant expiration. RC then sends `BILLING_ISSUE` with a non-null `grace_period_expiration_at_ms` and keeps the entitlement alive. |
| 0.2 | Play Console → each ACTIVE trial offer on `v3_annual_v3` and `v4_annual_v4` | Eligibility → **"never had any subscription in this app"** (`anySubscriptionInApp`). If Play refuses to edit an activated offer, deactivate it and create a replacement with the new scope — RC references the base plan, not the offer, so no RC change is needed; RC auto-selects the free-trial option. | Closes per-generation re-trials on Android. |
| 0.3 | Play Console | **Deactivate** `free-trial-7day` (v1 annual, really 1 month), `offer-trial-1-month` (annual_v2), `offer-monthly-1-month` (monthly_v2). | Month-long trials on products no current offering should serve. |
| 0.4 | ASC → `annual_v2`, `monthly_v2` intro offers | Set an **end date** (today). | Same reason; Apple's group rule already blocks repeat trials but a new user routed to a stale offering would still get a month. |
| 0.5 | RC → Offerings | Archive `default`, `new_offering_4_29_24_4`, `new_offering_4_29_24_4_v2` (still `active`, still v1/v2 products). Keep `paywall_v3`/`paywall_v4` only. | Removes the last route to v1/v2 products. Check nothing references them first (`presentPaywall` never asks for a named offering — confirmed). |
| 0.6 | RC → retention offers | Fix or remove the `annual_v2_cancel_40off_1yr` slot (offer does not exist in ASC). | Dead retention path. |
| 0.7 | Play Console → Monetisation setup | Confirm RTDN topic is set (CLI could not read it). ASC → App Information → confirm Server Notifications V2 URL is RC's. | Without these, RC learns about billing events late. |

### Phase 1 — record trial history and honour grace periods (backend, ~1 PR)
1. **Widen the webhook audit table** (`revenuecat_webhook_events`): add `period_type`, `product_id`, `store`, `environment`, `is_trial_conversion`, `expiration_at`, `grace_period_expiration_at`, `payload jsonb`; drop the `ON DELETE CASCADE` to `users` (keep history for deleted accounts; nullable FK or plain uuid). Pass these through `revenuecat.service.ts:30-38` → RPC.
2. **Persist trial history on `users`**: in the RPC, on `INITIAL_PURCHASE` with `period_type='TRIAL'` set `trial_started_at = COALESCE(trial_started_at, now())` and increment a new `trial_count`. Expose `hasUsedTrial` on `me` (`user.model.ts`, `users.service.ts`).
3. **Grace period semantics**: on `BILLING_ISSUE`, store `grace_period_expiration_at_ms` into `subscription_expires_at` and let `resolveEffectiveTier` (`gql-auth.guard.ts:174-211`) treat `past_due` as Pro until that date. This matches what the RC SDK will tell the client once 0.1 is on.
4. **Handle `TRANSFER`**: downgrade `transferred_from` users, upgrade `transferred_to`. Handle `PRODUCT_CHANGE` (update product). Skip `environment='SANDBOX'` in production.
5. **Stop erasing history on account deletion**: replace `DELETE /v1/subscribers/{id}` with attribute deletion / anonymisation, or persist a hashed record of `original_app_user_id` + store transaction ids before deleting. (GDPR: purchase records are a legitimate-interest retention; RC's own delete is what we call today.)
6. **Set an RC customer attribute from the backend**: on the first TRIAL event, `POST /v1/subscribers/{id}/attributes {"has_had_trial": "true"}` (server-side, secret key). This is the hook Phase 2 targeting needs and it works even when the store account differs.

### Phase 2 — serve a no-trial offering to anyone who already trialed (RC + mobile)
The only mechanism RC Targeting supports is custom attributes / country / app version / platform ([docs](https://www.revenuecat.com/docs/tools/targeting)) — no built-in "has had trial". So:
1. **iOS needs products without an intro offer**: Apple applies an intro offer automatically whenever the Apple ID is eligible; the app cannot suppress it on `annual_v4`. Create `motovault_pro_annual_v4_nt` (same price, no intro offer) **in the same group**, plus reuse `monthly_v4` (already no intro). Android: reuse the existing base plans — RC will offer the base plan when Google says ineligible, and after 0.2 Google says ineligible for any prior subscriber.
2. Create offering `paywall_v4_no_trial` (same paywall design, "Start free trial" copy replaced via intro-eligibility rules, annual package → `_nt` product on iOS).
3. RC Targeting rule: `has_had_trial = "true"` → `paywall_v4_no_trial`, priority above the experiment. Also set the attribute client-side as a fallback in `presentPaywall` (`subscription.ts:551`): if `customerInfo.allPurchasedProductIdentifiers` contains any Pro product, `setAttributes({has_had_trial:'true'})` before fetching offerings.
4. Web checkout (`pro/checkout/page.tsx`): gate trial copy on `me.hasUsedTrial` and on the offering actually carrying an intro period; fix the stale $5.99/$49.99 copy while there.
5. Delete the dead `(profile)/upgrade.tsx` paywall (hardcoded trial copy, unreachable).

### Phase 3 — hygiene / observability
- Move `restorePurchases()` behind sign-in (currently pre-auth on `sign-in.tsx:58-71` while RC is anonymous → receipts can hop between Supabase accounts; combine with RC "transfer" restore behaviour and an ignored `TRANSFER` event).
- Switch the running experiment to `only_new` when it is next restarted; `new_and_existing` re-exposes lapsed trialers to trial paywalls (harmless on iOS after this plan, but noisy for the metric).
- PostHog/RC dashboard tile: trial starts per customer > 1 (RC Audiences can filter on trial start dates; our widened audit table can answer it in SQL).
- Update `.claude/skills/revenuecat-retention-offers/references/motovault-products.md` (wrong v1 IDs, non-existent promo, no v3/v4, stale prices) — or delete it and point at `asc`/`gplay` as the source of truth.

### Explicitly out of scope
- Blocking a customer who uses two Apple IDs or an Apple ID + Google account **at the store level** — impossible; Phase 2 covers it at the paywall as long as they log into the same MotoVault account.
- Revoking this customer's active Play trial.


## Status (2026-09-19, same day)

**Phase 0 — done via CLI/MCP, verified live**
- ASC Billing Grace Period: `optIn=true, SIXTEEN_DAYS, ALL_RENEWALS` (sandbox too).
- Play trial offers on `v3_annual_v3` and `v4_annual_v4`: targeting `anySubscriptionInApp` (updated in place, still ACTIVE).
- Play legacy trials `free-trial-7day`, `offer-trial-1-month`, `offer-monthly-1-month`: INACTIVE.
- ASC `annual_v2` / `monthly_v2` 1-month intro offers: end date 2026-09-20 on all 175 territories (Apple rejects same-day).
- RC offerings `default`, `new_offering_4_29_24_4`, `new_offering_4_29_24_4_v2`: archived (the last needed its paywall `pwe6c48357bb7646ec` unpublished first).
- 0.6 retention offers: **open** — Customer Center "Cancellation Retention Discount" maps only v1/v2 products (one to a non-existent Apple promo), so v3/v4 subscribers get no retention offer at all. Needs promo offers on v3/v4 in both stores + dashboard mapping.
- 0.7: App Store Server Notifications proven live (BILLING_ISSUE arrived 10 s after Apple's timestamp); Play RTDN not readable by CLI.

**Phase 1 — migration 00177 applied to prod; code on `fix/revenuecat-trial-history`**
- `users.trial_started_at` backfilled for 29 users from RC per-customer event history (only this customer had >1 trial); `has_had_trial=true` set on those 29 RC customers via v1 API.
- Deviation from the plan: sandbox events are still processed (the RC SDK grants sandbox entitlements on the client, so skipping them server-side would make the API disagree with the app); the environment is now persisted instead. The RC subscriber is still deleted on account deletion (GDPR); local purchase history survives because the FK cascade is gone.
- Side-finding: prod `public.users` has table-wide ALL grants for `anon`/`authenticated` and none of 00141's column ACLs or policies, although 00141 is recorded as applied. Not exploitable for Pro (`subscription_tier`/`expires_at`/`trial_started_at`/`role`/`email` are frozen by both live UPDATE policies) but CLAUDE.md's description of `users` protection is wrong for prod and `subscription_status` + `revenuecat_id` are user-writable. Needs its own ticket.

**Phase 2 — products + offering + paywall done; targeting rule needs the dashboard**
- iOS `motovault_pro_annual_v4_nt` (ASC 6813886154): $79.99 equalized, 175 territories, 39 localizations, no intro offer, same group, **WAITING_FOR_REVIEW**. RC product `prod4b81196665`.
- Play `motovault_pro_v4_annual_nt` / base plan `motovault-pro-v4-annual-nt`: ACTIVE, $59.99, 173 regions, no offers. RC product `prod86184f8c02`.
- Both attached to entitlement `MotoWise Pro`. Offering `paywall_v4_no_trial` (`ofrng630d66512e`) = v4 packages with the annual swapped to the `_nt` products; paywall `pwce8049bfefde4d2a` **published** (trial pill removed, annual CTA "Continue").
- **Targeting rule — create in dashboard** (MCP key lacks `targeting_rules:read_write`): condition custom attribute `has_had_trial` in [`true`] → offering `paywall_v4_no_trial`, active, above the experiment.
- Found while duplicating: the live v3 and v4 paywalls promise a trial unconditionally in two places (annual-selected CTA override "Start 7 day free trial", ungated "1 week FREE TRIAL" pill). Drafts that gate both on `intro_offer` are saved on `pwc2b2f4aed92443c0` (v3) and `pwa365e62b6bb44922` (v4) — **review and publish**.
- Mobile fallback (`hasUsedTrial` + `syncAttributesAndOfferingsIfNeeded`) and web checkout gating are in the same branch. Mobile change reaches users with the next OTA/build.

### Follow-ups (2026-09-19, evening — second PR)

- **Targeting rule live**: `b8bf6277e0` "Returning trialers → no-trial offering", active, `has_had_trial in [true]` → `paywall_v4_no_trial`. Verified via `list-targeting-rules`.
- **iOS `motovault_pro_annual_v4_nt`**: still `WAITING_FOR_REVIEW`. Until Apple approves, the no-trial offering's annual package is absent on iOS; monthly still renders.
- **Mobile fallback not yet shipped**: the last production OTA (2 weeks ago, runtime 3.19.1) predates #234; `main` has exactly one mobile commit since (#234). 3.19.1 is `READY_FOR_DISTRIBUTION`, so an OTA reaches every current install. Publish with the #233 recipe (`npx eas update --branch production --environment production`, then verify the bundle contains `https://motowise.onrender.com/graphql`) — **never** the old `.env.production` command.
- **CI "Security Audit" red on `main`**: both critical advisories were `next` 16.1.6 (RCE via Image Optimization AVIF / Windows hosts, fixed ≥16.3.3). Bumped `next` + `@next/third-parties` to `^16.3.5`; `pnpm audit --audit-level=critical` is clean.
- **Side-finding escalated — none of 00141 is live in prod** (not just the users grants): `share_links` is still anon-readable, and `mark_article_read` / `join_group_ride` are `SECURITY DEFINER` with **no `auth.uid()` check** and `EXECUTE` granted to `PUBLIC`/`anon` — any anon-key holder can mark articles read or join group rides as any user. Migration **00178** re-applies 00141 idempotently; dry-run against prod inside a rolled-back transaction passed every check (12 SELECT / 13 UPDATE column grants, no table grants, own-row email denied, other public profile visible, tier update denied, RPC as another user → `Unauthorized`, anon RPC → `permission denied`, anon `share_links` denied). Code prerequisite: `BlogService.assertAdmin` read `users.role` via the user client — switched to the admin client in the same PR. **Deploy the API before applying 00178.** `apps/web/src/proxy.ts` has a DB `role` fallback via the session client; under 00178 it fails closed (redirect) for an admin whose JWT lacks `app_metadata.role`, which is the safe direction.
### Executed later the same evening (after #235 merged)

- **00178 applied to prod** (Render deploy `03abfb58` live first). Verification: 5 users policies exactly as expected, no table grants for anon/authenticated, column grants 12 SELECT (anon + authenticated) / 13 UPDATE, both RPCs carry the `auth.uid()` check with EXECUTE only for `authenticated`/`service_role`, `share_links` anon policy gone. Live smoke test as `test@test.com`: `me` and `myMotorcycles` OK; PostgREST `select=email` → `42501`; public profile columns readable; anon `rpc/mark_article_read` → `permission denied for function`. Recorded as `00178` in `schema_migrations`.
- **OTA published**: update group `9bb29159-d8bf-4e93-b2ab-ac0e76bd80d6`, runtime 3.19.1, both platforms, commit `03abfb58`, via `--environment production`; both bundles verified to contain `https://motowise.onrender.com/graphql`. Every current install now gets the `has_had_trial` client fallback.
- **Play retention offers created + ACTIVE** (developer-determined, `targeting: {}`, 40% `relativeDiscount` on all 173 regions + other-regions, tag `retention`): `monthly-v3-cancel-40off-2mo` (P1M ×2), `monthly-v4-cancel-40off-2mo`, `annual-v3-cancel-40off-1yr` (P1Y ×1), `annual-v4-cancel-40off-1yr`. Found on the way: the v1 Play `annual-cancel-40off-1yr` the Customer Center maps is **DRAFT** (never activated) and `monthly-cancel-40off-2mo` on v2 is **INACTIVE** and was a free month, not 40% — Play retention never worked.

- **Apple retention offers created** (all `PAY_AS_YOU_GO`, 175 territory prices each, every territory at the price point nearest 60% of that territory's *current* price for that product — v4 is priced higher than v3 in every territory, so each product got its own list):
  | product | offer code | shape |
  | --- | --- | --- |
  | `motovault_pro_annual_v3` | `annual_v3_cancel_40off_1yr` | ONE_YEAR × 1 |
  | `motovault_pro_annual_v4` | `annual_v4_cancel_40off_1yr` | ONE_YEAR × 1 |
  | `motovault_pro_monthly_v3` | `monthly_v3_cancel_40off_2mo` | ONE_MONTH × 2 |
  | `motovault_pro_monthly_v4` | `monthly_v4_cancel_40off_2mo` | ONE_MONTH × 2 |
  Method: `asc subscriptions pricing prices list --resolved` for the current price per territory, `pricing price-points list --territory X` per territory (the tier ladder is global — the `p` in the price-point id is the same tier for every subscription, only `s` differs, verified by `price-points view`), nearest-to-60% pick, then `offers promotional create --prices "TERRITORY:PRICE_POINT_ID,…"`. Needs asc ≥ 5.x for the `TERRITORY:PRICE_POINT_ID` form (2.8.2 silently dropped the price point → "Missing a required include subscriptionPricePoint"). The upgraded binary hits a macOS keychain prompt; env-var auth (`ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_PRIVATE_KEY_PATH=~/.asc/keys/AuthKey_B7J3LS6SPC.p8`) bypasses it.

- **Phase 2.5 + Phase 3 hygiene (2026-09-20)**: deleted the unreachable `(profile)/upgrade.tsx` paywall (hardcoded 7-day/3-day trial copy, nothing routed to it) with its Stack registration, `ROUTES.UPGRADE` and 15 orphaned `paywall.*` keys in all 13 locales; removed the pre-auth "Restore purchases" button from the onboarding sign-in screen (it ran `Purchases.restorePurchases()` while RC was still anonymous, which is exactly the receipt-hopping path this audit reconstructed) together with `restorePurchases()` in `subscription.ts` — the RC paywall and Customer Center "missing purchase" path both restore post-auth. `.claude/skills/revenuecat-retention-offers/references/motovault-products.md` rewritten from live store data. Experiment `compare v3 and v4` left `new_and_existing` (change to `only_new` on its next restart, per plan); the targeting rule now sits above it for anyone with `has_had_trial`, so lapsed trialers no longer see trial copy regardless. Mobile changes ride the next OTA; not published separately.

- **Retention offers (0.6) — DONE 2026-09-20.** Customer Center "Cancellation Retention Discount" now maps 11 products: the 3 legacy slots that still resolve (App Store v1 monthly/annual, Play monthly_v2) plus the 8 new v3/v4 rows below. Entered through a Playwright-driven browser session on the dashboard (no API exists); the form's promo autocomplete only lists offers that actually exist on the chosen product, which is what exposed the three dead legacy slots — App Store `annual_v2` (promo never existed), Play `annual_v2:annual-v2` (promo lives on a different product) and Play `annual:annual-autorenew` (promo still DRAFT) — all three removed. Legacy Play annual v1 subscribers therefore have no retention offer, exactly as before; to give them one, activate the DRAFT `annual-cancel-40off-1yr` in Play Console and re-add that slot. Save response: "You have successfully updated your Customer Center configuration."

- **Retention offers (0.6) — the eight rows entered**: RevenueCat → Customer Center → Promotional offers → "Cancellation Retention Discount" → add cross-product promotions (origin = target for each):
  | app | origin/target product | store offer identifier |
  | --- | --- | --- |
  | App Store | `motovault_pro_annual_v3` | `annual_v3_cancel_40off_1yr` |
  | App Store | `motovault_pro_annual_v4` | `annual_v4_cancel_40off_1yr` |
  | App Store | `motovault_pro_monthly_v3` | `monthly_v3_cancel_40off_2mo` |
  | App Store | `motovault_pro_monthly_v4` | `monthly_v4_cancel_40off_2mo` |
  | Play | `motovault_pro_v3_annual_v3:motovault-pro-v3-annual-v3` | `annual-v3-cancel-40off-1yr` |
  | Play | `motovault_pro_v4_annual_v4:motovault-pro-v4-annual` | `annual-v4-cancel-40off-1yr` |
  | Play | `motovault_pro_v3_monthly_v3:monthly-v3` | `monthly-v3-cancel-40off-2mo` |
  | Play | `motovault_pro_v4_monthly_v4:motovault-pro-monthly-v4` | `monthly-v4-cancel-40off-2mo` |
  While there, delete the dead `annual_v2_cancel_40off_1yr` (App Store, does not exist) and note the v1 Play `annual-cancel-40off-1yr` is DRAFT. The Customer Center config has no public API (the MCP is read-only for it), so this cannot be scripted.

### Legacy Play annual closed out (2026-09-20, evening)

- **Play `annual-cancel-40off-1yr` (v1 base plan `motovault_pro_annual:annual-autorenew`) is ACTIVE.** It was a DRAFT whose single phase said `P1Y × 2` — two years at 40% off, despite the `1yr` name. Corrected to `P1Y × 1` while still a draft, then activated. Also tagged `retention` so all five Play retention offers match; `offers update` rejects a tag-only patch with `Regions Version must be specified` — pass `--regions-version 2022/02` (the offer's own GET does not return the field).
- **Customer Center now maps 12 products**: the 11 from earlier plus `app6f29b09758 / motovault_pro_annual:annual-autorenew → annual-cancel-40off-1yr`. Verified through `get-customer-center-config` (`cross_product_promotions[12]`), not just the dashboard's "12 products" label. Legacy Play annual subscribers now get the same 40%-off retention offer as everyone else; **every live subscription product on both stores is covered**.
- Method note: the earlier Playwright script removes any slot whose promo field reads empty, which is a data-loss risk on a re-run if the promo values have not finished loading. The single-row variant used here does no removals, prints the full block list before and after, and supports `DRY_RUN=1` — run the dry pass first and read the summary.

## Verification sweep (2026-09-20)

Every change this audit recorded as executed was re-checked against the live systems. All pass.

| Claim | Check | Result |
| --- | --- | --- |
| Apple billing grace period ON | `GET /v1/apps/6760291360/subscriptionGracePeriod` | `optIn=true`, `sandboxOptIn=true`, `SIXTEEN_DAYS`, `ALL_RENEWALS` |
| One Apple subscription group | `asc subscriptions list --group-id 21974881` | 9 products, all in `MotoVault Pro`; `motovault_pro_annual_v4_nt` still `WAITING_FOR_REVIEW`, the rest `APPROVED` |
| Legacy Apple intro offers ended | `offers introductory list` on `annual_v2`, `monthly_v2` | 0 rows on both |
| Apple retention offers | `offers promotional list` on the four v3/v4 subs | `annual_v3/v4_cancel_40off_1yr` = `ONE_YEAR × 1`, `monthly_v3/v4_cancel_40off_2mo` = `ONE_MONTH × 2`, all `PAY_AS_YOU_GO` |
| Play base plans | `gplay subscriptions list` | all 9 `ACTIVE`, including `motovault_pro_v4_annual_nt/motovault-pro-v4-annual-nt`, which carries no offers |
| Play trials rescoped | `gplay offers list` on the v3/v4 annual plans | 7-day free, `acquisitionRule.scope = anySubscriptionInApp`, `ACTIVE` |
| Legacy Play trials off | same, on the v1/v2 plans | `free-trial-7day`, `free-trial-3day`, `offer-trial-1-month`, `offer-monthly-1-month` all `INACTIVE` |
| Play retention offers | same, all five plans | five `ACTIVE`, tag `retention`, `P1Y × 1` / `P1M × 2` at 40%; the dead v2 `monthly-cancel-40off-2mo` still `INACTIVE` |
| Stale RC offerings archived | `list-offerings` | `default`, `new_offering_4_29_24_4`, `new_offering_4_29_24_4_v2` all `inactive`; `paywall_v4` is current |
| No-trial offering wired | `get-offering ofrng630d66512e` expanded | annual package = `motovault_pro_annual_v4_nt` (iOS) + `motovault_pro_v4_annual_nt:…` (Play); monthly/lifetime unchanged |
| `_nt` products entitled | `get-products-from-entitlement entlcbbd43776c` | both `_nt` products attached to `MotoVault Pro` |
| Paywalls published | `get-paywall` ×3 | v3 rev 216, v4 rev 41, no-trial rev 3 — all `published_at` 2026-09-19 |
| Trial copy gated | `get-paywall … expand=components` on v3 and v4 | the "1 week FREE TRIAL" pill stack is `visible: false` with a single override `intro_offer_condition = true → visible: true`; the CTA text overrides to "Start 7-day free trial" only under an `intro_offer` condition. Identical in both paywalls |
| Targeting rule live | `list-targeting-rules` | `b8bf6277e0` active, `has_had_trial in ["true"]` → `ofrng630d66512e`, the only rule |
| `has_had_trial` stamped | `get-customer … expand=attributes` on a backfilled user | `has_had_trial = "true"`, written 2026-09-19T14:13Z |
| Migrations live | prod `schema_migrations` | `00177` and `00178` both present |
| Trial backfill | prod `public.users` | 29 of 728 rows carry `trial_started_at` |
| 00178 effects | prod catalogs | no table-wide grants for `anon`/`authenticated` on `users`; 12 SELECT columns (both roles) / 13 UPDATE columns (`authenticated`); `share_links` has only the owner policy; `mark_article_read`, `join_group_ride`, `soft_delete_expense` all carry an `auth.uid()` check with EXECUTE limited to `authenticated`/`service_role` |
| OTA shipped | `eas update:list --branch production` | `9bb29159…` is the newest, runtime 3.19.1, android + ios |
| Phase 3 hygiene | repo | `(profile)/upgrade.tsx` gone, no `ROUTES.UPGRADE` / `restorePurchases` references, `paywall.*` locale keys gone, `next` at `^16.3.5` |
| Trial history wired end to end | repo | `users.service.ts` maps `trial_started_at → hasUsedTrial`, `GetTrialEligibility` is generated, `apps/web/src/app/pro/checkout/page.tsx` gates trial copy on it, mobile `subscription.ts` stamps the attribute |
| Customer Center coverage | `get-customer-center-config` | `cross_product_promotions[12]` |
| CI | `gh run list --branch main` | last three runs green |

Two caveats worth carrying forward, neither a defect:

- RC's cached product metadata still advertises `trial_duration: P1M` for `motovault_pro_annual_v2` and `motovault_pro_monthly_v2` although both intro offers have ended in App Store Connect. The store is authoritative — no offer exists — but do not read trial eligibility off RC product metadata.
- The experiment `compare v3 and v4` is still `new_and_existing`, as planned: RevenueCat only lets enrollment mode change on a restart, and the targeting rule already sits above it, so anyone with `has_had_trial` skips trial copy regardless.

Open, unchanged: Apple's review of `motovault_pro_annual_v4_nt`.

---

## Re-run commands
```
asc subscriptions groups list --app 6760291360 --paginate
asc subscriptions list --group-id 21974881 --paginate
asc subscriptions offers introductory list --subscription-id <id> --paginate
asc subscriptions grace-periods view --id 6760291360 --output table   # optIn only; use GET /v1/apps/6760291360/subscriptionGracePeriod for duration/renewalType
gplay subscriptions list --package com.motovault.app --paginate
gplay offers list --package com.motovault.app --product-id <p> --base-plan-id <bp> --paginate
```
RC: `list-customer-events` / `list-subscriptions` for the customer; `list-targeting-rules`, `list-experiments`, `list-offerings` (expand packages) for config; charts `trials_new`, `trial_conversion_rate`, `trial_cancellation`.

Prod SQL (read-only, Management API):
```sql
select e.app_user_id, count(*) from public.revenuecat_webhook_events e
where e.event_type = 'INITIAL_PURCHASE' group by 1 having count(*) > 1;
```
