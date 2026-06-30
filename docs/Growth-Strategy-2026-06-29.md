# MotoVault Growth Strategy — Decision-Ready Roadmap
**Date:** 2026-06-29 · **Author:** Growth Lead (adversarial review pass) · Stage: ~$29 MRR, ~6 paid subs, 100% organic, solo dev

> Produced by an orchestrated 12-agent team: 6 parallel data analysts (PostHog, RevenueCat, Supabase, Search Console, Acquisition/Meta+social, ASO) → synthesis lead → 4 strategist lenses (acquisition / activation / monetization / retention) → adversarial prioritizer. Many findings were verified against live config and source code, not just metrics. The Search Console agent failed to return structured data this run (GSC tooling did not conform) — SEO is the one lightly-evidenced source.

**TL;DR:** The constraint is NOT awareness — it's a leaky bucket. The organic faucet reliably delivers ~112 signups/30d, but 65% of bike-owners (105/161) never take a second action and ~80% are one-and-done. Fix the empty-garage cliff first; everything else (more reach, pricing A/Bs) is premature or downstream. The first four moves are cheap, code-verified, and ship in days: **stop the inert live price experiment, re-gate the review prompt, read the referral data you're already collecting, and close the expense view→log gap.**

---

## Where we are — the funnel (real numbers)

| Stage | Best-trust number | Conversion | Read |
|---|---|---|---|
| Organic social reach | ~150 median reach/post, one 10.5k viral peak (Meta-only log, **11 wks stale**, TikTok unmeasured) | unknown | Directional only — can't compute reach→install |
| App Store page → install | unknown (no App Store Connect access; UTMs stripped) | unknown | **Biggest dark stage.** 2.0★/1-review US rating is a visible drag |
| Signed up / installed | **Supabase 400 all-time, 112/30d, 10/7d** (trust this for accounts; RC 945/90d is device-first-seen, overstates) | baseline | Strength. Late-May peak ~55-61/wk, softening, sharp current-week dip |
| Onboarding completed | PostHog 113/302 (37%) · Supabase 198/400 (~50%) | ~37-50% | ~Half abandon before finishing |
| **Activation — added a bike** | **Supabase 161/400 (40%)** (trust DB; PostHog 66 under-fires) | 22-40% | **Big leak: 60% never get a usable garage** |
| **First core action** | **Supabase: 56/161 bike-owners (~35%) did anything beyond the bike** — 37 expense, 33 ride, 19 self-maint | ~14% of signups | **THE DEATH ZONE: 105/161 bike-owners never take a 2nd action** |
| Retained W1 / W4 | **PostHog: ~20% ever-return, W1 ~10-18%, W4 ~0%**; WAU fell 5 straight weeks 166→54 | ~0% W4 | **The headline problem.** Stickiness ~5.5% DAU/MAU |
| Trial started | **RC 14 trials/90d** (2 active) — but 205/302 SAW the paywall | ~5% of onboarders | Low-volume noise; reach is fine, commit is thin |
| Paid | **RC 5 trial→paid, 6 active subs, $29 MRR** (trust RC; PostHog 17 includes trials/refunds) | trial→paid **~36% (fine)**; paywall-view→purchase ~8.3% | Monetization works mechanically — it's starved, not broken |
| Retained paid | unknown (2 churn events, denom too small) | unknown | **Do not compute at n=6** |

---

## What the data says by source

- **Supabase (account truth):** 400 real accounts; 161 bike-owners; only 56 take a 2nd action; expenses is the deepest genuine feature (37 loggers, median 2, max 40). Maintenance is INFLATED elsewhere — 789/852 tasks are OEM auto-seed, only 19 users authored one. No geography column, so Slovakia/internal traffic can't be excluded from DB counts.
- **PostHog (sessions/retention — the only source with this):** ~80% one-and-done, ~0% W4, WAU down 5 weeks straight. The sharpest wedge: **expense_dashboard_viewed = 29 users, expense_added = only 15.** Trip funnel events are broken/zero. Email-path signup event only added ~2026-06-15 (so PostHog "registered" is a floor).
- **RevenueCat (revenue truth — VERIFIED LIVE today):** Current offering = Paywall v3 ($9.99mo / $79.99yr / $99.99 lifetime). **A 3-arm price-point experiment `default-v3-v4` (prexpe16813d4b3) is RUNNING at 100% enrollment, `new_and_existing`, ~14 days in** — splitting ~14 trials/90d across three arms AND re-pricing existing users. **13 offerings exist** (heavy sprawl). ~100% "No Attribution." Trial→paid ~36% is healthy.
- **Search Console / SEO:** Google API configured, blog is Postgres-backed (00157) across 8 locales — but no programmatic per-model pages yet. Slowest channel; not the near-term lever. (Live GSC pull failed this run — re-run separately to confirm.)
- **Acquisition / attribution:** **VERIFIED — `heard-about.tsx` SHIPS** and fires `REFERRAL_SOURCE_SELECTED` + sets `heard_from` once + `setSelfReportedSource` to RC. The gap is **consumption, not capture** — nobody is reading the distribution. `handleSkip` records nothing (skip rate unknown). RC "No Attribution" is therefore a *reporting* gap, not a missing-instrumentation gap.
- **ASO:** Fundamentals ~70% right (localized title, feature order matches priority with AI correctly last). Drags: subtitle wastes the best-indexed field on a feature list; name says "Bike"; keywords/description EN-only despite localized titles; visible 2.0★ US rating.

---

## The biggest leak & why it's the constraint

**Activation→retention: the empty-garage cliff.** Three independent sources converge:
- **Supabase:** 105 of 161 bike-owners (65%) never log a single expense, ride, or self-authored maintenance task. 59% of all 400 signups create zero real content ever.
- **PostHog:** ~80% one-and-done, W4 ~0%, WAU 166→54 over 5 weeks **despite** steady ~28-32 new onboards/week — proving new installs cannot offset the leak.
- **The clearest single wedge:** 29 users view the expense dashboard (the #1 validated feature) but only 15 ever log one. People *see* value and don't *capture* it, so there's nothing to return for.

Acquisition is not the constraint (~112 signups/30d at $0 spend; 205/302 already reach the paywall). Monetization is not the constraint (trial→paid ~36% is fine; it's starved of qualified volume). **Pouring in more water churns out the bottom; re-plumbing the paywall optimizes a step that's already fine.** Fix the bucket — get new bike-owners to a first expense/ride/service inside week one — and you simultaneously lift retention, WAU, and qualified paywall exposure.

---

## Do this next — prioritized roadmap (RICE-ranked, merged across lenses)

| # | Initiative | Lens | Primary metric | RICE | Verdict |
|---|---|---|---|---|---|
| 1 | Stop the live 3-arm price experiment + collapse offering sprawl | Monetization | Clean single-arm trial→paid baseline | **19.13** | **do-now** |
| 2 | Re-gate review prompt to a real value-moment (buries 2.0★) | Activation/ASO | US rating avg + count | **14.4** | **do-now** |
| 3 | Read the HDYHAU referral data + instrument permission grant/reminder loop | Acq/Instr | % onboarders with non-null referral_source (≥70%) | **13.5** | **do-now** |
| 4 | Close expense view→log gap: quick-add empty state + fix checklist deep-link | Activation | % new bike-owners logging ≥1 expense within 7d | **8.5** | **do-now** |
| 5 | ASO metadata fix (subtitle, name, DE/FR/IT/ES localization) | Acq/ASO | Localized search impressions + page-view→install | 6.0 | next |
| 6 | Day-2 goal-personalized re-engagement notification | Retention | D1/D2 return of un-activated completers | 5.1 | next |
| 7 | Contextual paywall at first value-moment | Monetization | paywall-view→trial by source | 3.6 | next |
| 8 | Question-hook Reel → 3x/day TikTok+IG+YT Shorts; kill static photos | Acquisition | Median reach/post + channel signups | 3.71 | next |
| 9 | Server-side push for maintenance-due | Retention | W1 return of push-eligible bike-owners | 2.2 | defer |
| 10 | Post-ride/post-log return hook | Retention | 2nd-action rate among bike-owners | 2.0 | defer |
| 11 | Demo-garage / skip-bike value preview | Activation | Bike-add rate among signups | 1.44 | defer |
| 12 | Reprice annual + lifetime (stage, hold the switch) | Monetization | Blended LTV/customer, annual-mix % | 1.25 | defer |
| 13 | Programmatic SEO per-bike cost/maintenance pages | Acquisition | GSC impressions/clicks for [model] queries | 0.9 | defer |

### DO-NOW specs

**1 — Stop the inert price experiment, consolidate offerings (RICE 19.13)**
- *Hypothesis:* The running 3-arm experiment can't reach significance at ~14 trials/90d; it's splitting the few trials across arms, re-pricing existing users, and polluting realized-LTV. Stopping it loses no revenue and gives one clean baseline to measure every activation fix against.
- *What:* In RC, stop `prexpe16813d4b3`. Keep Paywall v3 (`ofrng8060af0829`) as the single current offering; archive the ~11 stale offerings (Dark Premium v1, New Generated 4_29, premium_v2, lower_price, default, v2_claude_design, etc.) so `list-offerings` returns an intentional set. Verify the in-app CTA: `PaywallModal` hardcodes "Start 7-day free trial" but the monthly v3 product has `trial_duration: null` — either wire a real intro trial or change the copy so it never promises a trial the store won't grant.
- *Experiment + threshold:* Cleanup, not an A/B. Success = experiment stopped, ≤3 active offerings, and a TestFlight purchase confirms in-app trial length == store-granted trial. Watch 2 weeks: realized-LTV/customer should stay flat or rise.
- *Risk:* Archiving an offering still referenced by a placement could blank the paywall — app presents via placement/entitlement (not hardcoded IDs), so low risk; grep for identifiers before archiving and keep v3 live.

**2 — Re-gate the review prompt to a value-moment (RICE 14.4)**
- *Hypothesis:* The one-per-version iOS prompt is currently spent before any value, suppressing positive reviews that would bury the visible 2.0★/1-review US rating.
- *What (code-verified):* `lib/store-review.ts` line 33 `if (count < 1) return;` is a **dead guard** — `count` starts at `0+1=1`, never `<1`. The function is called from **~13 sites including onboarding `personalizing.tsx` and `add-bike.tsx`**, so the prompt fires on a user's first low-investment action. Add a `milestone` arg; only prompt on first expense logged / first maintenance completed / 2nd-core-action. **Remove the onboarding and add-bike call sites.** Raise the dead guard to a real threshold (`count >= 2`).
- *Experiment + threshold:* No flag — strictly-better timing; ship to 100%. Success = US rating climbs toward ≥3.5 within 6-8 weeks and REVIEW_PROMPTED context shifts from onboarding/bike-add to expense/maintenance.
- *Risk:* Apple caps prompts (3/yr/device, one-per-version) so new-review volume is inherently slow — a slow-burn ASO fix, low effort, worth doing regardless.

**3 — Read the referral data + instrument the loop (RICE 13.5)**
- *Hypothesis:* Channel mix is currently *guessed* even though the data already flows; reading it lets us stop spending creative effort blind, and instrumenting the permission/reminder loop unblocks all the notification bets.
- *What (code-verified):* `heard-about.tsx` already fires `REFERRAL_SOURCE_SELECTED`, sets `heard_from` once, and calls `setSelfReportedSource`. (a) Run a PostHog query bucketing `referral_source` by ISO week over 90d, EU+Americas, excluding test@test.com + Slovakia; cross-tab against `onboarding_completed` and `bike_added` to find which channel sends *activated* users. (b) Check `handleSkip` rate — it records nothing; if skip >40%, move the screen earlier (pre-paywall). (c) Add `notification_permission_requested/result` (in `(onboarding)/notifications.tsx`), `reminder_scheduled`, and `reminder_opened` events (typed `as const`, no magic strings).
- *Experiment + threshold:* Decision-readiness. Success = referral_source coverage ≥70% AND one channel shows a >2x signups/week lead; permission grant rate is now known. If coverage <50%, screen placement is the problem.
- *Risk:* Self-report is directional at n~10-30/wk and post-paywall placement biases toward higher-intent channels. Don't over-read week-to-week.

**4 — Close the expense view→log gap (RICE 8.5)**
- *Hypothesis:* The 29-view/15-log gap is friction, not intent. Cutting taps between "I see value" and "I captured my first expense" lifts the share of bike-owners who log expense #1 within 7 days.
- *What (code-verified):* `checklist.store.ts` `first_expense` deep-links to `TAB_ROUTE.GARAGE` (a tab, not the form) — point it at the add-expense form directly (as `expense-dashboard.tsx` already does). On the expense-dashboard empty state, add 2-3 pre-filled quick-add chips (Fuel, Service, Insurance) opening `add-expense.tsx` with category + today's date prefilled so the user only types an amount. Collapse the add-expense form to amount + category required, rest progressive.
- *Experiment + threshold:* PostHog flag (reuse `onboarding_ab_2026`) to 50% of new users. Measure `expense_added` within 7d of `bike_added`. Success = ≥8 absolute pp lift over ~3-4 weeks; **underpowered for p<0.05** at ~30 onboards/wk — accept directional + session-recording confirmation.
- *Risk:* Pre-filled categories bias toward fuel. Don't over-rotate on one noisy week.

---

## What to instrument first (close these gaps so the next call is sharper)

1. **Referral-source read-out** (do-now #3) — you're collecting it; just query it. Single biggest blind spot that's *already fixable today*.
2. **Notification permission grant rate** — completely unknown; gates whether #6/#9 (notifications) are worth building.
3. **Reminder lifecycle events** (`reminder_scheduled/opened`) — the existing local-reminder system is currently unmeasurable.
4. **App Store Connect App Analytics** — the entire impression→page-view→install funnel is dark. Even read-only access would let ASO (#5) and the review fix (#2) be measured.
5. **Trip funnel events** — broken/zero in PostHog; trips can't be evaluated as an activation path until fixed.
6. **TikTok native analytics** — a named primary channel that's entirely unmeasured; the Meta log is 11 weeks stale. Read TikTok weekly instead of relying on the stale log.
7. **Incidental (non-growth) finding to triage:** RLS is reportedly disabled on `public.oem_maintenance_schedules` — worth a security review.

---

## Explicitly NOT now (and why)

- **Pricing A/B tests (#12):** statistically inert at ~14 trials/90d. Stage the annual/lifetime reprice, but **do not flip** until ≥40-50 sustained monthly trials. The proposed "AI Mechanic" subtitle in ASO also contradicts the validated priority (AI is NOT the hero) — use the service/expense-forward variant.
- **Churn / refund-rate optimization:** 1 of 7 transactions is single-event noise at n=6. Do not compute or act on paid-retention rates.
- **Server-side push (#9) and post-action hooks (#10):** real gaps, but the heaviest builds in the set, contingent on the unmeasured permission grant rate. Defer until #3 confirms grant rate >50%.
- **Demo-garage (#11):** second-heaviest build, low confidence it beats simply lowering bike-add friction directly. Try cheap friction reduction (#4) first.
- **Programmatic SEO (#13):** strategically sound but 8-12+ weeks to rank — wrong horizon when retention is the binding constraint and revenue is needed now.
- **Scaling reach before fixing the bucket:** #8 (content) is worth doing in parallel at near-zero cost, but more installs churn out the bottom until activation→retention is fixed. It's throughput, not the root fix.

**Sequencing for one solo dev:** Ship #1–#4 this week (all small, code-verified). Then #5 (text-only) and #6 (after #3 reveals grant rate). #7 lands after #4 proves the activation behavior exists. Re-evaluate everything once W1 retention moves off the floor.
