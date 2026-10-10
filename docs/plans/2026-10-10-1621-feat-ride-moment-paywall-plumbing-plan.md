---
title: Ride-Moment Paywall Plumbing - Plan
type: feat
date: 2026-10-10
topic: ride-moment-paywall-plumbing
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Ride-Moment Paywall Plumbing - Plan

## Goal Capsule

- **Objective:** Every Pro purchase that a ride caused can be counted, and no rider is ever interrupted by a paywall at the roadside. After this ships, a non-Pro rider who saves their fifth ride or their first long ride sees one factual card with their own numbers, opens the paywall only by tapping it, and RevenueCat attributes the resulting purchase to that moment.
- **Means:** Tap-only teaser cards on the ride summary, shipped first in a shadow mode that logs eligibility without showing anything, with one RevenueCat placement per trigger resolving to one ride-themed offering.
- **Product authority:** Owner (Andrej). This plan covers area 1 of the ride Pro work; the Rider Insights redesign and live sharing are separate plans, not active scope here.
- **Open blockers:** None before planning. See Outstanding Questions for items deferred to planning.

---

## Product Contract

### Summary

Add two post-ride teaser triggers (fifth qualifying ride, first ride of 50 km or more) as one inline card on the ride summary, opened to a paywall only on tap. Ship a shadow phase first that records who would have seen a card and why others were suppressed, so the live phase has a baseline and the ride placements can be judged by counts.

### Problem Frame

Saved rides are 72% of all core actions in the last 90 days, and riders who complete a ride in week one stay at 61% versus 5% for riders who do nothing. Yet no paywall surface is tied to a ride: 15 of 22 purchases in the same window came from onboarding, and 1 of 13 riders with ten or more rides has ever paid. The only post-use gate that converts is the AI diagnostics gate, which riders open themselves, at 17.6% against 3.8% in onboarding. There is no lifetime per-user ride count, no ride placement in RevenueCat, and no shadow logging in the mobile app, so today there is no way to measure a ride-driven purchase even if one happened. The two summary triggers reach riders at their fifth to seventh ride; the 13 riders with ten or more rides are reached only through the locked cards in Rider Insights.

### Key Decisions

- **Summary trigger at the fifth ride, aligned with the Rider Insights data threshold.** Chosen over lowering the Insights threshold to three: a rider who bought at ride three would meet empty Pro groups for two more rides; the pool shrinks, the sale stays honest. Governs R2.
- **Tap-only, never auto-present** (session-settled: user-directed — chosen over auto-presenting the paywall at the fifth ride and over locked-cards-only: a rider at the roadside in gloves is never interrupted, and self-opened gates convert about four times better here). Governs R4, R5.
- **Shadow phase ships before any live card.** The live phase cannot be judged without a would-have-shown baseline, and the shadow phase has no blockers. Governs R10, R11.
- **One card on the ride summary, shared with Rider Insights.** The post-ride insight hook from the Rider Insights plan and the milestone teaser are the same card; for an eligible non-Pro rider the card opens the paywall, otherwise it opens Rider Insights. Governs R6.
- **One placement per trigger, one ride-themed offering.** Webhooks carry the offering, not the placement, so a dedicated offering is the only way RevenueCat itself can see ride-driven revenue; per-trigger placements let conversion be read per moment. Governs R8, R9.
- **Nothing free today becomes Pro.** This plan adds entry points only; the Pro content it sells lives in the Rider Insights plan. Governs R7.
- **Judge by counts, not rates.** Fewer riders become eligible per month than the earlier third-ride estimate of 7 to 10, plus the launch backfill under R2; both are recounted from the fifth-ride rule before the live phase; there is no A/B at this volume.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers the measurement layer only. The breakdown below is the current understanding, not a committed roadmap.

- Rider Insights redesign (`docs/plans/2026-10-10-1621-feat-rider-insights-redesign-plan.md`)
  - Enables the live phase here: the card sells the four Pro insight groups. This plan creates the `rider_insights` placement with the other two (R8); Rider Insights uses it.
  - Shares the ride-summary card (R6).
- Live sharing demand test (`docs/plans/2026-10-10-1621-feat-live-sharing-fake-door-plan.md`)
  - Can proceed independently of this plan.
- Paywall V5 design experiment (RevenueCat draft `expd7c1d56904`)
  - Configured without the ride placements before it starts (see Dependencies).

### Actors

- A1. Non-Pro rider who records rides on the phone.
- A2. Owner reading RevenueCat and PostHog to decide whether ride placements stay.

### Requirements

**Eligibility and triggers**

- R1. A qualifying ride is completed by the rider, not deleted, at least 1 km and 3 minutes of moving time, and not ended by the system (idle sweep, stale-on-start, headless auto-end).
- R2. Trigger `ride_milestone_5` fires on the summary of the fifth qualifying ride, with a late window up to the seventh if the fifth was missed. Riders who already have five or more qualifying rides when live cards switch on are treated as reaching this trigger on their next qualifying ride's summary, once.
- R3. Trigger `ride_long_50km` fires on the summary of the first qualifying ride of 50 km or more in the rider's own distance unit, when no earlier qualifying ride reached that distance. Riders whose longest qualifying ride is already 50 km or more when live cards switch on never receive this trigger.
- R4. A rider is eligible only when not Pro and not in a trial, not on CarPlay, with no active ride, and with no onboarding paywall dismissed in the last 72 hours.

**The card**

- R5. The card appears inline on the ride summary below the stat grid, away from Save and the personal-record pill, and the paywall opens only when the rider taps it.
- R6. The card is the same card as the Rider Insights post-ride hook and has two states: teaser, when a trigger fired and the rider is eligible under R4, where tapping opens the paywall; and hook, for everyone else, where tapping opens Rider Insights. The hook renders on every summary; the teaser replaces it only when a trigger fires.
- R7. Saving a ride is never blocked or delayed by eligibility evaluation; the ride is stored before the summary evaluates anything, and an offline or failed evaluation shows no card.
- R8. Each trigger requests the paywall with its own placement (`ride_milestone_5`, `ride_long_50km`; `rider_insights` for the locked card in the Rider Insights plan), and all three resolve to one ride-themed offering per audience carrying the same products as the current default: one with the trial for never-trialled riders and one without it for the returning-trialer targeting rule, each mapped for all three placements inside its rule.
- R9. Copy states facts in the rider's own numbers and never uses "unlocked", "milestone", "congrats", "achievement", "level" or "streak", nor confetti, emoji or badge styling.

**Frequency and suppression**

- R10. Each trigger shows at most once per account ever, and the fifth-ride teaser wins when both are due on one summary; the hook state is exempt from this cap and has no dismiss control.
- R11. Every trigger evaluation emits one eligibility event, including suppressed cases, carrying trigger, shown or would-have-shown, suppression reason, qualifying ride count, distance, trial history and platform.
- R12. The store-review soft-ask is skipped on the Save of a summary that showed the card in its teaser state; in its hook state the soft-ask runs as today.
- R13. Live cards are turned off by publishing an over-the-air update that flips a shipped constant; no store build is needed.

**Phasing**

- R14. The shadow phase ships first and emits R11 events with nothing shown; the live phase ships only after Rider Insights delivers its Pro groups as working surfaces.

### Key Flows

- F1. Third ride, eligible
  - **Trigger:** A1 stops their fifth qualifying ride and the summary opens; the ride is already completed server-side at Stop.
  - **Steps:** Summary opens with the ride already stored; eligibility evaluated locally from the summary plus a qualifying-count read; card rendered in its teaser state; eligibility event emitted; rider taps; paywall requested with `ride_milestone_5`.
  - **Outcome:** Purchase or dismissal recorded against the placement.
  - **Covers:** R1, R2, R4 to R9, R11.
- F2. Shadow phase
  - **Trigger:** Any summary opening while live cards are off.
  - **Steps:** Same evaluation; event emitted with would-have-shown or the suppression reason; nothing rendered.
  - **Covers:** R11, R14.

### Acceptance Examples

- AE1. **Covers R1, R2.** Given a rider with four qualifying rides and one 400 m test ride, when they save a 12 km ride, then the fifth-ride teaser shows.
- AE2. **Covers R4, R6.** Given a rider who dismissed the onboarding paywall 10 hours ago, when their fifth qualifying ride's summary opens, then the card shows in its hook state, no teaser shows, and the event records the suppression reason.
- AE3. **Covers R3, R10.** Given a rider using miles whose longest ride is 28 mi, when they save a 32 mi ride and the fifth-ride card is also due, then only the fifth-ride card shows and the long-ride card is still pending.
- AE4. **Covers R6.** Given a Pro rider, when their ride summary opens, then the card shows in its hook state and tapping opens Rider Insights, never a paywall.
- AE5. **Covers R7.** Given the phone is offline at save, then the ride is stored and no card shows.

### Success Criteria

- Primary: paid starts attributed to any of the three placements in R8 per eligible non-Pro rider within 30 days, matched in RevenueCat (direct purchase or converted trial; trial starts alone do not count); views and paid starts are counted across all three placements.
- Decision at 8 weeks after the live phase or 60 ride-card views, whichever is later: keep at 3 or more paid starts with flat guardrails; kill at 0 paid starts after 60 views or a 25%+ drop in rides per rider; otherwise extend 8 weeks with copy frozen.
- The first review judges the ride placements while they sell Rider Insights alone. A kill removes the live cards but keeps the placements, the ride-themed offering and the shadow events; the rule re-runs for one further 8-week window when a second Pro surface joins the ride-themed offering.
- Guardrails for non-Pro riders, 4 weeks before versus after: rides per rider per week, started-to-saved ratio, 30-day retention, new 1 to 2 star reviews mentioning a paywall.

### Scope Boundaries

- Deferred: season recap trigger, second-bike trigger, cost-per-km trigger, a single test of auto-presenting at the fifth ride (only if the tap rate stays under 15% after 4 weeks live), personal numbers inside the RevenueCat paywall once custom variables work natively.
- Not this plan: the Pro analytics content, changes to the onboarding paywall, any limit on recording, history or logging.
- Considered and not built: a runtime feature-flag reader (the over-the-air revert in R13 covers the off switch); a 14-day cooldown between teasers and a dismissed-twice rule (with one teaser per trigger per account neither can fire).

### Dependencies / Assumptions

- Rider Insights must ship its Pro groups before the live phase (R14).
- The RevenueCat v3 versus v4 experiments are stopped (verified 2026-10-10). The draft Paywall V5 design experiment is configured without the three ride placements before it starts, so it never overrides them; if it cannot be scoped that way it starts only after the live-phase decision.
- The returning-trialer targeting rule must be edited to carry the ride placements and the no-trial ride offering; it does not apply to them by default.
- The shadow phase ships over the air to the runtime currently in riders' hands (3.22.x at the time of writing; 3.25.0 was submitted to review on 2026-10-10; re-check at publish time) plus an API deploy, with no new native dependency. The live phase ships in the store build that carries Rider Insights, and the eligible pool and decision clock count only riders on that build.
- Baselines use a trailing window with its spread checked; no multi-month averages.

### Outstanding Questions

**Deferred to Planning**

- Whether shown-once state lives on the device or on the server.
- Whether client-side auto-ended rides are marked on the server or the overcount is accepted.
- Whether the paywall presents before or after the summary closes; engineering recommends after.

### Sources / Research

- GitHub issue #266 and its 2026-10-07 research comment; #270 OQ5 (one post-ride moment).
- `apps/mobile/src/app/(modals)/ride-summary.tsx` `handleSave`; `apps/mobile/src/lib/subscription.ts` `presentPaywall` resolves offerings by placement with a fallback to current.
- No `ride_*` placement and no mobile would-have-shown event exist today; the only shadow event is in the receipt-scan API service.
- PostHog 90-day pull 2026-10-05 and `docs/Product-Analytics-Report-2026-10-01.md`.
