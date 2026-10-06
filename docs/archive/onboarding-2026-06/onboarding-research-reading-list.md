# Onboarding & High-Conversion Funnels — Annotated Reading List

**Compiled for:** MotoVault onboarding restructure
**Date:** 9 June 2026
**Companion to:** `onboarding-restructure-proposal.md`

This is a curated set of the strongest documentation and articles on app onboarding and conversion, grouped by theme. Each entry has the key takeaways and a **→ MotoVault** note tying it to our restructure. Sources marked ✅ were read in full; others are surfaced and summarized from search.

---

## A. The core thesis: fix the funnel before anything else

**1. RevenueCat — "Stop chasing growth hacks — fix your onboarding funnel first" (Hannah Parvaz)** ✅
https://www.revenuecat.com/blog/growth/fix-onboarding-funnels/
The anchor piece. ~82% of subscription trials start on day zero, so the first ~2 minutes are your biggest growth lever — a 5-point onboarding lift beats the same lift in retention because it applies to every new user. Onboarding *is* the movie, not the trailer: sell the promise before the proof. Commitment screens (Flo's "I'm ready," Duolingo, QUITTR's signature) convert self-reflection into micro-commitment. Four mistakes: burying the paywall, info overload, brand jargon, skipping emotion.
**→ MotoVault:** the whole reason we're reordering. The bike is our keystone and it's buried; the commitment-screen tactic is the cheapest high-leverage add.

**2. Airbridge — "App Onboarding Before the Paywall: 5 Steps That Convert"** ✅
https://www.airbridge.io/en/blog/5-steps-app-onboarding-before-the-paywall
The most directly actionable framework I found. Conversion = (motivation × trust) ÷ friction, and **timing beats design** — a simple paywall at the motivation peak beats a polished one shown too early. The 5-step sequence: (1) capture the job-to-be-done in the first 30s (one goal question), (2) build 2–3 micro-commitments, (3) deliver one personalized aha moment *before* the paywall, (4) time the paywall to the motivation peak (three-check test: intent stated? value seen? does paywall help them move forward?), (5) personalize the paywall with onboarding data (one string match — goal → headline). Use a "building your plan…" loading screen as the paywall's opening argument. Don't stop guiding users after they convert.
**→ MotoVault:** maps almost 1:1 onto our proposed order — Experience/Goals = JTBD, Bike + maintenance swipe = micro-commitments, the Reveal = aha, Commitment screen → Paywall = motivation peak, and we already pass bike+goal into RevenueCat `{{custom.*}}` (step 5).

---

## B. Length & friction: add friction *when it creates value*

**3. RevenueCat — "Why your onboarding experience might be too short" (Peter Meinertzhagen)** ✅
https://www.revenuecat.com/blog/growth/why-your-onboarding-experience-might-be-too-short/
The essential counterweight to "make it shorter." Health & fitness apps (Me+, ~45–50 screens; Noom 100+) keep lengthening onboarding and trial-start rates rise. Lose It! tested simply *adding more questions* "we don't care about the answers" and saw double-digit trial-rate lifts until diminishing returns. Two reasons it works: the *promise* that answers personalize the product, and "science" framing that builds credibility. RISE (sleep): "if we can create more value but it requires more friction, we'll add the friction." Practical tips: give a "why" for every question, progress bars, social proof throughout, vary question styles, show real actionable insight before the paywall (Fitbod's 3-month projection, Noom's goal-date prediction). **Measure Realized LTV per customer, not just trial-start rate.**
**→ MotoVault:** our fix is *not* "fewer screens." Keep Experience + Goals (they personalize and build investment); the problem is *order* and the *form-like* bike step. The "show a projection before the paywall" idea = our Reveal screen (garage + maintenance plan).

**4. Jacob Rushfinn — "The longest onboarding ever" (Noom teardown)** (referenced by #3)
https://www.retention.blog/p/the-longest-onboarding-ever
Deep teardown of Noom's pre-paywall flow: context-for-every-question, progress, social proof, and a personalized projection that makes the paywall feel like a delivery.
**→ MotoVault:** template for framing each question with a "why" and ending on a personalized payoff.

---

## C. Commitment & onboarding psychology

**5. Robert Cialdini — *Influence*, "Commitment & Consistency"**
The academic backbone for #1 and #2: once people take a small, voluntary, public stand, they self-pressure to stay consistent. Self-perception theory (Daryl Bem): people infer identity from their own actions.
**→ MotoVault:** the basis for the Commitment screen — "I'm ready to take care of my {Year Make Model}" turns a setup step into an identity statement.

**6. Growth.Design — onboarding case-study teardowns (Blinkist, Trello, Headspace, Superhuman)**
https://growth.design/case-studies (Blinkist: /case-studies/blinkist-user-onboarding · Headspace JTBD: /case-studies/headspace-user-onboarding)
Visual, panel-by-panel teardowns mapping concrete UI to psychological principles (goal-gradient, endowed progress, peak-end, JTBD). Note: client-rendered comic format — best viewed in a browser.
**→ MotoVault:** reference patterns for the Reveal and Commitment screens; the Headspace JTBD study pairs with our goals→paywall personalization.

**7. Samuel Hulick — UserOnboard teardowns** (Slack, Basecamp, etc.)
https://www.useronboard.com/user-onboarding-teardowns/
The canonical library of long-form teardowns. Core mantra: **"People don't buy products, they buy better versions of themselves."**
**→ MotoVault:** reframe the bike step from "enter your bike" (data entry) to "unlock your bike's history" (better version of the rider's life).

---

## D. Activation & the aha moment

**8. Reforge — activation / growth research** (secondary-sourced)
Activation = % of new users who reach the first real value ("aha"). Reported findings: activation < 30% tends to put CAC above LTV; a ~25% activation lift can correlate with ~34% revenue growth; delivering the aha within ~5 minutes correlates with materially higher 30-day retention. Elena Verna's caution: don't stop at *setup* — measure activation through the first *habit* loop (aha repeated at the desired frequency). Model: **setup → aha → habit.**
**→ MotoVault:** define our activation metric as `install → bike_added` (setup) and then first repeated use of a bike-dependent feature (habit) — not just "finished onboarding."

**9. Appcues — "The aha moment guide" & "activation, the most important pirate metric"**
https://www.appcues.com/blog/aha-moment-guide · https://www.appcues.com/blog/pirate-metric-saas-growth
How to quantitatively locate your aha (correlate early actions with retention) and design the shortest path to it.
**→ MotoVault:** run the analysis on which day-0 action best predicts D7/D30 retention — hypothesis: it's "bike added + ≥1 maintenance item accepted."

**10. June — "Activation playbook"**
https://www.june.so/blog/activation-playbook
Practical guide to defining an activation metric, instrumenting the funnel, and setting targets.
**→ MotoVault:** scaffolding for the measurement section of the proposal (per-step drop-off + has_bike split).

---

## E. UX guardrails (so we don't over-build)

**11. Nielsen Norman Group — "Mobile-App Onboarding: Components & Techniques"** ✅
https://www.nngroup.com/articles/mobile-app-onboarding/
Authoritative UX guidance. Three components: feature promotion, customization, instructions. **Skip onboarding when possible** (it adds interaction cost + memory strain). But onboarding *is* justified in exactly our case: (a) you need info to get started, and (b) **functionality is highly tailored to the user's context** (their dieting-app example = our bike). Customization guidance: keep it brief, explain *why* you ask, allow skip, show a progress indicator (Fitplan example). Avoid front-loading feature-promo decks.
**→ MotoVault:** validates a *content-customization* onboarding (we genuinely need the bike), but warns us to explain "why" on each step and keep instructional fluff out. Our splash + hero are fine; avoid adding tutorial decks.

**12. NN/g — "Onboarding: Skip It When Possible" (video)** & "Mobile Tutorials: Wasted Effort?"
https://www.nngroup.com/videos/onboarding-skip-it-when-possible/ · https://www.nngroup.com/articles/mobile-tutorials/
Tutorials don't improve task performance and are quickly forgotten; prefer contextual help and learnable UI.
**→ MotoVault:** keep the post-onboarding home checklist as *contextual* nudges, not a tutorial.

**13. Apple — Human Interface Guidelines: Onboarding**
https://developer.apple.com/design/human-interface-guidelines/onboarding
"Design a brief, enjoyable experience that doesn't require people to memorize or provide a lot of information." Get people to the content fast; make setup skippable; don't gate the whole app behind it.
**→ MotoVault:** the tension to balance against #3 — resolve it the way the article does: friction is fine *only where it visibly creates value* (the bike), not as generic gating.

---

## F. Signup friction, progressive profiling & delayed registration

**14. Auth0 — "Progressive Profiling"** & Descope — "Progressive Profiling 101"
https://auth0.com/blog/progressive-profiling/ · https://www.descope.com/learn/post/progressive-profiling
Collect data gradually, asking for heavier info only when the user is about to get something they care about. Cited stat: 86% abandon overly long forms; cutting fields 11→4 can lift conversion ~120%. Enable account creation with just email + magic link / OTP.
**→ MotoVault:** supports two moves — (a) require only make (not full year/make/model) to count a bike, enrich later; (b) consider **deferring the auth wall** until after first value, then minimize it (Apple/Google one-tap).

**15. CXL — "Sign-up flows and friction: 3 examples"** & NN/g — power of defaults
https://cxl.com/blog/saas-signup-flows/ · https://www.nngroup.com/articles/the-power-of-defaults/
Allow partial access before requiring an account (NYT-style); people overwhelmingly stick with defaults, so pre-fill aggressively.
**→ MotoVault:** our bike step already defaults the year (currentYear−3) and makes model optional — keep going: search-first, smart defaults, partial-capture fallback instead of a hard skip.

---

## G. Benchmarks & data (for target-setting)

**16. RevenueCat — State of Subscription Apps (2025 & 2026)** ✅ (2025 referenced throughout)
https://www.revenuecat.com/state-of-subscription-apps/ · https://www.revenuecat.com/state-of-subscription-apps-2025/
Source of the 82%-day-0 figure and cross-category trial/conversion benchmarks. Top-decile apps convert installs→trials at 2–3× the median. Onboarding paywalls with a trial show the highest install-to-paid (~1.78% avg).
**→ MotoVault:** use for realistic targets and to segment our funnel by has_bike against category norms.

**17. Airbridge / Adapty — paywall & trial benchmarks** ✅ (in #2) / https://adapty.io/blog/health-fitness-app-subscription-benchmarks/
Onboarding + trial = ~1.78% install-to-conversion (highest setup). Trials of 17–32 days convert ~45.7% trial-to-paid vs ~26.8% for the common 3–7 day trial. Late converters often retain better than day-0 converters → run both onboarding *and* contextual paywalls.
**→ MotoVault:** two experiments beyond the flow reorder — test trial length, and add a contextual paywall for users who skip the day-0 one.

**18. Apphud / Adapty / Appcues — practitioner best-practice guides** (broad surveys)
https://apphud.com/blog/app-onboarding-best-practices · https://adapty.io/blog/mobile-app-onboarding/ · https://www.appcues.com/blog/in-app-onboarding
Good for examples and checklists: value-first, aim for first core action < 60s, personalize by segment (Hotjar's beginner/intermediate/advanced checklist → +26% activation), measure step drop-off, A/B one change at a time.
**→ MotoVault:** the < 60s-to-core-action target reinforces moving the bike early; Hotjar's experience-tiered checklist mirrors our Experience screen.

---

## How this maps to the proposal (one-glance crosswalk)

| Proposal move | Best supporting sources |
|---|---|
| Move bike to first real action | #1, #2 (timing/JTBD), #8 (aha < 5 min), #18 (<60s) |
| Reframe bike as "unlock," not a form | #7 (better version of yourself), #11 (content customization) |
| Cut friction + demote skip + partial capture | #14, #15 (progressive profiling, defaults) |
| Add a Reveal/aha before the paywall | #2 (step 3 + loading screen), #3 (Fitbod/Noom projection) |
| Keep Experience + Goals (don't strip) | #3 (longer can convert), #2 (micro-commitments), #11 |
| Commitment micro-screen before paywall | #1 (Flo/Duolingo/QUITTR), #5 (Cialdini) |
| Personalize the paywall with bike + goal | #2 (step 5, one-string match), #1 |
| Defer/minimize the auth wall | #14, #15, #13 (Apple HIG), #11 |
| Measure has_bike split + LTV, test one thing at a time | #3 (Realized LTV), #9/#10 (activation), #16/#17 (benchmarks) |

---

*Verification note: sources marked ✅ were fetched and read in full (RevenueCat funnel + "too short," Airbridge 5-step, NN/g mobile onboarding, and the State-of-Subscription benchmarks cited within them). The rest are surfaced via search and summarized; Growth.Design renders as an interactive comic and is best opened in a browser. Where a stat is cited (e.g., 82% day-0, 1.78% install-to-paid, 45.7% trial-to-paid for 17–32 day trials), the underlying source is RevenueCat's State of Subscription Apps / Adapty benchmarks as noted.*
