# Growth Baseline — 2026-06-29

Frozen snapshot of the funnel at the start of the MOT-269 activation→retention work, with the **exact reproducible queries** so the re-measure on **2026-07-29** is apples-to-apples. Source: `docs/Growth-Strategy-2026-06-29.md`.

> **Read before comparing:** PostHog is disabled under `__DEV__`, so the new MOT-272 events (`referral_source_skipped`, `notification_permission_requested/result`, `reminder_scheduled/opened`, `expense_quick_add_tapped`) only accumulate on **release/TestFlight/production** builds. Aggregates for them are **pending production exposures** — don't read them as zero before a prod build ships. Every insight must use `filterTestAccounts: true` and exclude `test@test.com` + Slovakia/internal traffic; scope to Europe + Americas.

## Funnel baseline

| Stage | Baseline (2026-06-29) | Source of truth |
|---|---|---|
| New signups / 30d | ~112 | Supabase |
| Total accounts (all-time) | 400 | Supabase |
| Onboarding completed | ~37% (PostHog) / ~50% (Supabase) | both |
| Added a bike (activation) | 161 / 400 (40%) | Supabase |
| Took a 2nd core action | 56 / 161 bike-owners (~35%) | Supabase |
| Expense: dashboard viewed → logged | 29 viewed / 15 logged | PostHog |
| W4 retention | ≈ 0% | PostHog |
| WAU trend | 166 → 54 over 5 weeks (declining) | PostHog |
| Trials started / 90d | 14 | RevenueCat |
| Trial → paid | ~36% | RevenueCat |
| Active paid subs / MRR | 6 / ~$29 | RevenueCat |

## Reproducible queries (run these again on 2026-07-29)

**Supabase** (project `tpsoneenbrmdwvzcbifw`, read-only; exclude `test@test.com`):
- New signups/30d: `select count(*) from users where created_at > now() - interval '30 days' and email <> 'test@test.com';`
- Bike-add rate: `select count(distinct user_id) from motorcycles;` over `select count(*) from users;`
- 2nd-action rate: of users with ≥1 bike, the share with ≥1 row in `expenses` OR `rides` OR user-authored `maintenance_tasks`.
- Expense depth: `select count(*) , count(distinct user_id) from expenses;`

**PostHog** (project `155556`, `filterTestAccounts: true`, last 90d, EU+Americas):
- Activation funnel (`query-funnel`): `onboarding_started → onboarding_completed → bike_added → expense_added`.
- Expense view→log gap (`query-trends`, unique users): `expense_dashboard_viewed` vs `expense_added` — and post-release, add `expense_quick_add_tapped`.
- Retention (`query-retention`): weekly, `onboarding_started` → `expense_added`/`ride_ended`, W1/W4.
- WAU (`query-trends`, weekly active uniques).
- **Referral read (MOT-272, U5)** — `query-trends` on `referral_source_selected`, breakdown by the event's `referral_source` property, weekly; cross-tab against `bike_added` to find which channel sends *activated* users. Post-release add `referral_source_skipped` (skip rate; if >40%, move the heard-about screen earlier) and `notification_permission_result` broken down by `permission_granted` (the **grant rate** — gates MOT-275/278/279).

**RevenueCat** (project `proj46e69448`): overview metrics (active subs, trials, MRR); `get-experiment prexpe16813d4b3` for trial→paid by arm.

## U5 — referral read status
The referral capture (`referral_source_selected`) already ships; the new skip + permission events were added in this branch. Because PostHog is dev-disabled, the **live aggregate read is deferred to the first production build** and is fully specified by the query above. Action on 2026-07-29: run it, record referral-source coverage %, the skip rate, the leading activated-channel, and the notification grant rate. Wire one PostHog dashboard tile per new event so the schema-vs-reality ratchet holds.

## U6 — RevenueCat apply-checklist (HUMAN-APPLIED — do NOT automate)

Verified live via the RC API on 2026-06-29. **The price experiment stays running per product decision.**

**Running experiment `prexpe16813d4b3` (`default-v3-v4`, price_point, 100% enrollment, new_and_existing) — its 3 arms are OFF-LIMITS:**
- `ofrng70234c7c27` — new_offering_4_29_24_4_v2 (arm A)
- `ofrng8060af0829` — Paywall v3 (arm B, **`is_current`**)
- `ofrng62a61270de` — Paywall v4 (arm C)

**1. Trial-copy check (RC paywall editor):** confirm the paywall template(s) for v3/v4/arm-A don't promise a free trial the store won't grant. Prefer RC's intro-offer-aware variable so "free trial" only shows when the package has an intro offer. (The redundant in-app `paywall-modal.tsx` that hardcoded "Start 7-day free trial" was already deleted in this branch.)

**2. Offering sprawl — 13 offerings. Safe to archive (not an arm, not current, not web; clearly stale):**
- `ofrng04f6ff7cb3` Dark Premium Paywall v1
- `ofrng1ad566e4d7` New Generated Offering
- `ofrng5a37d18aed` Experiment 7 – Pain-Point Copy (already inactive)
- `ofrng9f83fcf2ff` Lower Price Test
- `ofrnga92e4dd249` V2 claude design
- `ofrngcaee8ff698` new_offering_4_29_24_4
- `ofrngef449fd059` Premium Paywall v2

**Review carefully — do NOT blind-archive:**
- `ofrngaa7030f8a4` (lookup_key `default`) — RC's conventional fallback offering; confirm nothing resolves it before archiving.
- `ofrngac924d171a` (MotoVault Pro Web) + `ofrngaec645f45e` (default-web-test) — the **web** app may reference these; verify against `apps/web` first.

Before archiving any, `rg -n "ofrng|lookup_key|getOfferings|presentPaywall" apps/mobile/src apps/web/src` to confirm no hardcoded reference. When in doubt, leave it.

## Re-check on 2026-07-29

Compare each baseline metric. **Success signals** that the activation work is moving the constraint:
- W1 retention off the floor (>0%, ideally climbing).
- 2nd-action rate among bike-owners > 35% (baseline) → target 45%+.
- Expense view→log ratio narrowing (baseline 15/29 ≈ 52%).
- Referral-source coverage ≥70%; notification grant rate known.
- Trials/90d and trial→paid stable-or-up (monetization is downstream of activation).
