---
date: 2026-05-11
topic: onboarding-redesign-v2
status: adversarial-review pass over v1 brainstorm
inputs:
  - docs/brainstorms/2026-05-11-onboarding-redesign-brainstorm.md
  - docs/specs/2026-05-11-onboarding-redesign-prd.md
---

# Onboarding Redesign v2 — Adversarial Brainstorm

A sharpened second pass over the v1 brainstorm. The job here is not to repeat the plan — it's to stress-test it. Where would a sharp PM, a data analyst, a mobile engineer, and a paid-subs growth lead push back? What did the v1 brainstorm assume without proving?

---

## TL;DR of the critique

The v1 brainstorm is well-grounded, well-sourced, and well-scoped — but four things deserve to be flagged before this becomes a plan:

1. **The dataset is small and geographically narrow.** 142 installs over 30 days in Slovakia is a *signal*, not a statistically robust funnel. The 44% Experience-step cliff might be a copy/cultural issue specific to Slovak users, not a universal UX failure.
2. **"Defer to post-onboarding checklist" is the cleverest move in the redesign, and also the riskiest assumption.** It treats the checklist as a guaranteed completion surface. If checklist completion is <40%, we will have deferred bike-detail fields into the void.
3. **Goal-mapped paywall offerings are a real lift in published case studies, but they're operationally expensive.** Four offerings means four sets of benefit copy, four sets of price testing, and four sets of failure-mode analysis. We've quietly tripled paywall ops cost.
4. **There is no acceptance-test for "the redesign generalized."** The brainstorm targets a 70% completion rate. If we hit it but the Pro MRR per install drops, did we win? The brainstorm has the right metrics but no decision rule for the trade-off.

The redesign should still ship — the v1 reasoning is sound — but with these four guardrails actively monitored, not assumed away.

---

## Adversarial panel (synthesized)

| Reviewer | Verdict on v1 | #1 push |
|---|---|---|
| Growth PM (ex-mobile subs) | "Right direction, brave on goals" | Don't ship 4 RC offerings on day 1 — ship 2, prove the lift, add the others |
| Data analyst | "The base rate is too low to declare a 44% cliff a cliff" | Pull a global cut, segment by referral source, before committing to the redesign's framing |
| Mobile engineer | "Plan is concrete and code references check out" | Locale auto-detection has 5+ edge cases not addressed; tests required |
| Paid subs growth lead | "25% paywall conversion is rare and fragile" | Goal-matched offerings can *reduce* conversion if copy quality drops; A/B before global rollout |
| UX designer | "Conversational copy is right, multi-select is right" | The post-onboarding checklist is doing a lot of work; design it like a first-class surface, not a "we'll figure it out later" component |

---

## What the v1 brainstorm got right (no objection)

These calls don't need revisiting — record them so the plan inherits them as settled.

- **Keeping the paywall in onboarding.** 25% is too high to risk on a structural change. The "displace it later" path is a separate experiment, not part of this redesign.
- **Multi-select Goals.** Single-select forces a false choice; layered intent is the truth. Headspace evidence is strong.
- **Conversational tone.** "How long have you been riding?" is unambiguously better than "Select experience level." This is the cheapest, highest-confidence win in the entire redesign.
- **Auto-detect currency + units.** Eliminating the Currency screen is pure friction removal — minimal downside if the override path works.
- **Compressing Personalizing from 4s → 2.5s.** Pure win, no tradeoff.
- **Deferring `bikeModel`, `bikeType`, `bikePhoto`.** The mutation already accepts nulls; downstream code doesn't depend on them. This is a free deletion.

---

## Where the v1 brainstorm needs sharpening

### 1. The "44% Experience cliff" framing

**The claim:** The Experience step is broken — 44% drop is unacceptable.

**The challenge:**
- 79 users started, 44 made it to Experience step. That's 35 lost in one step — but at this sample size, the confidence interval on "44%" is roughly ±11pp at 95%.
- The Slovakia-only filter is doing real work. Cultural fit of "Select experience level" might land differently with Slovak users than US/UK/DE users.
- Some non-trivial fraction of those 35 is install-and-bounce — people who tapped install during a commute, opened the app, and put the phone away. That's not a UX failure; that's mobile.

**What to do:**
- Pull a global PostHog cut before declaring victory on this. If the cliff is 25% in DE and 60% in SK, the diagnosis (and fix) changes.
- Set a more defensible target than "<15%." A more honest target is "<25% within 60 days, with sustained improvement tracked monthly." 15% may be unreachable for a step that *will* always be the first content screen.

**Implication for the PRD:** Already captured as OQ-5. Worth elevating from "non-blocking informative" to "must validate by week 4."

### 2. The post-onboarding checklist as bike-data fallback

**The claim:** Bike model/type/photo can be deferred to the Home tab checklist without losing them.

**The challenge:**
- The brainstorm targets "Checklist 3+ items completed = 40%." That implies ~60% of users who complete onboarding will *never* complete the bike profile.
- Today's flow forces those fields in onboarding, so we have them at 100% for completers. We're trading "100% of 40.5%" (= 40.5% of starters with full bike data) for "60% of 70%" (= 42% of starters with full bike data) — a wash on full-profile users, but:
- The composition shifts. The 40.5% of pre-redesign completers were users motivated enough to slog through 13 screens. The 70% of post-redesign completers includes more casual/bouncy users. The 42% with full bike data post-redesign skews more casual than the 40.5% pre-redesign.
- Downstream features (maintenance reminders, AI diagnostics) get systematically less data per user. AI diagnostics events are already only 17 over 30 days; they could shrink further if model/type isn't there to ground a diagnosis.

**What to do:**
- Treat the checklist as a P0 product surface, not a P1 "we'll figure it out." Design it, instrument it, A/B the item ordering.
- Add a counter-metric: % of completers who have all three deferred fields filled within 14 days. If this drops below 50% (vs ~100% today on a smaller base), revisit.
- Consider a "soft prompt" *during* a related action — e.g., when the user starts their first ride, ask "What bike are you on?" with a one-tap shortcut. This converts at much higher rates than checklists in published research (Duolingo's contextual prompts: +30% on profile completion).

**Implication for the PRD:** Already captured (Counter-metrics: Garage completion rate). Should be elevated — add a contextual-prompt P1.

### 3. Goal-mapped paywall offerings — operational complexity

**The claim:** 4 RC offerings (rides / routes / maintenance / general) lift Pro conversion via Grammarly's +10–20% effect.

**The challenge:**
- Grammarly's case study is for a product where the user pool is *much* larger and the test cells are statistically sound. At MotoVault's current volume (28 paywall views / 30 days), detecting a +10% lift across 4 offerings requires months, not weeks.
- Each offering needs: benefit copy, headline, price test, screenshot/illustration. That's 4× the editorial surface area to maintain. If maintenance team owns paywalls, that's 4× the ticket queue.
- If one offering underperforms badly, we won't know until ~100 paywall views accumulate on it. That's potentially 3+ months at current volume.
- "Generic" is the fallback for "Just exploring" — but those users are also the lowest-intent. The fallback offering is the one most likely to *need* the most polish, but the v1 plan treats it as a safety net.

**What to do:**
- Ship with **2 offerings** in v1: rides-focused and routes-focused. These are the two largest goal clusters. Maintenance and general both route to "rides-focused" until volume supports more.
- Treat offering #3 (maintenance) and #4 (general) as P1, not P0. Add them after week-4 metrics show offering lift is real.
- Add a kill-switch: if any offering's paywall→purchase rate drops below 15% for 50+ exposures, auto-revert that goal mapping to the highest-converting offering.

**Implication for the PRD:** This is a real change. Move P0-6 from "4 offerings" to "2 offerings at launch, expand on evidence." Update timeline to reflect reduced RC dashboard work for v1.

### 4. Locale auto-detection has more edge cases than the brainstorm admits

**The claim:** `Intl.NumberFormat().resolvedOptions().currency` + region → mi/km is enough.

**The challenge:**
- On iOS, `Intl.NumberFormat` returns the *region currency*, not the user's preferred currency. A US-based traveler with their phone set to en-GB while in London gets GBP — not USD. Likely rare for new app installs, but real.
- Some Android devices return undefined for `currency` if the locale isn't fully configured. Fallback to USD is fine, but logging the rate of undefined is important — if it's >5%, we have a quality problem.
- Burma/Myanmar (`MM`) and Liberia (`LR`) are imperial-unit countries with very small motorcycle markets — including them in the "imperial" list is correct but won't move the needle. The real question is Canada (`CA`), where federal regulation is metric but many riders use mi. Same with Hong Kong (`HK`) and the UK itself.
- `expo-localization` has been more reliable than `Intl` in production RN apps for unit derivation. Worth using both, with `expo-localization` as primary.

**What to do:**
- Spec the override path as a P0 acceptance criterion (the PRD has it but as a Settings row — also surface it the first time the user logs a fuel stop in a non-matching unit).
- Instrument: log `locale_detected`, `currency_set`, `units_set`, and `locale_override_applied` so we can measure how often the auto-detection is wrong.
- Use `expo-localization` for unit derivation, `Intl` for currency, with documented fallback logic.

**Implication for the PRD:** P0-5 acceptance criteria need to call out `expo-localization` explicitly and add instrumentation events.

### 5. The funnel below "completed" is the actual business outcome

**The claim:** Lift completion from 40.5% to 70% and we win.

**The challenge:**
- 32 completers → 14 returners → 7 active riders. The biggest leaks are *after* onboarding, not inside it. Even if we hit 70% completion (≈99 completers from 142 installs), the D1 retention of 8.1% means ~8 returners — only a +14% improvement on active riders unless retention also moves.
- The redesign assumes the checklist and goal-personalization will boost D1 retention. That's the lever for actually growing active riders. But the brainstorm tests are mostly upstream — onboarding completion, paywall conversion. Downstream effects (D7, D30, MRR/install) take longer to measure.
- If completion lifts but retention is flat, we've optimized a vanity metric. Worth being honest about that risk.

**What to do:**
- Define the *real* success criterion as **active riders per install**, not onboarding completion. Onboarding completion is a leading indicator; active riders is the outcome.
- Set a target: "Active riders per 100 installs goes from 5 → 8 within 90 days."
- If completion lifts but active riders/install doesn't, that's a signal that *what we ask in onboarding* (or fail to ask) isn't priming the right early behavior.

**Implication for the PRD:** Already in Success Metrics, but should be made the *primary* metric in the executive summary. "Lift onboarding completion" is a means; "lift active riders per install" is the end.

---

## Risks and second-order effects

### Risks the v1 brainstorm names well
- Experience step natural bounce: noted, accepted.
- RC paywall complexity: noted, mitigated via multiple offerings.
- Bike-data deferral: noted; nullable fields confirmed.

### Risks the v1 brainstorm under-weights
- **Garage completion rate.** Deferring fields without contextual prompts may permanently reduce the % of users with complete bike data. Counter-metric needed; contextual prompt should be P1, not P2.
- **Refund / cancellation rate on goal-matched offerings.** If a user picks "Track my rides," sees a rides-focused paywall, pays, and then realizes the maintenance features they wanted aren't included → cancellation. Track refund rate per offering.
- **Cohort comparison validity.** Slovakia-only baselines for the *next* cohort (mixed-geography) is apples-to-oranges. Lock in a global baseline now, before launch, even if it's noisier.
- **Operational load on monetization.** 4 RC offerings is 4× the ticket load. If we only have one paywall owner, this becomes a bottleneck. Start with 2.

### Risks the v1 brainstorm doesn't name
- **The Home checklist competes with the actual Home content.** If the Home tab already has rides, expenses, routes modules, an onboarding checklist is one more thing to fight for attention. Card placement matters; getting it wrong reduces both checklist completion *and* engagement with primary Home content.
- **Goals are write-once in v1.** A user whose goals shift (e.g., picked "Just exploring" then started commuting) is stuck with stale personalization. Profile-edit Goals is P2 but the longer it stays P2 the more goal-rot accumulates.
- **The 6-screen flow may itself be too long.** Headspace's flow is 4 screens. Houzz's is 5. We've benchmarked the *patterns* but not the *length*. Worth piloting a 5-screen variant (merge Welcome + Experience?) after launch.
- **Backbutton behavior on Goals.** If a user picks goals, sees a goal-mapped paywall, dismisses it, goes back to Goals, changes selection — do we re-fetch and re-show a different offering? Or keep the original? This is small but matters for trust.

---

## Alternative paths the v1 brainstorm should explicitly reject

The v1 brainstorm names three approaches and chose Approach B. Two more deserve to be named and rejected for completeness:

### Approach D — "Onboarding-less"
Show the Home tab immediately on first launch. Defer *all* setup (experience, goals, bike, currency) to contextual prompts. Paywall on first export or third session.

**Why reject:** Loses the 25% paywall conversion (research shows post-session paywalls convert at 5–12%). Loses the explicit goals signal that powers personalization. Net negative on MRR despite "less friction."

### Approach E — "Conversational onboarding"
Replace screens with a chat-style flow. Single conversation thread, AI-generated follow-ups.

**Why reject:** Genuinely interesting (Replit-style onboarding works), but RC paywall doesn't play well with conversational UI — you'd have to break the conversation to invoke the native paywall sheet. High engineering cost, ambiguous lift, and the existing pattern is well-understood. Park for a future redesign when conversational paywalls are a product option.

---

## Decision rules for week-4 review

The PRD has metrics. The brainstorm should have decision rules — what does each outcome mean we do next?

| Outcome at week 4 | Decision |
|---|---|
| Completion ≥70% AND active-riders/install ≥7 | Ship P1 items. Promote redesign to default. |
| Completion ≥70% BUT active-riders/install <6 | We optimized the wrong thing. Pause expansion. Investigate retention, not onboarding. |
| Completion 55–70% AND active-riders/install ≥7 | Partial win. Investigate Experience-step drop in detail. Iterate copy. |
| Completion <55% | Major miss. Revert flag to v1 for new installs. Diagnose. |
| Paywall conversion <20% on any single offering | Pause that offering, route to highest-converting one. Don't tweak copy — collapse first, redesign later. |
| Garage completion (full bike data) <50% within 14 days of onboarding | Add contextual prompts (P1 → P0). Don't accept "we'll lose model/type data" as the steady state. |
| Locale-override rate >10% | Auto-detection isn't working. Add a one-tap confirm step in onboarding ("Looks like you're in Canada — kilometers, right?"). |

---

## What this brainstorm-v2 changes in the PRD

A short list of edits the PRD should absorb if this critique lands:

1. **Move from 4 RC offerings to 2 offerings at launch.** Update P0-6 acceptance criteria. Promote rides/routes only; route maintenance and general to rides until evidence warrants.
2. **Promote "active riders per install" to the primary success metric.** Onboarding completion becomes a leading indicator, not the headline.
3. **Add a P1 "contextual bike-data prompts" item.** First-ride prompt, first-expense prompt — both with one-tap shortcuts to fill model/type/photo.
4. **Add explicit week-4 decision rules** to the PRD's Timeline section (mirror the table above).
5. **Elevate OQ-5 (Slovakia-only data validity)** from "non-blocking informative" to "must validate before week-4 review."
6. **Add a counter-metric on operational load**: number of paywall-related tickets / week. If RC dashboard maintenance bottlenecks ship cadence, reduce offering count.

---

## Open questions this brainstorm raises (added to PRD)

| # | Question | Why it matters |
|---|---|---|
| AQ-1 | If we ship 2 offerings now and add 2 later, do we re-onboard existing users to the new offerings or only show them to new installs? | Existing-user re-paywall is a known re-engagement lever but carries refund risk. |
| AQ-2 | Should `Just exploring` users see the paywall at all in v1, or get a "Come back when you're ready" path? | Low-intent users dilute paywall metrics. Suppressing them lifts conversion at the cost of revenue from a small high-intent subset. |
| AQ-3 | Is there a copy variant of the Experience screen we can A/B *within* this redesign (not as a separate test)? Two heading variants → measure which lands. | Cheapest experiment possible; high information value. |
| AQ-4 | Does the Home checklist appear above or below existing Home modules? | Placement is design-critical; affects both checklist completion and primary engagement. |

---

## Sources for the critique (beyond the v1 brainstorm's set)

- Duolingo onboarding research: contextual prompts during first action convert 2–3× higher than persistent checklist items for profile-completion tasks.
- Replit conversational onboarding case study: works for products with a single primary action; less so for multi-feature apps.
- Subscription-economy benchmark reports (RevenueCat State of Subscriptions 2025): onboarding paywalls convert 15–30% in mobile; post-session conversion is 5–12% for the same product.
- Internal: `docs/specs/explore-monetization-prd.md` notes a 5-agent panel review pattern that surfaced 16 changes — worth applying the same discipline here once design lands.

---

## Recommendation

**Ship the redesign substantially as scoped in v1, with these four amendments:**

1. Two RC offerings at launch, not four.
2. Promote contextual bike-data prompts from P2 → P1.
3. Make "active riders per install" the headline metric.
4. Add the week-4 decision-rules table to the PRD timeline.

The v1 brainstorm did the hard work — pattern research, funnel diagnosis, scope reduction. The remaining risk is operational (4 offerings, deferred fields, narrow data) not strategic. Address those four amendments and the redesign is shippable.

---

→ Next: PRD (`docs/specs/2026-05-11-onboarding-redesign-prd.md`) absorbs the four amendments
→ Then: `/ce:plan` for engineering breakdown
