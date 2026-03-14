# PRD: AI Diagnosis Flow v2 — Guided Step-by-Step Redesign

**Author:** Andrej
**Date:** 2026-03-13
**Status:** Draft
**Feature Area:** Diagnose Tab → New Diagnostic

---

## 1. Problem Statement

The current AI diagnosis flow has significant UX gaps that reduce diagnostic accuracy and alienate users at both ends of the skill spectrum.

**For beginners**, the wizard uses technical terms (e.g., "chain_drivetrain", "suspension", "cold_start") with no explanation, every step requires at least one selection (no "I don't know" escape hatch), and the flow silently picks the user's primary bike without confirmation — meaning a beginner diagnosing a friend's bike or a newly acquired second motorcycle gets wrong results with no way to correct it.

**For experienced riders**, the wizard feels patronizing and rigid. There's no way to directly describe a problem in mechanical terms, skip the wizard entirely while still providing structured context, or indicate urgency (e.g., "I'm stranded roadside" vs. "I noticed this during weekend maintenance").

**For all users**, the onboarding data we already collected (experience level, maintenance style, riding frequency, bike mileage, last service date) is not passed to the AI prompt — wasting valuable context that could dramatically improve diagnosis quality and response tone. The photo is mandatory even for issues that are auditory or behavioral (strange noise at 4000 RPM, bike stalls when hot), and the system doesn't ask which bike is being diagnosed when the user has multiple motorcycles in their garage.

**Evidence:** This is a design deviation — the step-by-step guided flow was part of the original product vision but the current implementation shortcuts it into a 3-screen wizard → photo → submit pipeline that skips bike selection, user context, and accessibility for non-technical users.

---

## 2. Goals

**User Goals:**
- A beginner with zero mechanical knowledge can describe a problem using plain language and "I don't know" options, and still receive a useful, jargon-explained diagnosis.
- An experienced rider can provide precise technical context quickly without being slowed down by basic wizard steps.
- Users with multiple bikes can select which bike they're diagnosing, or describe a bike not in their garage.
- The AI produces noticeably better diagnoses by leveraging onboarding profile data (experience level, maintenance habits, bike mileage/age).

**Business Goals:**
- Increase diagnostic submission completion rate by 30% (current drop-off likely happens at wizard steps where users don't know the answer).
- Increase AI diagnosis confidence scores by enriching prompts with user profile context.
- Reduce "not helpful" feedback on diagnosis results by tailoring language to the user's experience level.

---

## 3. Non-Goals

- **Chat-based follow-up diagnosis** — conversational AI follow-ups are a separate initiative. This PRD covers the submission flow only, not post-result interaction.
- **Multi-photo support** — supporting multiple images per diagnostic is valuable but adds significant complexity to the photo stage. Out of scope for v2; design should not block it.
- **Audio/video input** — recording engine sounds or video of the issue is a future consideration, not v2 scope.
- **Community/mechanic routing** — connecting users with verified mechanics or community answers is a separate feature track.
- **Offline diagnosis** — the AI requires network access. Offline caching of previous results is a separate concern.

---

## 4. User Stories

### Bike Selection

- **As a user with multiple bikes**, I want to choose which motorcycle I'm diagnosing so that the AI gets accurate make/model/year/mileage context.
- **As a user diagnosing a bike not in my garage** (friend's bike, new purchase I'm evaluating, rental), I want to describe the bike type and basic info so I can still get a diagnosis without adding it to my garage.
- **As a user with only one bike**, I want the flow to pre-select my bike automatically (with confirmation) so I don't waste time on an obvious choice.

### Experience-Adaptive Wizard

- **As a beginner**, I want to see simple, plain-language descriptions for each wizard option (not just "suspension" but "Suspension — the forks, shocks, or how the bike handles bumps") so I can make informed selections.
- **As a beginner**, I want an "I'm not sure" option on every wizard step so I'm not forced to guess and potentially mislead the AI.
- **As an advanced user**, I want to skip the wizard and provide a free-text technical description instead, so I can communicate precisely without clicking through basic options.
- **As any user**, I want to optionally describe what I was doing when the problem occurred (riding, parked, starting up, after a wash) so the AI has behavioral context.

### Photo & Description

- **As a user with a noise/vibration/behavioral issue**, I want to submit a diagnosis without a photo since my problem isn't visually apparent, and instead provide a detailed text description.
- **As a user with a visible issue**, I want to take or choose a photo and add a description for additional context.

### Urgency & Safety Context

- **As a stranded rider**, I want to indicate that this is urgent so the AI prioritizes safety advice and immediate actionable steps over long-term repair guidance.
- **As a user doing preventive maintenance**, I want to indicate this is not urgent so the AI can give thorough, educational explanations.

### AI Context Enrichment

- **As a user who completed onboarding**, I want the AI to know my experience level, maintenance style, and bike history so it adapts its language (beginner-friendly vs. technical), tool recommendations (basic hand tools vs. specialty tools), and difficulty assessments to my actual capability.

---

## 5. Requirements

### P0 — Must Have (MVP)

#### 5.1 Step-by-Step Flow Architecture

Replace the current `start → wizard → photo → analyzing` stages with a sequential step flow:

```
Step 1: Bike Selection
Step 2: Problem Description (wizard OR free-text)
Step 3: Photo & Details
Step 4: Review & Submit
Step 5: Analyzing (loading → result)
```

Each step has a progress indicator (step X of 4, since step 5 is the processing state). Users can navigate back to any previous step. State is preserved when navigating between steps.

**Acceptance Criteria:**
- [ ] Progress bar shows current step out of total steps
- [ ] Back button on each step returns to previous step with selections preserved
- [ ] Close/cancel button with confirmation if any data has been entered
- [ ] Smooth animated transitions between steps (SlideInRight/SlideOutLeft)

#### 5.2 Step 1 — Bike Selection

**If user has bikes in garage:**
- Show list of user's motorcycles with photo thumbnail, nickname (or make/model), and year
- Pre-select the primary bike (highlighted, not auto-submitted)
- User taps to select a different bike
- "Diagnose a different bike" option at the bottom → opens a mini-form (see below)

**If user has no bikes (edge case — shouldn't happen post-onboarding but handle gracefully):**
- Show the "different bike" mini-form directly

**"Different bike" mini-form** (inline, not a separate screen):
- Bike type selector (cruiser, sportbike, standard, touring, dual-sport, dirt bike, scooter, other) — uses existing `MotorcycleType` enum
- Optional: Year (number input or "I don't know")
- Optional: Make (text input with autocomplete from NHTSA API, or "I don't know")
- Optional: Model (text input, or "I don't know")

**Acceptance Criteria:**
- [ ] User's garage bikes are fetched and displayed with thumbnails
- [ ] Primary bike is pre-selected but requires explicit "Next" tap to proceed
- [ ] "Different bike" option expands inline mini-form
- [ ] Mini-form allows proceeding with just bike type selected (make/model/year optional)
- [ ] "I don't know" is a valid selection for year, make, and model in the mini-form
- [ ] Selected bike data (or manual entry) is passed to subsequent steps and ultimately to the AI prompt

#### 5.3 Step 2 — Problem Description

This step adapts based on the user's experience level (from onboarding `preferences.experienceLevel`).

**All users see two path options at the top:**
- **"Guide me through it"** → Wizard mode (default for beginners)
- **"I'll describe it myself"** → Free-text mode (default for advanced)

The default is pre-selected based on experience level but the user can always switch.

**Wizard Mode (3 sub-steps, same as today but improved):**

Each sub-step (Symptoms → Location → Timing) now includes:
- An **"I'm not sure / I don't know"** chip as the first option, visually distinct (e.g., dashed border, question mark icon)
- Selecting "I don't know" deselects all other options for that sub-step and vice versa
- **Beginner mode:** Each option shows a short subtitle explanation (e.g., "Vibration — unusual shaking you can feel in the handlebars, seat, or pegs")
- **Intermediate/Advanced mode:** Options show label only (current behavior) for faster selection
- All sub-steps allow selecting zero options (via "I don't know") — the "Next" button is always enabled

**Free-text Mode:**
- Large text input (minimum 3 lines visible, max 1000 characters)
- Placeholder text adapts to experience level:
  - Beginner: "Describe what's happening in your own words — for example: 'My bike makes a clicking sound when I turn right'"
  - Advanced: "Describe the issue — include relevant details like RPM range, operating temperature, recent maintenance, specific components"
- Character counter

**Acceptance Criteria:**
- [ ] Two path options shown; default selected based on `experienceLevel`
- [ ] User can switch between wizard and free-text at any time (data in the other mode is preserved)
- [ ] Wizard: "I don't know" option is first in every sub-step
- [ ] Wizard: Selecting "I don't know" clears other selections in that sub-step
- [ ] Wizard: Selecting any specific option clears "I don't know"
- [ ] Wizard: "Next" button is always enabled (zero selections = valid via "I don't know")
- [ ] Wizard (beginner): Each option shows a subtitle explanation
- [ ] Wizard (intermediate/advanced): Options show label only
- [ ] Free-text: Placeholder adapts to experience level
- [ ] Free-text: 1000 character limit with counter

#### 5.4 Step 3 — Photo & Details

Photo is now **optional** but encouraged. The screen should clearly communicate that a photo significantly improves diagnosis accuracy.

**Layout:**
- Encouragement text: "A photo helps us diagnose more accurately" (not "required")
- Two capture buttons: Camera / Gallery (same as current)
- Photo preview with remove button (same as current)
- "Skip photo" text link below the capture buttons (visible only when no photo is selected)
- **Additional description** text input (500 chars) — "Anything else the AI should know?"
- **Urgency selector** (optional): "How urgent is this?"
  - "I'm stranded / can't ride" (critical)
  - "I need to fix this soon" (high)
  - "Just checking / preventive" (low)
  - Default: no selection (treated as medium by AI)

**Acceptance Criteria:**
- [ ] Photo is optional — user can proceed without one
- [ ] "Skip photo" link is visible when no photo is attached
- [ ] Photo size validation (5 MB max) with clear error message
- [ ] Additional description field (500 chars, optional)
- [ ] Urgency selector with 3 options + no selection default
- [ ] If no photo AND no description AND no wizard answers: show a gentle prompt ("Please provide at least a photo or description so we can help diagnose your issue")

#### 5.5 Step 4 — Review & Submit

Summary screen showing everything the user has provided before submission:

- **Bike:** [Nickname or Make Model Year] with small thumbnail (or "Unknown [Type]" for manual entry)
- **Problem:** Wizard selections summarized as tags, or free-text excerpt (truncated to ~100 chars with "..." and expand)
- **Photo:** Thumbnail if provided, or "No photo" label
- **Details:** Additional description if provided
- **Urgency:** Selected urgency level if any

- "Edit" link on each section → navigates back to that step
- **"Analyze" primary button** at the bottom with the AI sparkle icon
- Data sharing opt-in toggle (same as current, default off)
- Safety disclaimer text (same as current)

**Acceptance Criteria:**
- [ ] All provided data is summarized in a scannable layout
- [ ] Each section has an "Edit" action that navigates to the relevant step
- [ ] "Analyze" button triggers submission
- [ ] Minimum data validation: at least one of (photo, description, wizard answers with at least one non-"I don't know" selection) must be present
- [ ] Data sharing toggle present with current default behavior

#### 5.6 AI Prompt Enrichment with User Profile

The API's `diagnostic-ai.service.ts` system prompt and user prompt must be enhanced to include:

**From user preferences (fetched server-side):**
- `experienceLevel` → Adjusts AI response language: beginner gets jargon-free explanations with analogies; advanced gets precise technical language
- `maintenanceStyle` → DIY: AI emphasizes self-repair steps and tool lists. Mechanic: AI emphasizes what to tell the mechanic and what to expect cost-wise. Sometimes: balanced.
- `ridingFrequency` → Context for wear-and-tear likelihood
- `annualRepairSpend` → Context for cost sensitivity in recommendations

**From selected motorcycle (fetched server-side):**
- `currentMileage` + `mileageUnit` → High-mileage context affects diagnosis probability (e.g., 50k miles = more likely worn chain)
- `engineCc` → Engine size context
- `type` → Motorcycle category affects common issues

**From the diagnosis submission:**
- Urgency level → Affects response priority ordering (safety-first for urgent)
- Whether photo was provided → If no photo, AI should note reduced confidence and ask follow-up suggestions for what to photograph

**Acceptance Criteria:**
- [ ] System prompt includes dynamic sections based on user experience level
- [ ] User prompt includes motorcycle mileage, engine CC, and type
- [ ] User prompt includes urgency context when provided
- [ ] AI response language demonstrably adapts to experience level (beginner vs. advanced)
- [ ] `maintenanceStyle` influences whether next steps emphasize DIY or mechanic visit

#### 5.7 Updated Zod Schemas & GraphQL

Update `SubmitDiagnosticSchema` to support:
- `motorcycleId` becomes optional (nullable when diagnosing a non-garage bike)
- New field: `manualBikeInfo` (object with `type`, optional `year`, optional `make`, optional `model`) — used when no `motorcycleId`
- `photoBase64` becomes optional (nullable)
- New field: `freeTextDescription` (string, max 1000) — separate from the short `description`
- New field: `urgency` (enum: `stranded`, `soon`, `preventive`, or null)
- `wizardAnswers` values can now be `"dont_know"` as a valid entry
- New field: `inputMode` (`wizard` | `freetext`) — tells the API which path the user took

**Acceptance Criteria:**
- [ ] Schema validates all new fields with proper constraints
- [ ] At least one of `photoBase64`, `freeTextDescription`, or non-empty `wizardAnswers` must be present (custom Zod refinement)
- [ ] Either `motorcycleId` or `manualBikeInfo.type` must be present
- [ ] GraphQL input type updated to match
- [ ] Existing diagnostics (v1) continue to work — backward compatible

---

### P1 — Nice to Have (Fast Follow)

#### 5.8 Contextual Tips During Wizard

Show a small tip card below the wizard options based on the current step, e.g.:
- Symptoms step: "Tip: Try to notice if the issue changes when the engine is cold vs. warm"
- Location step: "Tip: If you're not sure where the sound comes from, try having someone else listen while you rev the engine"

#### 5.9 Recent Diagnostics Context

Pass the user's last 2-3 diagnostic results to the AI prompt so it can identify recurring issues or progressive deterioration (e.g., "You reported a similar brake noise 3 months ago — this could indicate the issue has worsened").

#### 5.10 Smart Defaults from Maintenance History

If the user has overdue maintenance tasks for the selected bike, show a subtle hint: "You have overdue maintenance for [task]. Could this be related?" — pre-selecting relevant wizard options.

#### 5.11 Save Draft

Allow users to save an in-progress diagnostic and return to it later (persisted to AsyncStorage with a "Continue draft" card on the diagnosis home screen).

---

### P2 — Future Considerations

- **Multi-photo support:** Allow up to 5 photos per diagnostic with individual descriptions
- **Audio recording:** Record engine sounds for noise-related diagnoses
- **Video capture:** Short video clips (10-15 seconds) for movement-related issues
- **AI follow-up chat:** After receiving a diagnosis, allow the user to ask follow-up questions in a chat interface
- **Mechanic referral:** Based on diagnosis severity and user location, suggest nearby mechanics
- **Diagnostic history trends:** Show progression of issues over time for a specific bike component

---

## 6. Success Metrics

### Leading Indicators (1-4 weeks post-launch)

| Metric | Current Baseline | Target | Stretch | Measurement |
|--------|---------|--------|---------|-------------|
| Diagnostic submission completion rate | Estimate ~60% (start → result) | 75% | 85% | Funnel: step entries vs. successful submissions |
| "I don't know" usage rate | N/A (not available) | 20-35% of wizard submissions use it on ≥1 step | — | Count of submissions where any wizard step = `dont_know` |
| Average AI confidence score | Current mean from DB | +10% relative | +15% | Mean `confidence` field on completed diagnostics |
| Non-garage bike diagnostic submissions | 0 | 5% of total submissions | 10% | Count where `motorcycleId` is null |
| Photo-less submissions (text-only) | 0 | 10-20% of submissions | — | Count where `photoBase64` is null |

### Lagging Indicators (1-3 months post-launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Diagnostic feature retention (users who submit ≥2 diagnostics) | +20% relative | Cohort analysis on diagnostic submissions per user |
| Support/feedback "not helpful" rate on diagnoses | -25% relative | In-app feedback on diagnosis results |
| Free → Pro conversion from diagnosis feature | Track baseline → improve | Users who hit the free-tier limit and convert |

### Evaluation Timeline

- **1 week:** Funnel completion rate, drop-off by step, "I don't know" adoption
- **1 month:** Confidence scores, photo-less submission quality (manual review sample), experience-level adaptation quality
- **1 quarter:** Retention impact, conversion impact, recurring diagnosis patterns

---

## 7. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should we allow diagnosis without ANY bike info (not even type)? Current spec requires at least bike type. | Product | Yes |
| 2 | What is the minimum acceptable AI confidence threshold for photo-less diagnoses? Should we show a stronger disclaimer? | Product + AI | No |
| 3 | Should wizard option subtitles (beginner mode) be static i18n strings or AI-generated? Static is safer and faster. | Engineering | No |
| 4 | Do we need to update the `diagnostics` DB table schema, or can all new fields live in the existing `wizard_answers` JSONB column? | Engineering | Yes |
| 5 | Should the urgency level affect rate limiting? (e.g., stranded users get priority processing) | Product + Engineering | No |
| 6 | How do we handle the case where a user's `experienceLevel` is not set (skipped onboarding partially)? Default to beginner? | Product | No — default to beginner |
| 7 | Should the review step (Step 4) be skippable for power users who want to go directly from photo to analyze? | Design | No |
| 8 | Do we need new migration for `manualBikeInfo` or can it live inside the existing `wizard_answers` JSONB? | Engineering | Yes |

---

## 8. Timeline Considerations

**Dependencies:**
- No external dependencies — all APIs (NHTSA, Anthropic) are already integrated
- Design review needed for new step-by-step UI (particularly the bike selection and review screens)
- i18n strings needed for all new UI text, wizard subtitles (beginner mode), and urgency options (en, es, de)

**Suggested Phasing:**

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| Phase 1 | Steps 1-5 flow architecture + bike selection (5.1, 5.2) | 1 week |
| Phase 2 | Problem description with I don't know + experience adaptation (5.3) | 1 week |
| Phase 3 | Optional photo + urgency + review screen (5.4, 5.5) | 3-4 days |
| Phase 4 | AI prompt enrichment + schema updates (5.6, 5.7) | 3-4 days |
| Phase 5 | Testing, QA, edge cases, i18n | 3-4 days |

**Total estimated:** ~4 weeks for P0 scope

---

## Appendix A: Current vs. Proposed Flow Comparison

### Current Flow (v1)
```
[Start Screen] → "Use Wizard" or "Skip to Photo"
       ↓                        ↓
[Wizard Step 1: Symptoms]       |
[Wizard Step 2: Location]      |
[Wizard Step 3: Timing]        |
       ↓                       ↓
[Photo Screen (required)] ← ← ←
       ↓
[Analyzing → Result]
```

**Issues:** No bike selection. Photo mandatory. No "I don't know." No experience adaptation. No urgency. No profile context in AI prompt. Primary bike auto-selected silently.

### Proposed Flow (v2)
```
[Step 1: Select Bike]
  - My bikes (pre-select primary)
  - "Different bike" → inline mini-form
       ↓
[Step 2: Describe Problem]
  - "Guide me" → Wizard (with "I don't know" + beginner subtitles)
  - "I'll describe it" → Free-text
       ↓
[Step 3: Photo & Details]
  - Photo (optional, encouraged)
  - Additional notes
  - Urgency (optional)
       ↓
[Step 4: Review & Submit]
  - Summary of all input
  - Edit links per section
  - Analyze button
       ↓
[Step 5: Analyzing → Result]
```

---

## Appendix B: AI Prompt Enhancement Example

### Current Prompt (v1)
```
System: You are an expert motorcycle mechanic and diagnostician...

User: Diagnose the issue shown in this photo of a 2019 Honda CBR600RR.
User description: Chain makes noise
Wizard answers:
- symptoms: noise
- location: chain_drivetrain
- timing: acceleration
```

### Proposed Prompt (v2)
```
System: You are an expert motorcycle mechanic and diagnostician.
The user is a BEGINNER rider who SOMETIMES does their own maintenance.
Adapt your language accordingly — explain technical terms, avoid jargon,
and provide clear step-by-step guidance. When recommending tools,
stick to basic hand tools they're likely to own.

User: Diagnose the issue with a 2019 Honda CBR600RR (Sportbike).
Current mileage: 23,450 mi | Engine: 599cc
Last service: 3-6 months ago | Rides: weekly

User description: Chain makes noise

Wizard answers:
- symptoms: noise
- location: chain_drivetrain
- timing: acceleration

Urgency: Just checking / preventive

[Photo attached — or: No photo provided. Note reduced visual confidence
and suggest what the user should photograph for a better diagnosis.]
```

This enriched prompt gives the AI significantly more context to produce a diagnosis that is both more accurate (mileage/service context) and more useful (language/tool adaptation to the user's skill level).
