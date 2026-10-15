# MotoVault Onboarding — Variant B Design Prompts (delta from Variant A)

**Purpose:** generate **Variant B ("Invested & personalized")** by *deriving it from Variant A* — same visual system, same components, same screens wherever unchanged. B only **adds a few steps and enriches the payoff**; it must look and feel like the same app, not a redesign.
**Base:** `onboarding-design-prompts.md` (the Variant-A / v2 package). Generate A first, or have it open, so B can reuse its frames and styles.
**Companions:** `onboarding-abc-test-plan.md` (why B exists), `onboarding-aha-moment.md`, `auth-and-paywall-timing.md`.

**How to use:**
1. Make sure **Variant A is generated** (from `onboarding-design-prompts.md`) and in the tool's context.
2. Paste the **B Master Delta Prompt** (Section 1).
3. Paste the **per-screen prompts** (Section 2) only for the NEW / MODIFIED screens. Everything else is reused from A unchanged.

---

## SECTION 1 — B MASTER DELTA PROMPT (paste after Variant A exists)

```
We are creating Variant B of the MotoVault onboarding for an A/B test. Variant B is
DERIVED FROM Variant A — it must reuse Variant A's exact design system, components,
type, color, spacing, motion, header (progress bar + back chevron), card styles, and
CTA styles. DO NOT redesign anything. Visually, B should be indistinguishable from A on
every shared screen. B only differs in ONE strategic way: it invests the user MORE
before the paywall (a few extra profiling questions, a "building your plan" loader, a
richer projection-led + AI-personalized Reveal, and a stronger commitment), and fires
the paywall right after that projection peak.

REUSE FROM VARIANT A UNCHANGED (do not modify — same frames):
- 01 Splash, 02 Welcome (+ "Log in"), 03 Experience, 04 Bike (search-first, demoted skip),
  06 Goals, 07 Maintenance, 09 Paywall (native spec — timing/personalization note below),
  10 Account (post-purchase), 11 Notifications, 12 Personalizing, S1 Sign in, CP contextual prompt.

ADD (NEW screens — built from A's existing card/loader components):
- 03a Profiling — Riding frequency (single-select cards, auto-advance; like 03 Experience)
- 03b Profiling — What you want to stay on top of (select; like 06 Goals)
- 03c Profiling — Last service & mileage (chips + input)
- 04L "Building your plan…" loader (reuse 12 Personalizing's pulsing-ring style)

MODIFY (same layout/components as A, content/behavior changed):
- 05 Reveal "Bike Dossier" → projection-led + AI "known issues" card (A leads with the
  recall check; B leads with the cost projection and adds a known-issues card).
- 08 Commitment → press-and-hold / signature pledge (A is a single tap).

FLOW ORDER FOR B:
01 Splash → 02 Welcome → 03 Experience → 03a Frequency → 03b Stay-on-top-of →
03c Last service & mileage → 04 Bike → 04L Building your plan → 05 Reveal (projection-led)
→ 06 Goals → 07 Maintenance → 08 Commitment (hold/signature) → 09 Paywall →
10 Account (post-purchase) → 11 Notifications → 12 Personalizing → Home.
(S1 Sign in and CP unchanged, same entry points as A.)

GLOBAL RULES (carried from A):
- Progress bar now has MORE segments (B is longer) — keep the same bar component, just
  more steps; active segment in copper.
- Every new question states a one-line "why" under the headline, shows the progress bar,
  and includes a small social-proof line (Geist Mono) — this is what makes the extra
  length feel worthwhile rather than tedious.
- Personalize later copy with these answers (frequency, concern, last service, mileage,
  plus experience/goal/bike).
- Keep each step under the same motion budget as A (FadeInUp, <300ms, haptics).

OUTPUT: new frames named to slot into the order (e.g. "03a — Frequency", "04L — Building
your plan", "05 — Reveal (B)", "08 — Commitment (B)"). For reused screens, reference the
existing A frame rather than regenerating. Give a one-line rationale per new/modified
screen tying it to B's hypothesis (more investment → more belief → higher trial→paid).
```

---

## SECTION 2 — PER-SCREEN PROMPTS (only the NEW / MODIFIED screens)

### 03a — Profiling: Riding frequency (NEW)
```
Design "03a — Frequency". Clone the 03 Experience pattern EXACTLY (same header with
progress bar, same selectable card component, single-select, auto-advance on tap).
Eyebrow (Geist Mono): "YOUR RIDING". Headline (Instrument Serif): "How often do you / get
out?" (italic copper on "get out?"). Why-line: "We'll tune service intervals and reminders
to your real mileage." Cards (icon + title + Geist Mono sub):
- Almost daily · DAILY RIDER
- A few times a week · WEEKLY
- Mostly weekends · WEEKENDS
- Now and then · OCCASIONAL
- Seasonally · FAIR-WEATHER
Social-proof line under the cards: "Riders who set this get reminders that actually fit."
Auto-advance to 03b on select. Stores ridingFrequency. Reuse A's accent/animation.
```

### 03b — Profiling: What you want to stay on top of (NEW)
```
Design "03b — Stay on top of". Clone the 06 Goals card pattern (same multi-select card +
checkbox component, "Continue" CTA, "N of 5 picked" counter). Headline (Instrument Serif):
"What do you want / to stay on top of?" (italic copper). Why-line: "We'll lead with what
matters most to you." Options (icon + title + desc):
- Never miss a service — reminders before each task is due
- Avoid surprise repair costs — see what's coming and budget for it
- Keep resale value — build a documented service history
- Catch issues early — recalls and common problems for your bike
- Just enjoy the ride — keep it light
≥1 required. This answer sets the EMPHASIS of the Reveal (05) and the paywall value props.
Reuse A's exact styling.
```

### 03c — Profiling: Last service & mileage (NEW)
```
Design "03c — Last service & mileage". Header with progress bar + back chevron (same as A).
Headline (Instrument Serif): "Where does your / plan start?" (italic copper on "plan start?").
Why-line: "So your maintenance plan and costs start from the right place."
Two compact inputs, reusing A's input/chip styles:
1) "Last service" — pill chips (single-select): Just did it · < 3 months · 3–6 months ·
   6–12 months · 1 year+ · Not sure.
2) "Current mileage" — numeric input with unit toggle (km/mi), defaulted from the user's
   profile unit; optional.
Primary copper "Continue →"; small muted "I'm not sure" that proceeds with sensible
defaults. Stores lastServiceDate + currentMileage. Keep it to one short screen — this is
the last question before the bike.
```

### 04L — "Building your plan…" loader (NEW)
```
Design "04L — Building your plan". Reuse 12 Personalizing's pulsing copper ring + sparkle
style, but as a SHORT pre-Reveal loader (the paywall's opening argument). Title:
"Building your plan…". A few Geist Mono status lines tick by with checks:
"Checking recalls for your {Make}…" / "Pulling your OEM service schedule…" /
"Estimating your yearly costs…" / "Finding {Make} riders like you…".
Lasts ~1.5–2.5s (or until personalization is ready), then transitions to 05 Reveal.
IMPORTANT: this is timed to the AI/data fetch budget — if data isn't ready in time, it
still advances to the Reveal showing the static fallback. Premium, anticipatory tone.
```

### 05 — Reveal "Bike Dossier" (MODIFIED — projection-led + AI known-issues)
```
Modify A's "05 — Reveal" — SAME layout, card system, and "Loaded for you" stat tiles;
only the ORDER and one added card change. In A the recall check leads; in B the COST
PROJECTION leads and we add an AI "known issues" card.
Top: "GARAGE UNLOCKED" badge + the bike hero card (unchanged from A).
Order of proofs (staggered FadeInUp), with emphasis biased by the 03b answer:
1) ★ COST PROJECTION (lead): "Your first year: about €420 in scheduled service." with a
   small breakdown line ("mostly an oil service + chain check"). Loss-aversion hook.
2) RECALL CHECK: "0 open recalls on your {Y/M/M} — we'll alert you if that changes."
   (Facts from NHTSA, never AI.)
3) ★ KNOWN ISSUES (AI, NEW card): "3 things {Model} owners watch for" — 3 short hedged
   bullets ("owners commonly report…"). Reuse the stat-tile/list styling. If AI is
   unavailable, hide this card gracefully (do not block).
4) COMMUNITY: "You're 1 of 29 {Make} riders on MotoVault."
Closing why-line (same as A): "Every service you log builds a history worth real money."
Primary "Continue →". One scannable screen; same visual language as A.
```

### 08 — Commitment (MODIFIED — press-and-hold / signature)
```
Modify A's "08 — Commitment" — SAME screen, headline, and bike framing; only the
affirmation CONTROL changes from a single tap to a more effortful, deliberate gesture.
Headline unchanged: "I'm ready to take care / of my {Year} {Make} {Model}." (italic copper).
Replace the 1-tap control with ONE of:
- a press-and-HOLD button "Hold to commit" that fills with copper + haptic over ~1s, or
- a signature line "Sign your name" the user draws on.
On completion: brief confirmation, then advance to the paywall. Slightly higher effort =
stronger commitment (effort justification). Keep everything else identical to A.
Tiny "Not now" at most.
```

### 09 — Paywall (REUSED spec — note the timing/personalization for B)
```
Reuse A's "09 — Paywall" RevenueCat spec unchanged, with two B notes:
- It fires immediately after 08 Commitment, which in B comes right after the projection
  peak (04L → 05 → … → 08) — motivation is highest here.
- Personalize the headline/value-props using B's richer data: bias the value props to the
  03b "stay on top of" answer (e.g. lead with cost-control props for "avoid surprise
  repair costs"), plus {Year Make Model} + projected cost. Same {{custom.*}} mechanism as
  A, just more variables available (concern, projectedYearlyCost, lastService).
```

---

## Reused from Variant A — DO NOT redesign

01 Splash · 02 Welcome (+ Log in) · 03 Experience · 04 Bike (search-first, demoted skip) ·
06 Goals · 07 Maintenance · 10 Account (post-purchase "Secure your subscription") ·
11 Notifications · 12 Personalizing · S1 Sign in · CP Contextual account prompt.
→ Use the exact A frames/components; only the progress bar gains more segments because B
is longer.

---

## Prototype wiring (B)
```
01 → 02 → 03 → 03a (auto) → 03b → 03c → 04 Bike → 04L (auto, ~2s) → 05 Reveal → 06 Goals
→ 07 Maintenance → 08 Commitment (hold/signature) → 09 Paywall:
   purchase → 10 Account ; close/continue-free → 11 Notifications.
10 → 11 → 12 → Home. Welcome "Log in" / Paywall "Already have an account?" → S1 Sign in.
250–300ms push transitions, same as A. Label each connection with its trigger.
```

## AI personalization in B
B carries the AI layer (known-issues card in 05, projection narrative, personalized paywall
props). Reuse the precompute-cache + Claude→Gemini/OpenAI→static fallback from
`onboarding-abc-test-plan.md` (Part 2): cache by Year/Make/Model; tight ≤2s timeout behind
the 04L loader; **facts (recalls/specs/intervals) always from authoritative APIs, never the
LLM**; hide any AI card gracefully if unavailable so onboarding never breaks.

---

*Keep B visually identical to A on every shared screen. B's only job is to test whether the
extra investment (questions + projection + AI + stronger commitment) lifts trial→paid and
retention vs A's lean flow. If a reviewer can tell A and B apart by styling rather than by
length/content, the variant is wrong.*
