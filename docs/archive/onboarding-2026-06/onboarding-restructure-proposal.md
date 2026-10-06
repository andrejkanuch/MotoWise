# MotoVault — Onboarding Restructure Proposal

**Author:** Andrej (with Claude)
**Date:** 9 June 2026
**Sources:** Live mobile code (`apps/mobile/src/app/(onboarding)/*`, `config/onboarding.ts`, `stores/onboarding.store.ts`), the 14-screen Figma flow (`MotoVault` file), and Hannah Parvaz / RevenueCat — *"Stop chasing growth hacks — fix your funnel first."*

---

## TL;DR

The motorcycle is MotoVault's **activation keystone** — almost every downstream feature (maintenance plan, specs, recalls, ride/expense personalization, the paywall pitch) only works once a bike exists. Yet today the bike is the **6th meaningful screen**, sitting behind a splash, the value hero, an account wall, an experience question, and a goals question — and **every bike screen offers a prominent, centered "I'll add my bike later."**

That ordering plus the easy escape hatch is why so many users finish onboarding (or abandon it) without a bike. And a bike-less user doesn't just miss one feature — they cascade into a dead maintenance step, a de-personalized paywall, and a generic "personalizing" payoff.

**The fix is not "fewer screens." It's three moves:**
1. **Move the bike to the first real action** and reframe it from *data entry* into *the unlock*.
2. **Cut the bike step's mechanical friction** (search-first, one field, smart defaults) and **demote the skip** into a deferred-with-partial-data fallback rather than a one-tap "later."
3. **Pay the bike off immediately** with a real reveal (their garage, specs, recall check, maintenance plan) *before* the paywall, and add a one-tap **commitment moment** right before it.

Everything below maps to principles from the article and to specific files/screens you already have.

---

## 1. What the article tells us to optimize for

The piece is built on one hard number and four levers:

- **~82% of trial starts happen on day zero.** The first ~2 minutes decide almost every subscription. Onboarding *is* the movie, not the trailer.
- **Sell the promise before the proof.** Users judge what the app *feels like it will be*, not what it does. Belief is built in the first few screens.
- **Commitment psychology converts.** Flo's "I'm ready," Duolingo's pledge, QUITTR's signature — a small voluntary micro-commitment before the paywall lifts both conversion and retention (the sustainability-app example doubled day-30 retention from a single commitment tap).
- **Effort justification is real — invested onboarding converts *better*, not worse.** QUITTR: "the longer users spend in onboarding, the higher the likelihood they convert… they want a return for the time they invested." So the goal is *meaningful* investment, not a stripped flow.
- **The four mistakes to avoid:** burying value behind too many steps, feature overload, internal/brand jargon, and skipping emotion.

The tension to design around: **don't strip the flow, but don't bury the keystone either.** Keep the emotional, identity-building steps — just put the highest-value action early, make it feel like an investment rather than a form, and reward it before asking for money.

---

## 1b. Evidence (short)

The recommendation is backed by published data and frameworks (full annotated list in `onboarding-research-reading-list.md`):

- **~82% of subscription trials start on day zero** — the first session sets the ceiling on conversion. *(RevenueCat, State of Subscription Apps 2025.)*
- **Onboarding + trial is the highest-converting setup (~1.78% install-to-paid)**, and top-decile apps convert installs→trials at 2–3× the median — so the day-0 flow is where the leverage is. *(RevenueCat / Adapty benchmarks.)*
- **Timing beats paywall design:** `conversion = (motivation × trust) ÷ friction`; a simple paywall shown at the motivation peak beats a polished one shown too early. The winning sequence is JTBD → micro-commitments → one personalized aha → paywall → personalize the paywall with onboarding data. *(Airbridge, "App Onboarding Before the Paywall.")*
- **It's not "fewer screens":** Lose It! and Noom *lengthened* onboarding and trial-start rates rose, because invested effort + a personalized payoff before the paywall builds belief. Our fix is order and framing, not stripping steps. *(RevenueCat, "Why your onboarding might be too short.")*
- **A single commitment screen is high-leverage and cheap:** a one-tap pledge (Flo "I'm ready," Duolingo, QUITTR) reliably lifts conversion/retention via Cialdini's commitment-and-consistency effect. *(RevenueCat funnel article; Cialdini, *Influence*.)*
- **Onboarding is justified here specifically because MotoVault is tailored to the user's context (their bike)** — one of NN/g's few valid reasons to onboard — provided each step explains its "why" and stays skippable. *(Nielsen Norman Group.)*
- **Reduce signup friction / collect data progressively:** ~86% abandon overly long forms; cutting fields can lift conversion materially, and heavy asks should come *after* value. *(Auth0 / Descope progressive-profiling guidance.)*

---

## 2. Current flow (as built + as designed)

Order verified from `ONBOARDING_SCREENS` in `config/onboarding.ts` and the Figma sequence (left→right). Surfaces marked ⚠️ are where bikes leak.

| # | Surface | File / Figma | Notes |
|---|---------|--------------|-------|
| 1–2 | Splash (animated MW logo, "Every bike has a story") | Figma img 6–7 | Brand moment |
| 3 | **Welcome hero** — "Your rides. Your bike. Your journey." → *Let's get started* | `(onboarding)/index.tsx` / img 1 | Strong promise screen ✅ |
| 4 | **Auth wall** — Continue with Apple / Google / email | `(auth)/index.tsx` / img 14 | ⚠️ Account wall *before any value* |
| 5 | **Experience** — "How long have you been riding?" (1 tap, auto-advances) | `experience.tsx` / img 5 | Low friction, good identity prime ✅ |
| 6 | **Goals** — "What do you want from MotoVault?" (multi-select, ≥1 required) | `goals.tsx` / img 8 | Sets paywall placement |
| 7 | **Bike setup** — year → make grid → brand hero → model (optional) | `bike-setup.tsx` / img 9, 2, 3, 4 | ⚠️ **Keystone, buried at #7, multi-field, with "I'll add my bike later" on every state** |
| 8 | **Maintenance plan** — swipe-to-build, then "N tasks on your radar" | `maintenance.tsx` / img 10, 11 | ⚠️ **Auto-skips entirely if no bike** (`if (!make) handleSkipAll()`); "Skip — I'll set this up later" |
| 9 | **Paywall** (RevenueCat native) | `paywall.tsx` | ⚠️ Placement from goals; personalization (`{{custom.*}}` make/model/year) **degrades to generic without a bike** |
| 10 | **Notifications** — "Stay on top of your bike's health" | `notifications.tsx` / img 12 | |
| 11 | **Personalizing** — "Setting up your ride" (fake-loading 2.5s) | `personalizing.tsx` / img 13 | Records `has_bike: !!bikeData`; fires `CompleteOnboarding` |
| — | **Home checklist** (post-onboarding) — add-bike deep link | `components/home/onboarding-checklist.tsx` | The current "add it later" safety net |

---

## 3. Diagnosis — why bikes don't get added

**A. The keystone is buried.** A user must clear five screens — including an account wall and two reflective questions — before the single most important action. By the article's math, that's deep into a window where most of the cohort has already decided or dropped.

**B. The bike screen reads as a form, not a payoff.** Year input → make grid → brand hero → model picker is multi-stage data entry. The article's mistake #1 (burying value behind steps) and the "activation as a greedy checklist of forms" warning both apply. The genuinely great parts — the "Loaded for you" stats, *"Welcome to 29 HONDA riders on MotoVault"* social proof — only appear *after* the user has already committed to selecting, so they reward the work instead of pulling the user into it.

**C. The escape hatch is louder than it should be.** "I'll add my bike later" appears centered and underlined on *every* bike sub-screen, and "Skip — I'll set this up later" sits on maintenance. There is no consequence framing, no commitment device — just a frictionless exit at the exact moment that matters most.

**D. Skipping cascades — one skip breaks four screens.** Confirmed in code:
- `maintenance.tsx` auto-skips to the paywall when there's no `make` → the swipe-to-build "aha" never renders.
- `paywall.tsx` passes `bikeMake/Model/Year` into RevenueCat personalization → a skipped bike means weaker `{{custom.*}}` copy → weaker conversion at the exact 82%-of-trials moment.
- `personalizing.tsx` shows the same generic loader and logs `has_bike: false`.
So a skipped bike doesn't cost one feature — it de-personalizes the whole back half of onboarding *and* the paywall.

**E. Value is told, never shown — and the paywall comes before the proof.** The welcome promises and the personalizing screen *claims* setup ("Configuring your dashboard"), but the user never sees a real, populated garage before being asked to pay. The article's whole thesis is that you must build belief first; right now the most belief-building artifact (the bike's real data + maintenance plan) is optional and buried.

**F. The account wall precedes all value.** Auth at screen #4 (Figma) asks for commitment before the user has felt anything. Bike data is held in the Zustand store and only sent at `CompleteOnboarding`, so auth is **not technically required early** — it's a movable wall.

---

## 4. Proposed flow

**Design principle:** keep the emotional/identity steps (they drive effort-justification and commitment), but reorder so the **keystone comes early, feels like an investment, and is paid off before the paywall.** Move the account wall *after* first value.

### Recommended — Option A: "Bike-first, value-led"

```
1.  Splash                      (unchanged — brand)
2.  Welcome hero                (unchanged — sells the promise)
3.  Experience  ·  1 tap        (warm-up + self-identification; lowest-friction commitment)
4.  ★ BIKE — the hero action    (moved up; search-first; reframed as "unlock", not a form)
5.  ★ REVEAL — "Your garage"    (NEW/repurposed: specs + "N riders on this" + recall check
                                  + maintenance-plan preview — the aha that justifies step 4)
6.  Goals                       (now "tune your dashboard" for a real bike; still before paywall
                                  because it drives placement)
7.  Maintenance plan            (swipe-to-build — now always populated)
8.  ★ COMMITMENT  ·  1 tap      (NEW: "I'm ready to take care of my {Year Make Model}")
9.  Paywall (native)            (fired right after value + commitment; fully personalized)
10. Auth wall                   (MOVED later — sign in to save your garage, after value is felt)
11. Notifications
12. Personalizing → Home
```

Why this order:
- **Experience stays first** — it's a single tap that auto-advances and primes identity ("I'm a seasoned rider"), exactly the self-identification lever, at near-zero friction.
- **Bike at #4** makes the keystone the first thing of substance, while the user still has momentum.
- **Reveal at #5** turns the bike from a cost into a payoff and earns belief *before* the paywall — and it reuses assets you've already designed (the "Loaded for you" stats block, social proof, the maintenance summary).
- **Commitment at #8** is the Flo/Duolingo/QUITTR move, made concrete with the user's actual bike.
- **Auth at #10** removes the early wall; the ask becomes "save the garage you just built," which is far easier to say yes to. *(Bigger change — ship behind a flag; see §7.)*

### Option B: "Lower-risk reorder" (if deferring auth is too costly now)

Keep auth where it is, but still (a) move the bike ahead of goals, (b) demote the skip, (c) add the reveal, and (d) add the commitment screen before the paywall. This captures most of the upside without touching the auth/persistence model.

```
Splash → Welcome → Auth → Experience → ★Bike → ★Reveal → Goals → Maintenance → ★Commitment → Paywall → Notifications → Personalizing → Home
```

---

## 5. The bike-add fix (the core change)

This is where most of the activation gain lives. Four mechanisms:

**1. Reframe the screen from "form" to "find your bike."** Lead with a single search-first field — *"Start typing your bike — e.g. 'Yamaha MT-07'"* — and collapse year/make/model into progressive disclosure. The make grid (img 9) becomes the fallback for browsers, not the default path. Title shifts from data-collection to unlock language: *"Let's find your bike"* / *"Unlock your bike's history."*

**2. Cut required input to the minimum that still counts.** Require only enough to create a bike (make, ideally model); keep **model optional** (already true in code) and **default the year** (already `currentYear − 3`). Auto-detect type from the model name (already in `detectTypeFromModel`). Persist partial entries so a back-tap never loses work. The bar for `has_bike = true` should be *make-level*, enrichable later.

**3. Demote and redesign the skip.** Replace the prominent centered *"I'll add my bike later"* with a low-emphasis *"Not sure of the details?"* that routes to a **partial-capture** path — "pick from popular bikes" or "just my make" — which still produces a bike record (and `has_bike = true`) rather than `setBikeData(null)`. A true no-bike exit should be a single quiet secondary action at most, with light consequence framing ("Most features stay locked until we know your bike"), not a co-equal CTA on every screen.

**4. Pull the reward forward.** The social proof and stats (*"#1 most popular · 28 riders," "Welcome to 29 HONDA riders on MotoVault," "12,000 km service interval"*) are currently a reward *after* selection. Surface a teaser of that value *as* the incentive — e.g. show live "riders on MotoVault" momentum or a recall-count hook on the search screen — so the pull exists before the tap, per the article's "sell the promise" principle.

**Cascade hardening (code):** in `maintenance.tsx`, if a user still reaches it without a bike, show a generic by-type plan preview instead of silently `handleSkipAll()`-ing to nothing — never let a skip produce an empty back-half.

---

## 6. Paywall & commitment

- **Add a commitment screen before the paywall** (new screen 8). One tap: *"I'm ready to take care of my {Year} {Make} {Model}."* This is the single highest-leverage, lowest-effort addition from the article — it both lifts paywall conversion *and* reinforces the bike as the thing the user is committing to. Use the data you already have in the onboarding store.
- **Keep the paywall on day-0, right after value + commitment.** The 82% stat says don't hide it — but it now fires *after* the reveal and the pledge, with full `{{custom.*}}` personalization (real make/model/year + primary goal), which is materially stronger than today's frequently-generic pitch.
- **Goals stay before the paywall** because `GOAL_TO_PLACEMENT` drives the RevenueCat placement — but reposition them as "tune your dashboard" for the bike you just added, not an abstract preference quiz.

---

## 7. Measurement & experiment plan

Per the article: **measure install→trial and trial→paid separately, count *new paying users* (not % lifts), and change one thing at a time.**

**Activation north star:** `install → bike_added` rate. You already emit the events to build this funnel:
- `ONBOARDING_STARTED`, `ONBOARDING_STEP_VIEWED/COMPLETED/SKIPPED` (with `step`, `step_index`) — gives per-step drop-off.
- `bike_setup` completed vs `ONBOARDING_STEP_SKIPPED { skipped_section: 'bike_setup' }` — the skip rate to beat.
- `ONBOARDING_COMPLETED { has_bike, primary_goal }` — the headline activation metric.
- Join to RevenueCat trial-start and trial→paid, **split by `has_bike`** — this quantifies the cascade and the prize.

**Rollout (PostHog flag — the codebase already references a PostHog feature-flag rollback for v2):**
- **Phase 1 (biggest, safest win):** Move bike ahead of goals + search-first redesign + demote the skip. Measure `install→bike_added` and `install→trial`.
- **Phase 2:** Add the Reveal screen. Measure trial-start lift and trial→paid by `has_bike`.
- **Phase 3:** Add the Commitment screen + paywall reorder. Measure trial→paid.
- **Phase 4 (largest change):** Defer auth to after first value. Measure top-of-funnel completion and account-creation rate. Ship last, behind its own flag.

**Pre-launch:** watch 3–5 real users go through both flows (the article's #1 instruction). Note exactly where they hesitate on the bike step.

---

## 8. Open questions

1. **Auth deferral** — is anonymous onboarding + late sign-in acceptable for the persistence/RLS model? (Bike data already lives client-side until `CompleteOnboarding`, so it looks feasible — needs confirmation.)
2. **Reveal screen** — build new, or extend the existing maintenance "summary" + "Loaded for you" blocks into a standalone garage reveal?
3. **Skip floor** — do we want a true no-bike path at all, or always capture at least a make? My recommendation: always capture *something*.
4. **Figma** — the file is on a Starter plan that rate-limits MCP access; I worked from exported PNGs. If the proposed screens (Reveal, Commitment, search-first Bike) should be mocked up, the fastest path is to keep exporting frames into a connected folder.

---

*Figma note: the live MCP connection to `FIH4y0DJTNRRjKddfbM8bD` is rate-limited on the Starter plan and the sandbox can't download Figma's renders, so the 14 screens were read from local PNG exports. The code remains the authoritative source for the shipping flow; the two agree.*
