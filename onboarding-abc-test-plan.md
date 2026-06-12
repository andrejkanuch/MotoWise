# Onboarding A/B Test Plan + AI Personalization

**Goal:** run a 2-arm A/B test of the onboarding flow to find the higher-converting version, and define how to personalize onboarding with an LLM (with safe fallbacks).
**Companions:** `onboarding-restructure-proposal.md`, `onboarding-aha-moment.md`, `auth-and-paywall-timing.md`, `onboarding-design-prompts.md`.
**Date:** 9 June 2026
**Note:** both arms are **new designs**. Your current V4 flow is the pre-launch baseline (optionally kept as a small holdout — see §Experiment design), not a test arm.

---

# PART 1 — THE A/B TEST

## Strategy: two coherent flows that share the fix, differ on one big lever

Both arms apply the **core restructure** — bike = first real action, search-first bike with a demoted skip, an instant payoff/Reveal, a commitment step, and anonymous-through-purchase auth — so the keystone problem (bikes not getting added) is fixed in both. They differ on a single strategic dimension: **how much we invest the user before the paywall.**

- **A (lean)** = shortest path to the aha; ask for the sale fast while motivation is highest.
- **B (invested)** = a longer, belief-building flow (more profiling, a personalized projection, AI-tailored content) before the paywall.

Clean contrast → the test answers: *"Does a fast flow or a longer, invested flow convert better, given the restructure?"*

---

## Variant A — "Value-first, lean" (fast to the aha)

```
Splash → Welcome (+ "Log in") → Experience (1 tap, auto-advance)
  → ★ Bike (search-first; skip demoted to partial-capture, still creates a bike)
  → ★ Reveal: "Bike Dossier" (recall-check led, concise — 1 screen)
  → Goals ("tune your dashboard") → Maintenance (always populated)
  → ★ Commitment (1-tap pledge: "I'm ready to take care of my {bike}")
  → Paywall (personalized; exposes Restore + "Already have an account?")
  → Account "Secure your subscription" (post-purchase only; aliases purchase)
  → Notifications → Personalizing → Home
```
- **Auth:** anonymous through the paywall; account requested *after* purchase (save & sync); free users prompted contextually later.
- **Aha:** Bike Dossier **led by the instant recall check**, then plan + community — concise.
- **Hypothesis:** moving the keystone to the first real action, paying it off instantly, and adding a micro-commitment — while keeping the flow short — maximizes **bike-add rate** and **day-0 trial starts**.

---

## Variant B — "Invested & personalized" (longer, projection-led, AI-tailored)

```
Splash → Welcome (+ "Log in") → Experience
  → 2–3 profiling questions (riding frequency, what you want to improve, last service / mileage)
     — each with a one-line "why", a progress bar, and a social-proof line
  → ★ Bike (search-first)
  → ★ "Building your plan…" animated loading → ★ Reveal: personalized Dossier
     LED BY A COST PROJECTION ("~€420 this year") + recall check + AI-generated
     "3 things {Model} owners watch for"
  → Goals → Maintenance
  → ★ Commitment (press-and-hold / signature-style pledge)
  → Paywall (fires right after the projection peak; personalized headline + value props)
  → Account "Secure your subscription" (post-purchase) → Notifications → Personalizing → Home
```
- **Auth:** anonymous through the paywall (same as A) — so the test isolates *length/investment*, not auth.
- **Aha:** richer, **projection-led** payoff with a "building your plan" loader (the paywall's opening argument) + **AI-personalized known-issues** (Part 2).
- **Hypothesis:** a longer, more *invested* onboarding with a personalized projection and AI-tailored content builds more belief (effort-justification + "science" framing), lifting **trial→paid** and **retention**, accepting some added drop-off.

---

## Difference matrix (everything else held constant)

| Dimension | A (lean) | B (invested) |
|---|---|---|
| Bike position | first real action | first real action |
| Bike step UX | search-first, demoted skip | search-first, demoted skip |
| Profiling depth | Experience + Goals | Experience + Goals + 2–3 Qs |
| Aha / Reveal | concise, recall-led | projection-led + AI known-issues |
| "Building your plan" loader | no | yes |
| Commitment | 1-tap | press-and-hold / signature |
| Paywall timing | after commitment (day 0) | after projection peak (day 0) |
| Auth / account | post-purchase | post-purchase |
| AI personalization | optional (paywall copy only) | yes (known-issues, projection, copy) |
| Onboarding length | short | long |

> Because A and B share everything except **length/investment + AI**, a win is cleanly attributable to that lever — no confounds.

---

## Metrics

**Primary metric (decide before launch):** **install → trial start** (day-0 paywall conversion). Both arms present the paywall in onboarding, so day-0 is a fair comparison.

**Activation guardrail (the thing this effort targets):** **bike-add rate** (`install → bike_added`, make-level) — should hold or rise in both arms. A variant that lifts trials but not bike-adds is fragile.

**Secondary / guardrails:**
- Onboarding completion + **per-step drop-off** (you already emit `ONBOARDING_STEP_VIEWED/COMPLETED/SKIPPED` with `step`/`step_index`) — watch B for fatigue.
- **trial → paid** by arm (B's core bet).
- **D7 / D30 retention** by arm.
- **Realized LTV per cohort** — decisive guardrail: per the "onboarding too short" research, B could lift trial starts but monetize/retain differently. Don't ship on trial-start alone.
- Time-to-complete onboarding.

**Decision rule:** win on **install→trial start** *without* regressing bike-add rate, trial→paid, retention, or LTV beyond a pre-set tolerance. If the two split (e.g., A wins volume, B wins trial→paid + retention), decide on **realized value per install**, not raw trial-start %.

---

## Experiment design

- **Assignment:** randomize at **install / first launch**, persistent, **50/50**, via your PostHog feature flag (already used for onboarding). Bucket on a stable anonymous ID so a user always sees the same arm.
- **Optional holdout:** keep a small slice (e.g., 5–10%) on the **current V4** to measure the absolute lift of the redesign, not just A-vs-B. Recommended if traffic allows.
- **Sample size (planning):** to detect **+3pp** on a ~10% baseline trial-start rate at 80% power / 95% confidence (two arms, no multiple-comparison correction), ≈ **1,700–1,900 per arm (~3,500–3,800 total)**. Detecting **trial→paid** differences needs materially more volume (smaller base) — treat it as a directional guardrail unless you can power it. Run a real power calc with your baseline.
- **Duration:** whole-week increments, **≥2 weeks** (3–4 better) to cover weekday/weekend + acquisition mix. Fix the horizon in advance **or** use a sequential/Bayesian test — do not peek-and-stop.
- **Analysis:** A vs B on the primary metric; report effect size + confidence interval (not just p-value); segment by platform (iOS/Android) + acquisition source.
- **Hygiene:** exclude internal / Expo Go builds; confirm the paywall presents in both arms; verify analytics fire identically across arms before launch (instrument a dry run).

## Follow-up isolation tests (after a winner)

One change at a time, per the funnel research:
1. **Length/investment** — the A↔B lever, refined (which of B's extra questions actually help?).
2. **Reveal lead** — recall-check vs cost-projection as the first proof.
3. **Commitment style** — 1-tap vs press-and-hold/signature.
4. **Auth timing** — deferred (both arms) vs early, vs account-at-purchase.

---

# PART 2 — AI-PERSONALIZED ONBOARDING (with fallbacks)

You have Claude in the API already, plus Gemini / OpenAI access. Use them to make onboarding feel tailored to *this rider and this bike* — but **never block the day-0 flow** on a live model call.

## Where AI adds real value (ranked)

1. **"What {Model} owners watch for" (known issues)** — the AI proof in the Reveal/Dossier (mainly B). Highest perceived value + curiosity. Hedged + grounded.
2. **Personalized copy** — Reveal subtitle, paywall headline/value-props, "building your plan" narrative, adapted to {experience + goal + Year/Make/Model}.
3. **Cost-projection narrative** — turn the OEM schedule + cost heuristic into natural language ("Your first year is light — mostly an oil service and a chain check, ~€X").
4. **(Cautious) adaptive questioning** — choose the next profiling question from prior answers. Keep **rule-based**, not LLM, to stay fast and predictable.

## Hard rule: facts vs flavor

- **Authoritative facts come from APIs, never the LLM.** Recalls → NHTSA. Specs/models → NHTSA vPIC (already used). OEM schedule → your data. The LLM only *summarizes/phrases* — it must not invent recalls, intervals, or mechanical claims (trust + liability). **Hedge** generated content ("owners commonly report…").

## Architecture & fallback (the part you asked about)

**Principle: onboarding must never block on a live model call** — this is the day-0 window where conversions are won.

1. **Precompute + cache (preferred).** Personalization keyed on **Year/Make/Model** is finite-ish. On first sighting of a Y/M/M, enqueue a NestJS job that generates known-issues + copy, validates it, and stores it in Supabase (`model_insights`: `status`, `generated_at`, `source_model`). Every later rider with that bike gets an **instant cached** result; regenerate periodically.
2. **Provider abstraction with failover.** One `AiPersonalizationService` interface; providers behind it: **Claude (primary) → Gemini / OpenAI (secondary) → static template (final)**. On timeout / error / rate-limit / invalid output, fail down the chain.
3. **Validate every response with Zod** (matches your stack's "Zod for AI response validation"). Schema-invalid output = failure → next provider → static.
4. **Tight real-time budget.** On a cache miss, **1.5–2.5s timeout**; show the "building your plan…" loader (the B aha) only up to that budget, then serve the **static fallback** and move on. Never spin indefinitely.
5. **Graceful degradation.** Without AI, screens still work: recall (NHTSA) + plan (your data) + community count (your stats) + **templated copy**. The AI block hides or shows static — onboarding never breaks.
6. **Feature-flag it.** Gate AI so it can be toggled, A/B'd, and disabled instantly if quality/cost/latency degrade. (In this test, AI is part of what **B** carries.)
7. **Privacy & cost.** Send only Y/M/M + coarse answers (no PII / no email). Cap tokens; cache aggressively; light output moderation.

## Fallback chain (at a glance)

```
Need personalized content
  → cache hit?  → serve instantly ✅
  → cache miss → try Claude (≤2s)
       → fail/timeout/invalid → try Gemini/OpenAI (≤2s)
            → fail/timeout/invalid → serve STATIC template ✅ (and enqueue async regen)
Facts (recalls/specs/intervals) ALWAYS from authoritative APIs, never the LLM.
```

## How AI maps to the arms

- **A (lean):** minimal — at most a personalized, templated, AI-polished paywall headline. Keep A fast.
- **B (invested):** full AI layer — known-issues, projection narrative, personalized paywall value-props. This is part of what B tests, so a clean read on AI's contribution comes from the A↔B result plus the isolation follow-ups.

---

## Recommended sequence

1. Build the shared restructure + **precomputed/cached** AI (known-issues by model) with the static fallback ready from day one.
2. Ship the **A/B test**; primary = **install→trial start**, with bike-add rate as the activation guardrail and trial→paid / retention / LTV as decisive guardrails.
3. After a winner emerges, run the **isolation follow-ups** (length, reveal lead, commitment style, auth timing).

---

*Methodology grounded in `onboarding-research-reading-list.md` (measure install→trial and trial→paid separately; count new paying users / value, not just %; change one thing at a time; watch LTV on longer flows). Auth per `auth-and-paywall-timing.md`; aha content per `onboarding-aha-moment.md`.*
