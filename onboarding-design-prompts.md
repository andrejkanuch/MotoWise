# MotoVault Onboarding — Design Prompt Package v2 (auth model resolved)

**Purpose:** Ready-to-paste prompts to design, organize, and **reorder** the onboarding flow in a Claude-powered design tool (Figma Make, Claude artifacts, or a design agent).
**Companions:** `onboarding-restructure-proposal.md` (why) · `onboarding-research-reading-list.md` (evidence) · `auth-and-paywall-timing.md` (the auth/purchase model this version implements).

**What changed from v1 (auth):** Users now go through onboarding **and the paywall anonymously** — no account is required to unlock paid features. The standalone "Auth" screen is replaced by a **post-purchase "Secure your subscription" account screen** (purchasers only), framed as *save & sync*, which aliases the anonymous purchase onto the account (`logIn(supabaseUUID)`). A dedicated **Sign in** screen serves returning users (entered from Welcome and the paywall), and **Restore purchases** is exposed on the paywall. Free (non-purchasing) users are **not** walled — they're asked for an account contextually later.

**How to use:**
1. Paste **Section 1 (Master Prompt)** first.
2. Then paste the **per-screen prompt** (Section 2) for the screen you're generating.
3. Use **Section 3** for prototype wiring, the A/B variant, and accessibility/states.

---

## SECTION 1 — MASTER PROMPT (paste first)

```
You are a senior product designer working on MotoVault, a premium mobile app for
motorcycle riders (iOS-first, dark theme). Design and REORDER the first-run onboarding
flow as high-fidelity mobile screens (390×844 pt iPhone frames) connected into one
prototype, in the order I specify.

═══ PRODUCT CONTEXT ═══
MotoVault manages a rider's whole moto life: maintenance, specs, recalls, ride/expense
logging, routes, diagnostics, learning. The KEYSTONE object is the user's MOTORCYCLE —
almost every feature only works once a bike is added. Core problem: too many users
finish onboarding WITHOUT a bike because the bike step is buried and easily skipped.
Fix: move the bike to the first real action, reframe it as an unlock (not a form),
cut its friction, pay it off with a reveal before the paywall, and add a one-tap
commitment. Keep the emotional/identity steps — do NOT just strip screens.

═══ AUTH / PURCHASE MODEL (critical — read carefully) ═══
- Users complete ALL of onboarding AND the paywall ANONYMOUSLY. An account is NOT
  required to unlock paid features — the subscription binds to the store account +
  RevenueCat's anonymous ID and unlocks the instant they pay.
- The account exists to SAVE & SYNC the subscription and link it to our backend —
  it is a benefit, not a gate. So we ask for it AFTER purchase, framed as protection.
- New purchasers: a "Secure your subscription" account screen appears right AFTER a
  successful purchase (create account → we alias the purchase to it).
- Free users (didn't buy): NO account wall here — they enter the app and are asked
  contextually later.
- Returning users: a dedicated "Sign in" screen, reachable from Welcome ("Log in")
  and from the paywall ("Already have an account?").
- The paywall also exposes "Restore purchases" for reinstalls / new devices.
Never design a screen that blocks already-purchased content behind sign-up.

═══ BRAND & DESIGN SYSTEM (follow exactly) ═══
Personality: Rugged. Premium. Confident. "Forged steel with a leather grip."
Strava/Komoot data-density meets Porsche/BMW companion-app polish. No generic SaaS,
no gamified badges/streaks, no cartoon icons, no cluttered forum look.

Color (dark-first, WARM darks — never cold blue-gray; neutrals carry 2–4% warm tint):
- Background: warm near-black (~#161412).
- Card / elevated surface: warm dark #1E1C19 (subtle transparency, NOT drop shadows).
- Signature "exhaust copper" #D4622E: primary CTAs, active progress, key data, italic display accents.
- Support accents (sparingly, for meaning): trust blue, growth teal, encouragement amber.
- Text: warm white primary; muted warm grays for secondary/labels.

Typography:
- Plus Jakarta Sans — all UI text, buttons, body.
- Instrument Serif — large display headlines; emphasis word set in Instrument Serif
  *Italic* in copper.
- Geist Mono — data/stats and ALL-CAPS eyebrow/label microcopy with wide tracking.

Shape & motion:
- Continuous corner curves everywhere; radii 14–18 pt cards, 16 pt buttons, pill chips.
- Motion under 300ms: FadeIn / FadeInUp / SlideInUp; stagger lists ~50ms each; haptics on tap.
- Thin segmented progress bar at top of steps (filled segments in copper).
- Back affordance: small chevron in a rounded warm-surface circle, top-left.

CTA pattern:
- Primary = full-width copper button, dark text, right-arrow icon.
- Secondary/skip = LOW emphasis (small, muted, single line). Never a co-equal copper
  link centered under the CTA — especially not on the bike step.

═══ THE FLOW (design & connect in THIS order) ═══
1.  Splash — animated MW logo, "Every bike has a story."
2.  Welcome (hero) — "Your rides. Your bike. Your journey." + primary CTA; small "Log in" for returning users.
3.  Experience — "How long have you been riding?" 3 one-tap cards; auto-advances.
4.  ★ Bike (hero action) — search-first "find your bike", reframed as unlock; skip demoted.
5.  ★ Reveal "Your garage" (NEW) — pay off the bike before the paywall.
6.  Goals — "What do you want from MotoVault?" multi-select; "tune your dashboard".
7.  Maintenance plan — swipe-to-build cards, then "N tasks on your radar" summary.
8.  ★ Commitment (NEW) — one-tap pledge tied to the user's actual bike.
9.  Paywall (RevenueCat native — spec) — fires here; exposes "Restore" + "Already have an account?".
10. ★ Account "Secure your subscription" (purchasers only) — create account → alias purchase. Skippable.
11. Notifications — "Stay on top of your bike's health".
12. Personalizing — "Setting up your ride" → Home.
+   Sign in (returning users) — separate screen, entered from Welcome / paywall.
+   Contextual account prompt (free users) — spec, shown later in-app, not in this linear flow.

═══ GLOBAL RULES ═══
- Consistent header (progress bar + back chevron) on steps 3–8 and 11.
- Every data-collection step states a one-line "why".
- Minimize required input; default values; optional secondary fields.
- Personalize copy with prior answers (experience, goal, bike Year/Make/Model).
- Match the established visual language (segmented copper progress, Instrument-Serif-italic
  accent headlines, Geist-Mono eyebrows, brand-letter make tiles, "Loaded for you" stat
  tiles, social-proof line).

═══ OUTPUT ═══
- One frame per screen, named "NN — Screen Name" in flow order (auth screens too:
  "10 — Account (post-purchase)", "S1 — Sign in").
- Show key states inline where noted (empty / selected / filled / loading / error).
- Connect frames into a prototype per the order + branch rules (Section 3).
- Give a one-line rationale per screen tying it to the goal (activation = bike added;
  belief before paywall; account = save & sync, never a gate).

Confirm the plan, then generate the screens. I'll paste per-screen specs next; ask
before inventing copy that conflicts with them.
```

---

## SECTION 2 — PER-SCREEN PROMPTS

Paste the Master Prompt first, then the block for the screen you're working on.

### 01 — Splash
```
Design "01 — Splash". Full-bleed dark motorcycle photo, dimmed. Centered MW logo mark
inside a thin copper ring (subtle draw-on animation), wordmark "Moto Vault" with
"Vault" in copper, and a Geist Mono tagline "EVERY BIKE HAS A STORY". Brief (~1.2s)
auto-transition to Welcome. Pure brand moment, no controls.
```

### 02 — Welcome (hero; add returning-user entry)
```
Design "02 — Welcome". Full-bleed atmospheric rider/motorcycle photo with a bottom dark
gradient veil. Brand mark top-left. NEW: a small, low-emphasis "Log in" text link in the
top-right for returning users (routes to "S1 — Sign in"). Bottom editorial stack:
- Geist Mono eyebrow (copper): "THE RIDER'S COMPANION"
- Instrument Serif headline, 3 lines: "Your rides." / "Your bike." / "Your journey."
  ("Your journey." in Instrument Serif Italic, copper)
- Subtitle (Plus Jakarta Sans, ~80% opacity): "Track rides, manage expenses, discover
  routes — all in one place."
- Primary copper CTA: "Let's get started →"
Enter: FadeInUp staggered on the text stack. Goal: sell the promise; let returning users
peel off to sign in without cluttering the hero.
```

### 03 — Experience (1 tap)
```
Design "03 — Experience". Header: progress bar (segment 1) + back chevron. Geist Mono
eyebrow "TELL US ABOUT YOU". Instrument Serif headline: "How long have you / been riding?"
(italic copper on "been riding?"). Subtitle: "No wrong answer. We'll meet you exactly
where you are." Three selectable cards (icon tile + title + Geist Mono tenure + italic
preview line):
1) Just getting started · 0–6 MONTHS · "We'll keep it simple — gear basics, first-ride checklists, gentle reminders."
2) A few years in the saddle · 1–5 YRS · "You're ready to optimize — track miles, log service, plan that next trip."
3) Seasoned rider · 10+ YRS · POWER MODE · "Everything at your fingertips. Multi-bike, fleet expenses, detailed history."
Selecting shows a brief affirmation then AUTO-ADVANCES to Bike (~1.2s). Subtle animated
background (perspective road lines / tach bars) tinted to the selected accent. One tap only.
```

### 04 — Bike (★ search-first, reframed, friction cut, skip demoted)
```
Design "04 — Bike" — the most important screen. Reframe from data-entry to UNLOCK.
Header: progress bar (segment 2) + back chevron.
Headline (Instrument Serif): "Let's find / your bike." (italic copper on "your bike.").
Why-line: "Unlock your bike's real service data, specs, recalls and history."

PRIMARY PATH = search-first: one prominent search field, placeholder
"Start typing your bike — e.g. 'Yamaha MT-07'". Below it, an incentive teaser BEFORE
selection (Geist Mono): e.g. "12,400 riders on MotoVault • live recall checks", or
rotating popular-bike chips.

Show TWO states inline:
A) EMPTY / BROWSE: search field + fallback grid of popular makes as brand-letter tiles
   (BMW, Honda, Kawasaki, Yamaha, KTM, Suzuki, Triumph, Harley-Davidson) with "#1/#2/#3"
   popularity badges; a compact YEAR field defaulted to (current year − 3); model OPTIONAL.
B) SELECTED (e.g. Honda): brand hero card ("MOST POPULAR · 28 RIDERS", Instrument Serif
   make name, tagline "Built to outlast the road."), a "Loaded for you" row of Geist Mono
   stat tiles ("12,000 km service interval", "28 riders on this", "22 models tracked"),
   a social-proof line "Welcome to 29 HONDA riders on MotoVault.", then an OPTIONAL model
   picker (search + chips). Primary CTA "Continue →".

SKIP RULE: NO prominent centered "I'll add my bike later". Replace with a small, muted,
single-line "Not sure of the details?" → lightweight partial-capture (pick from popular
bikes / "just my make") that STILL creates a bike. "Bike added" counts at make-level;
enrich later. Also include loading + "No matches — add it manually" empty/error states.
This is the activation moment: adding feels like unlocking; skipping feels like missing out.
```

### 05 — Reveal "Your garage" (★ NEW — aha before paywall)
```
Design "05 — Reveal / Your garage" (NEW). Pays off the bike and builds belief BEFORE the
paywall. Header: progress bar (segment 3). Top: "GARAGE UNLOCKED" Geist Mono copper badge.
Hero: the user's bike as a premium card — {Year} {Make} {Model}, brand-color accent, key
specs as Geist Mono stat tiles. Then 3 value proofs (staggered FadeInUp, icon + one line):
  • Recall check — "We checked {Make} recalls for your year — we'll alert you to new ones."
  • Maintenance — "Your OEM service schedule is ready to load."
  • Community — "29 {Make} riders on MotoVault."
Primary CTA "Continue →". No skip. One screen, scannable in ~5s. Make it feel earned and personal.
```

### 06 — Goals (reframe as "tune your dashboard")
```
Design "06 — Goals". Header: progress bar (segment 4) + back chevron.
Headline (Instrument Serif): "What should MotoVault / do for your {Make}?" (italic copper).
Why-line: "Pick all that apply — we'll tailor your dashboard." Multi-select cards
(icon + title + desc + checkbox):
- Track my rides — GPS tracking, stats, ride history
- Manage expenses — fuel, repairs, insurance, total cost of ownership
- Discover routes — find epic roads and plan trips
- Maintain my bike — service reminders, maintenance logs
- Just exploring (italic subtitle)
Bottom: copper "Continue →" + small "N of 5 picked". ≥1 required. (Selection drives paywall
placement/personalization.)
```

### 07 — Maintenance plan (now always populated)
```
Design "07 — Maintenance plan" in two modes. Header: progress bar (segment 5).
Headline: "Your bike's / maintenance plan." (italic copper).
SWIPE MODE: stacked card deck. Top card = task with "CRITICAL"/"OEM" tag, colored icon
tile, Instrument Serif task name (e.g. "Oil & Filter Change"), Geist Mono interval
("Every 6,000 km / 6 mo"), one-line description. Swipe right (add) / left (skip) or tap
round ✓ / ✕. Counter "01 / 10" + progress dots. Demoted secondary "Skip — I'll set this
up later". SUMMARY MODE: "PLAN READY" badge, "N tasks / on your radar." (italic copper),
list of accepted tasks (icon + name + interval), primary "Continue →". Personalize subtitle
("Pre-loaded for {Model} · {Make}").
```

### 08 — Commitment (★ NEW — one-tap pledge)
```
Design "08 — Commitment" (NEW). A calm, emotionally-charged moment right before the
paywall. Header: progress bar (segment 6). Subtly center the user's bike. Headline
(Instrument Serif): "I'm ready to take care / of my {Year} {Make} {Model}." (italic copper
on the bike name). Support line: "Riders who commit here are far more likely to keep their
bike in top shape." ONE primary affirmation control — a single satisfying tap (press-and-
hold "I'm in" with a copper fill + haptic, or a "I'm committing" checkbox). After tap:
brief confirmation, then advance to the paywall. One choice, one screen — not a form.
Tiny "Not now" at most. Converts intent into micro-commitment.
```

### 09 — Paywall (RevenueCat native — spec + add Restore & Sign in)
```
The paywall is presented by RevenueCat (native template) — deliver a SPEC/mock, not a
free-form screen. Requirements:
- Fires immediately after Commitment (motivation peak), on day 0, to an ANONYMOUS user
  (no account required to purchase or unlock).
- Information order: outcome → value → reassurance → price → CTA.
- Personalize the headline via custom variables: e.g. "Keep your {Year} {Make} {Model} in
  peak shape" + reference the primary goal.
- Trust signals matched to the user's goal; clear trial terms; "cancel anytime".
- MUST expose two secondary affordances: "Restore purchases" and "Already have an account?
  Sign in" (→ "S1 — Sign in"). These are low-emphasis text, not competing with the CTA.
- Match brand: warm dark surface, copper primary CTA, Plus Jakarta Sans / Instrument Serif.
Deliver: annotated mock + the list of {{custom.*}} variables to wire in RevenueCat
(bikeYear, bikeMake, bikeModel, primaryGoal, experience).
Branches: purchase success → "10 — Account (post-purchase)". Dismiss/close (continue free)
→ skip account, go to "11 — Notifications".
```

### 10 — Account: "Secure your subscription" (★ post-purchase, purchasers only)
```
Design "10 — Account (post-purchase)" — shown ONLY after a successful purchase. This is
the SAVE & SYNC moment, NOT a gate (the user is already Pro). Header: a "YOU'RE PRO" Geist
Mono copper badge or subtle confirmation tick. Headline (Instrument Serif): "Save your
garage." (or "Secure your / subscription." with italic copper accent). Why-line:
"Create an account to keep your subscription and sync your bike across devices."
Auth options, one-tap-first:
- "Continue with Apple" (primary, white)
- "Continue with Google"
- divider "or use email"
- email + password (collapsed/secondary)
On success, the app calls Purchases.logIn(supabaseUUID) to ALIAS the anonymous purchase
onto the account — design should assume this is automatic; no "restore" needed here.
Include a low-emphasis "Not now" that lets them proceed (still Pro on this device) and be
re-prompted later. Reassurance microcopy: "Your subscription stays active either way."
States: loading (creating account), error (email taken → offer Sign in).
Tone: celebratory + protective, premium — not a form wall.
```

### 11 — Notifications
```
Design "11 — Notifications". Header: progress bar (segment 7). Centered illustration of a
notification card in a soft copper glow. Headline: "Stay on top of your bike's health".
Subtitle: "Get a weekly summary of your rides and a heads-up before service is due."
Three benefit lines (icon + text): maintenance reminders before they're overdue; weekly
ride stats; new routes in your area. Primary copper "Enable Notifications"; secondary
outline "Maybe later".
```

### 12 — Personalizing → Home
```
Design "12 — Personalizing". Centered pulsing copper ring with a sparkle icon. Title
"Setting up your ride". A checklist that ticks off with green checks, staggered:
"Finding routes near you" / "Setting up your garage" / "Configuring your dashboard" /
"Your {primary-goal} dashboard is ready". Auto-completes (~2.5s) → Home. Pure payoff/loader.
```

### S1 — Sign in (returning users)
```
Design "S1 — Sign in" — a standalone screen for RETURNING users, entered from Welcome's
"Log in" link and from the paywall's "Already have an account?". Layout: MW logo,
"Welcome back", subline "Sign in to access your garage on this device."
- "Continue with Apple" (primary white)
- "Continue with Google"
- divider "or continue with email"
- email + password, "Sign In"
- low-emphasis "Restore purchases" (store-account path) for users who subscribed but
  can't recall account details
- footer "New here? Get started" → routes back into onboarding (Welcome/Experience)
On success the app calls Purchases.logIn(supabaseUUID); entitlements follow the identified
customer (so a returning subscriber is immediately Pro). States: loading, error
("No account found — create one?"). Keep minimal and one-tap-first.
```

### CP — Contextual account prompt (free users — spec, shown later in-app)
```
Design "CP — Contextual account prompt" — NOT part of the linear onboarding; a bottom
sheet shown later to FREE (non-purchasing) users at a value-linked moment (e.g. when they
save a ride/expense, or from the home onboarding checklist). Copy ties to the action:
"Save this to your garage. Create a free account so your {ride/expense/bike} is backed up
and synced." Options: Continue with Apple / Google / email; dismissible "Not now". On
success: Purchases.logIn(supabaseUUID). Purpose: get free users to an account without an
early wall — asked exactly when they have something worth saving.
```

---

## SECTION 3 — PROTOTYPE WIRING & VARIANTS

### Wire the prototype + branches
```
Connect frames into one prototype:
- 01 Splash → 02 Welcome (auto). Welcome "Log in" → S1 Sign in. Welcome CTA → 03 Experience.
- 03 Experience auto-advances on selection → 04 Bike.
- 04 Bike "Continue" → 05 Reveal; "Not sure of the details?" → partial-capture → 05 Reveal.
- 05 → 06 Goals → 07 Maintenance (deck complete OR "Skip") → 08 Commitment → 09 Paywall.
- 09 Paywall: PURCHASE SUCCESS → 10 Account (post-purchase); CLOSE/continue-free → 11 Notifications.
- 09 Paywall "Already have an account?" → S1 Sign in. "Restore purchases" → restore action → entitlement state.
- 10 Account: account created OR "Not now" → 11 Notifications.
- 11 → 12 Personalizing → Home.
- S1 Sign in success → Home (returning subscriber) ; "New here?" → 02 Welcome.
Use a consistent 250–300ms push transition; label each connection with its trigger.
```

### A/B variant — auth wall in old position (lower-risk control)
```
Create a second variant that keeps an account wall right after Welcome (before Experience)
and removes the post-purchase Account screen, but keeps every other change (bike moved up,
search-first bike, demoted skip, Reveal, Commitment). Name frames "B-NN — Screen". This is
the control arm to isolate the value-first auth move; everything else identical.
```

### Accessibility & states pass
```
For each interactive screen add: disabled primary CTA until requirements are met; a
selected/active state; loading states where data is fetched (bike search, maintenance plan,
account create/sign-in); empty/error states (bike "No matches — add it manually", auth
"email already in use → Sign in", "no account found → Get started"). Copper-on-dark text
and CTA contrast must meet WCAG AA; min 44×44pt tap targets; respect Dynamic Type.
```

---

## Auth model cheat-sheet (so the designs stay correct)

- Onboarding + paywall are **anonymous**; purchase unlocks paid features with **no account**.
- **Purchasers** → "10 — Account (post-purchase)" framed as *save & sync* (skippable); app calls `logIn(supabaseUUID)` to alias the purchase.
- **Free users** → no wall; "CP — Contextual account prompt" later.
- **Returning users** → "S1 — Sign in" (from Welcome + paywall); `logIn` restores entitlements.
- **Restore purchases** exposed on paywall + sign-in for reinstalls/new devices.
- Never gate already-purchased content behind sign-up.

*(Full rationale and edge cases in `auth-and-paywall-timing.md`.)*
