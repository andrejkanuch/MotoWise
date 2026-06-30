# Handoff — Growth activation→retention work (MOT-269)

_Snapshot for a fresh session. Date: 2026-06-30._

## TL;DR
A data-driven growth diagnosis (PostHog + RevenueCat + Supabase + social + ASO) found the constraint is **activation→retention ("empty-garage cliff"), not acquisition.** The **do-now** code work is built, reviewed, and on a single branch with green CI — **PR #136, NOT yet merged.** Several manual/prod steps are **still pending** (notably the DB migration is **not pushed to prod**). The rest of the backlog is deliberately deferred or blocked on production data.

---

## What we're building (the bet)
The organic funnel works (~112 signups/30d at $0 spend), but **65% of bike-owners never take a 2nd action; ~80% are one-and-done; W4 retention ≈ 0%.** Sharpest wedge: 29 users viewed the expense dashboard, only 15 logged one. So the strategy is **fix the leaky bucket (activation → first-week retention) before scaling reach.** Full context: `docs/Growth-Strategy-2026-06-29.md`. Funnel baseline + reproducible queries: `docs/Growth-Baseline-2026-06-29.md`.

---

## What was done (PR #136, branch `feat/growth-mot-269` → base `main`)
Single common branch; 20 commits (8 pre-existing `feat/next-work` + 12 growth/review); CI all green (lint, types, tests, i18n, security, Vercel); **mergeable, not merged.**

**Done & code-complete (5 tickets):**
- **MOT-271** — Re-gated the iOS review prompt: typed `REVIEW_MILESTONE`, real `MIN_ACTIONS_BEFORE_REVIEW` threshold (old `count<1` guard was dead), removed onboarding + add-bike call sites. New `store-review.test.ts`.
- **MOT-272** — Instrumented silent events: `referral_source_skipped`, `notification_permission_requested/result`, `reminder_scheduled/opened`. (Identity-stitching guard untouched.)
- **MOT-273** — Fixed checklist `first_expense` deep link (resolves the user's bike → expense dashboard; falls back to garage tab while bikes load, add-bike only when confirmed empty) + one-tap prefilled quick-add chips (Fuel/Service/Insurance) on the empty state. Checklist store bumped to v3 with an **in-place migrate** that refreshes deep links while preserving progress.
- **MOT-285** — `trip_created` now also fires on the publish path, so the trip_created→trip_published funnel is computable.
- **MOT-283** — Migration `00159_oem_maintenance_schedules_rls.sql`: enables RLS (public-read, service-role-only writes). **File committed; NOT applied to prod.**

**Also produced:** redundant `paywall-modal.tsx` deleted (mobile + web); `docs/ASO-Metadata-2026-06-29.md` (ready-to-paste localized App Store copy); RevenueCat verification checklist (in the baseline doc); a one-time **cloud routine** (`trig_01LYqoU7AMat6Y2t9RMZuT28`) firing **2026-07-29** to drive the re-check.

**Code review:** multi-agent review run; caught + fixed two real issues (the v3 migration would have hidden the checklist for existing users; a `firstBikeId` cold-start race) plus 5 cleanups. Committed as `fix(review)`.

---

## ⚠️ What's MISSING / pending (do these — mostly manual)
1. **DB migration NOT pushed.** `supabase/migrations/00159_...sql` is committed but **not applied to prod**. Run `npx supabase db push` (ideally low-traffic window — `ENABLE RLS` takes a brief lock). Then `pnpm generate:types` is **not** needed (no column change). Verify with Supabase advisors that the `rls_disabled_in_public` warning for `oem_maintenance_schedules` clears.
2. **PR #136 not merged.** Review/merge it (the failing `check:api-bans` is pre-existing debt in `apps/api/.../blog.service.ts`, identical on `main` — not from this work; CI's lint job passes).
3. **MOT-270 (RevenueCat dashboard, manual):** verify paywall trial copy uses intro-offer-aware variables; archive the 7 safe stale offerings. **Experiment `prexpe16813d4b3` and its 3 arms (`new_offering_4_29_24_4_v2`, `Paywall v3`=current, `Paywall v4`) stay running / off-limits.** Checklist in baseline doc.
4. **MOT-274 (App Store Connect, manual):** paste the localized metadata from `docs/ASO-Metadata-2026-06-29.md`.
5. **MOT-284 (manual):** 2-min Meta Ads Manager check — confirm the unverified $14/day campaign is actually off (if live, RC "100% No Attribution" is a misconfig).
6. **New MOT-272 events only populate on a RELEASE build** (PostHog disabled in `__DEV__`). Don't read them as zero until a TestFlight/prod build ships.

---

## What needs to be built next (backlog — order matters)
**Blocked on production data (wait for the 2026-07-29 read of the notification grant rate):**
- **MOT-275** day-2 re-engagement notification · **MOT-278** server-side push for maintenance-due.

**Next, but sequenced after merge + activation read:**
- **MOT-276** contextual RC paywall at first value-moment — unblocked by MOT-273, but ship after the quick-add proves activation lift; needs an RC placement (`aha_first_expense`).
- **MOT-277** repurpose the question-hook Reel 3×/day (TikTok/IG/YT Shorts); kill static photos — content/ops.

**Deferred (premature/wrong-horizon by strategy):**
- **MOT-279** post-action return hook · **MOT-280** demo-garage · **MOT-281** reprice annual/lifetime (stage only, don't flip until ≥40–50 trials) · **MOT-282** programmatic per-bike SEO pages.

---

## Pointers
- Strategy: `docs/Growth-Strategy-2026-06-29.md`
- Baseline + queries + RC checklist: `docs/Growth-Baseline-2026-06-29.md`
- ASO copy: `docs/ASO-Metadata-2026-06-29.md`
- Plan: `docs/plans/2026-06-29-001-feat-growth-activation-retention-plan.md`
- Linear epic: MOT-269 (children MOT-270…282; standalone MOT-283/284/285)
- Branch/PR: `feat/growth-mot-269` / PR #136
