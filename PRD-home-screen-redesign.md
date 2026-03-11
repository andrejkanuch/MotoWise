# PRD: Home Screen — The Rider's Command Center

**Author:** Claude (Product Spec)
**Date:** 2026-03-09
**Status:** Draft
**Version:** 1.0
**Related:** [PRD-bike-hub-overview.md](./PRD-bike-hub-overview.md)

---

## 1. Problem Statement

The MotoLearn home screen today is a loosely assembled collection of widgets: a greeting, a rider card, three quick-action buttons, up to 3 maintenance alerts, a horizontal scroll of popular articles, and a "Check your bike" CTA. It's pleasant but *generic* — it looks the same on day 1 as it does on day 100. Nothing reflects the rider's actual journey, riding context, or what they should do *right now*.

The core problem: **the home screen doesn't earn the daily open.** A rider unlocks their phone, sees the same greeting and the same three quick actions, and has no reason to engage unless they're already thinking about maintenance. There's no pull, no "I wonder what's new," no moment where the app surprises them with something useful they didn't expect.

The cost of not solving this: the home screen becomes a pass-through to other tabs rather than a destination. DAU stagnates. The app never becomes a daily habit, which means maintenance tracking lapses, learning content goes unread, and the features that could drive retention and monetization never get a chance to prove their value.

---

## 2. Current State Analysis

### What exists today

| Section | What it shows | Problem |
|---------|--------------|---------|
| **Greeting header** | "Good morning, Andrej" + "Ready to learn?" | Static subtitle — never changes, never contextual |
| **Setup CTA / Rider card** | Profile card with name + primary bike | Useful on first visit, decorative after that — takes prime screen real estate |
| **Quick Actions** (3 buttons) | Take Diagnostic, Learn New, Test Knowledge | Generic — same 3 buttons regardless of user state. "Test Knowledge" routes to Learn (confusing) |
| **Maintenance Alerts** (max 3) | Overdue/upcoming tasks with due dates | Good but too limited — shows max 3, no bike context, no cost, no mileage proximity |
| **Popular Topics** | 6 articles in horizontal scroll | Not personalized — same articles for everyone. No progress context |
| **Check Your Bike CTA** | "AI-powered diagnostics" | Redundant with Quick Actions "Take Diagnostic" button |

### Data already fetched but underutilized
- `MyMotorcyclesDocument` — we know all their bikes, mileage, types
- `AllMaintenanceTasksDocument` — we know every task status, priority, due date
- `MeDocument` with preferences — we know riding style, experience level, maintenance preference (DIY/mechanic), reminder preferences
- Health score computation exists but isn't shown on home

### What's missing
- No sense of **"what's happening with my bikes right now"**
- No **weather or seasonal** awareness (riding season, winterization)
- No **mileage velocity** context (you're riding X km/week, task Y is approaching)
- No **learning progress** tied to their specific bike
- No **spending** visibility (once cost tracking ships per Bike Hub PRD)
- No **personalization** based on bike type, riding style, or experience level
- No **streak or habit** mechanics to drive daily engagement

---

## 3. Goals

| # | Goal | Measure |
|---|------|---------|
| 1 | **Make the home screen the reason riders open the app** — something new/useful every visit | DAU/MAU improves by 20% within 60 days |
| 2 | **Surface the right action at the right time** — reduce cognitive load to find what matters | 60% of home screen sessions lead to a meaningful action (task completion, article read, mileage update) within 30 seconds |
| 3 | **Accelerate time-to-value for new users** — the home screen should feel valuable within the first session | 80% of new users who reach home take at least one action (vs. current baseline) |
| 4 | **Bridge the gap between features** — make learning, diagnostics, and maintenance feel like one experience | Cross-feature usage increases 25% (users who use 2+ features per week) |
| 5 | **Establish a foundation for personalization** — structure the home screen so content can be tailored over time | Architecture supports card-based, reorderable feed by v2 |

---

## 4. Non-Goals

| # | Non-Goal | Why |
|---|----------|-----|
| 1 | Algorithmic feed like social media | Premature — we don't have enough content types yet; a curated structure is better for v1 |
| 2 | Social features (activity feed from other riders) | Different product direction; not validated demand |
| 3 | Full analytics dashboard on home | Too dense for a mobile home screen; the Bike Hub (per separate PRD) handles per-bike analytics |
| 4 | Push notification content mirroring | Notifications are a separate system; home should complement, not duplicate |
| 5 | Widget/card reordering by user | Good P2 idea, but we should learn what the best default order is first |

---

## 5. User Stories

### The Daily Rider (primary persona)
Rides 3-5 times per week, checks phone in the morning or before a ride.

**US-1:** As a daily rider, I want to see a snapshot of all my bikes' health and my most urgent action when I open the app, so I immediately know if anything needs attention.

**US-2:** As a daily rider, I want contextual suggestions based on my riding patterns (mileage, last service, season), so the app feels like it knows me rather than showing generic content.

**US-3:** As a daily rider, I want to quickly update my mileage from the home screen without navigating to a specific bike, so I can keep my data current in 5 seconds.

**US-4:** As a daily rider, I want to see my recent spending trend alongside maintenance alerts, so I can plan financially for upcoming tasks.

**US-5:** As a daily rider, I want learning content recommended based on my bike type and experience level, so I'm reading things that are actually relevant to me.

### The New User (first 7 days)
Just signed up, may or may not have added a bike yet.

**US-6:** As a new user who just added their first bike, I want the home screen to immediately show me what MotoLearn will do for me (health score, scheduled tasks, relevant articles), so I feel the value before I do any work.

**US-7:** As a new user without a bike, I want a clear, compelling guided path to add my first motorcycle, so I understand why it matters and don't bounce.

**US-8:** As a new user, I want to see progress indicators ("3 of 5 setup steps done"), so I feel momentum and complete my profile.

### The Returning User (re-engaging after a break)
Hasn't opened the app in 2+ weeks.

**US-9:** As a returning user, I want a "catch-up" summary of what's changed since my last visit (overdue tasks, mileage reminders, new content), so I can quickly get back on track without feeling lost.

### Edge Cases

**US-10:** As a user with multiple bikes, I want the home screen to show a combined view of all bikes' health — not just my primary bike — so I don't neglect my second motorcycle.

**US-11:** As a user with zero maintenance tasks (all completed), I want the home screen to celebrate that and suggest next actions (add more tasks, learn something, schedule next service), so it doesn't feel empty.

**US-12:** As a user who opens the app at night vs. morning, I want the home screen to adapt (morning = "plan your day" / evening = "log today's ride"), so the experience feels timely.

---

## 6. Requirements

### Must-Have (P0) — The Command Center

#### P0-1: Fleet Health Banner
Replace the current rider profile card with a **Fleet Health Banner** that shows:
- Combined health score across all bikes (weighted average, primary bike counts 1.5x)
- Visual: horizontal bar or ring showing overall fleet health (green/yellow/red)
- Count indicators: "2 bikes · 1 needs attention · 3 tasks upcoming"
- Tap → Garage tab

**Acceptance Criteria:**
- [ ] Shows aggregated health for all user's bikes, not just primary
- [ ] Health score recalculates on every home screen visit (not cached stale)
- [ ] "Needs attention" count = bikes with overdue tasks or health score < 60
- [ ] If user has 1 bike, shows that bike's health directly (no "fleet" language)
- [ ] If user has 0 bikes, shows setup CTA instead (see P0-5)
- [ ] Animates in with FadeInUp on load
- [ ] Tap navigates to Garage tab

#### P0-2: Priority Action Card (The "Do This Now" Card)
A single, prominent card below the fleet banner that shows **the one thing the rider should do right now**, determined by priority logic:

**Priority cascade:**
1. **Overdue critical/high task** → "Your [Bike] needs [Task] — overdue by X days" (red accent)
2. **Task due within 3 days** → "[Task] is due in X days on [Bike]" (orange accent)
3. **Mileage update needed** (>14 days stale) → "Update your odometer — last updated X days ago" (blue accent)
4. **New OEM task populated** → "We added [Task] to your [Bike] based on manufacturer schedule" (green accent)
5. **Learning suggestion** → "Learn about [topic relevant to bike type]" (purple accent)
6. **All clear** → "All caught up! Your bikes are in great shape." (green, celebration micro-animation)

**Acceptance Criteria:**
- [ ] Only ONE action card shows at a time (the highest priority from the cascade)
- [ ] Card has a primary CTA button that navigates directly to the action (e.g., "Complete Task" → task detail)
- [ ] Dismissible with swipe-right (shows next priority item, or "All clear" if none left)
- [ ] Dismissed items don't return for 24 hours (stored in AsyncStorage)
- [ ] Red/orange cards include haptic pulse on iOS
- [ ] Card renders within 300ms of screen mount
- [ ] "All clear" state shows a subtle checkmark animation (Lottie or reanimated)

#### P0-3: Redesigned Maintenance Summary
Replace the current "Maintenance Alerts" (max 3 items) with a smarter summary:

**Section header:** "Maintenance" with count badge + "See all" link

**Content (scrollable list, max 5 visible):**
- Sorted: overdue first (red left border), then by due date proximity, then by priority
- Each row shows: task title, bike name (make/model), due status (relative text), priority badge
- **New:** if cost tracking is available (per Bike Hub PRD), show estimated cost beneath title
- Tap → navigates to that bike's detail screen with task expanded

**Below the list:**
- **Spending mini-stat** (if costs exist): "This month: $125 · This year: $450" — tap → expense detail
- **If no tasks:** "No upcoming maintenance — nice! Add a custom task?" with CTA

**Acceptance Criteria:**
- [ ] Shows tasks across ALL bikes, not just primary
- [ ] Overdue tasks always appear first regardless of other sort criteria
- [ ] Bike name shown alongside each task (critical for multi-bike users)
- [ ] Spending mini-stat only appears if at least 1 completed task has a cost recorded
- [ ] "See all" navigates to Garage tab
- [ ] Empty state suggests adding a custom task with direct link to add-task screen
- [ ] Pull-to-refresh updates this section

#### P0-4: Contextual Quick Actions (Replace Static Buttons)
Replace the current 3 static quick-action buttons with **contextual actions that change based on user state**:

**Default set (user has bikes + completed onboarding):**
1. **Update Mileage** (Gauge icon) → opens mileage update for primary bike (or bike picker if multiple)
2. **Add Task** (Plus icon) → add maintenance task flow
3. **Diagnose** (Camera icon) → diagnostic flow
4. **Learn** (BookOpen icon) → learn tab

**New user set (no bikes or onboarding incomplete):**
1. **Add Bike** (Bike icon) → add bike flow
2. **Explore Learn** (BookOpen icon) → learn tab
3. **Try Diagnostics** (Camera icon) → diagnostic flow

**Acceptance Criteria:**
- [ ] Quick actions adapt based on: hasMotorcycles, onboardingComplete, hasPendingTasks
- [ ] "Update Mileage" shows the primary bike's current reading as subtitle (e.g., "11,240 km")
- [ ] If user has multiple bikes, "Update Mileage" opens a bottom sheet to pick which bike
- [ ] Icons and labels match the design system colors
- [ ] 4 actions in a row (2x2 grid or horizontal scroll) — not 3 as current
- [ ] Staggered FadeInUp animation (50ms delay per item)
- [ ] Haptic feedback on tap (iOS)

#### P0-5: Smart Empty State (New User Experience)
When a user has no bikes (or hasn't completed onboarding), the home screen transforms into an onboarding-focused experience:

**Layout:**
1. **Welcome header:** "Welcome to MotoLearn, [Name]!" with waving hand
2. **Value proposition cards** (vertical stack, 3 cards):
   - "Track your bike's health" — with health ring preview illustration
   - "Never miss maintenance" — with calendar/checklist illustration
   - "Learn from AI-powered content" — with book/sparkle illustration
3. **Primary CTA:** "Add Your First Motorcycle" (full-width gradient button)
4. **Secondary CTA:** "Explore without a bike" → Learn tab

**Acceptance Criteria:**
- [ ] Shows only when user has 0 motorcycles
- [ ] Value cards animate in with staggered delays (100ms apart)
- [ ] Primary CTA routes to add-bike flow
- [ ] After adding first bike, home screen transitions to full layout on next visit
- [ ] "Explore without a bike" routes to Learn tab
- [ ] If onboarding is incomplete, shows onboarding progress indicator at top

#### P0-6: Personalized Learning Section (Replace "Popular Topics")
Replace the generic "Popular Topics" horizontal scroll with a personalized section:

**Section header:** "Recommended for You" (or "Continue Learning" if they've read articles)

**Content selection logic:**
1. If user has read articles → show next articles in the same category/difficulty progression
2. If user has bikes → show articles relevant to their bike type(s) and experience level
3. If user has upcoming maintenance → show how-to articles for those tasks (e.g., "How to Change Oil" if oil change is due)
4. Fallback → show popular articles (current behavior)

**Display:** horizontal scroll of 4-6 cards with:
- Article title (2 lines max)
- Difficulty badge
- "Relevant to: [Bike Make]" tag if matched by bike type
- "Related to: [Task Name]" tag if matched by upcoming maintenance
- Read progress indicator if partially read

**Acceptance Criteria:**
- [ ] At least one personalization signal is used (bike type, experience level, or reading history)
- [ ] Articles tagged with bike relevance show the bike make as a subtitle tag
- [ ] Articles tagged with maintenance relevance show the task name
- [ ] If no personalization data exists, falls back to popular articles (no regression)
- [ ] "View All" navigates to Learn tab with relevant filter pre-applied
- [ ] Cards use same visual style as current article cards (no regression)

#### P0-7: Time-of-Day Awareness
Enhance the greeting and subtitle to be contextually aware:

| Time | Greeting | Subtitle |
|------|----------|----------|
| Morning (5am-12pm) | "Good morning, [Name]" | Dynamic: "[X] tasks this week" or "All clear — enjoy the ride" |
| Afternoon (12pm-5pm) | "Good afternoon, [Name]" | Dynamic: "Back from a ride? Update your mileage" or "[X] tasks upcoming" |
| Evening (5pm-10pm) | "Good evening, [Name]" | Dynamic: "Log today's ride" or "Plan tomorrow's maintenance" |
| Night (10pm-5am) | "Hey, [Name]" | "Planning your next ride?" |

**Acceptance Criteria:**
- [ ] Subtitle changes based on time AND user state (not just time)
- [ ] If overdue tasks exist, subtitle always mentions them regardless of time
- [ ] Uses first name only (already implemented correctly)
- [ ] Subtitle text is max 1 line (truncate with ellipsis if needed)

### Nice-to-Have (P1)

#### P1-1: Riding Streak & Activity Summary
A compact card showing:
- "Active for X days this month" (based on app opens or mileage updates)
- Mini calendar heatmap (current month, days with activity highlighted)
- Monthly mileage total if data available

#### P1-2: Catch-Up Mode for Returning Users
If user hasn't opened the app in 14+ days, overlay a "While you were away..." summary:
- Tasks that became overdue
- Estimated mileage since last update (based on historical velocity)
- New articles published in their areas of interest
- Single "Review All" CTA that marks everything as seen

#### P1-3: Weather-Aware Riding Tips
Based on user locale + season:
- "Wet roads today — check tire tread depth" (rainy forecast)
- "Below freezing tonight — battery check recommended" (winter)
- "Peak riding season — schedule a pre-season checkup" (spring)
- Uses device location + free weather API (no account needed)

#### P1-4: Multi-Bike Quick Switcher
For users with 2+ bikes, a horizontal pill row below the fleet banner:
- Each pill: bike nickname or make/model (truncated)
- Tap a pill → home screen content filters to that bike's data
- "All bikes" pill selected by default

#### P1-5: Weekly Digest Card
Once per week (configurable day), show a digest card:
- Tasks completed this week
- Total spent this week
- Mileage logged
- "Your week in review" header with a summary sentence

#### P1-6: Remove Redundant "Check Your Bike" CTA
The bottom "Check your bike — AI-powered diagnostics" card duplicates the Diagnose quick action. Remove it once contextual quick actions are in place.

### Future Considerations (P2)

#### P2-1: Card-Based Reorderable Feed
Allow users to rearrange home screen sections (maintenance first vs. learning first) to match their priorities.

#### P2-2: Ride Logging Integration
"Start a ride" button that tracks mileage via GPS, then auto-updates odometer when ride ends.

#### P2-3: Community Tips
"Riders with your [Make/Model] recommend..." — crowd-sourced tips from anonymized user data.

#### P2-4: Proactive AI Suggestions
Claude-powered contextual suggestions: "Based on your mileage pattern, you'll hit 12,000 km around March 20 — schedule your chain adjustment now?"

#### P2-5: Home Screen Widgets (iOS/Android)
Glanceable widgets: health score, next task due, mileage — without opening the app.

---

## 7. Information Architecture: Before vs. After

### Current Home Screen (top to bottom)
```
┌─────────────────────────┐
│ Greeting + Avatar        │  ← Static "Ready to learn?"
├─────────────────────────┤
│ Setup CTA / Rider Card   │  ← Decorative after setup
├─────────────────────────┤
│ [Diagnose] [Learn] [Test]│  ← Static, "Test" is confusing
├─────────────────────────┤
│ Maintenance Alerts (3)   │  ← Limited, no cost, single-bike feel
├─────────────────────────┤
│ Popular Topics ──────►   │  ← Generic, not personalized
├─────────────────────────┤
│ Check Your Bike CTA      │  ← Redundant with quick actions
└─────────────────────────┘
```

### Proposed Home Screen (top to bottom)
```
┌─────────────────────────┐
│ Contextual Greeting      │  ← Time + state aware subtitle
├─────────────────────────┤
│ Fleet Health Banner      │  ← All bikes at a glance
├─────────────────────────┤
│ ⚡ Priority Action Card  │  ← THE one thing to do now
├─────────────────────────┤
│ [Mileage][Task][Dx][Learn]│ ← Contextual, state-aware
├─────────────────────────┤
│ Maintenance Summary (5)  │  ← All bikes, sorted by urgency,
│   This month: $125       │    with spending mini-stat
├─────────────────────────┤
│ Recommended for You ───► │  ← Personalized by bike + progress
└─────────────────────────┘
```

**Key changes:**
- Rider card → Fleet Health Banner (useful vs. decorative)
- New: Priority Action Card (drives daily engagement)
- 3 static buttons → 4 contextual actions
- 3 alerts → 5 cross-bike tasks with spending
- Generic articles → personalized recommendations
- Removed: redundant "Check Your Bike" CTA

---

## 8. Data Requirements

### Existing queries (no changes needed)
- `MeDocument` — user profile, preferences
- `MyMotorcyclesDocument` — all bikes
- `AllMaintenanceTasksDocument` — all tasks
- `SearchArticlesDocument` — articles

### New data needed

**1. Last app open timestamp** (for catch-up mode)
- Store in user preferences or device-local AsyncStorage
- Updated on each home screen mount

**2. Article reading history** (for personalization)
- Need a `user_article_reads` table or track in preferences
- Fields: `user_id`, `article_id`, `read_at`, `progress_pct`

**3. Cost data on tasks** (per Bike Hub PRD)
- `maintenance_tasks.cost`, `parts_cost`, `labor_cost` columns
- New query: aggregate spending by month/year

**4. Mileage update timestamp** (for staleness detection)
- `motorcycles.mileage_updated_at` column (per Bike Hub PRD)

### New GraphQL query: `HomeScreenSummary`
Consider a dedicated resolver that returns all home screen data in a single round-trip:
```graphql
query HomeScreenSummary {
  me { fullName, preferences, ... }
  myMotorcycles { id, make, model, year, currentMileage, mileageUpdatedAt, healthScore, ... }
  urgentTasks: allMaintenanceTasks(limit: 5, sort: URGENCY) { ... }
  recommendedArticles: searchArticles(personalized: true, first: 6) { ... }
  spendingSummary { thisMonth, thisYear, allTime }
}
```
This reduces home screen load from 4 parallel queries to 1 (or keeps parallel but adds the new ones).

---

## 9. The "AHA" Moments

1. **First open after adding a bike:** The fleet health banner shows "Your 2019 Honda CB500F — Health: 92%" and the priority card says "Oil change due in 800 km — we'll remind you." The rider didn't configure anything — the app already knows their bike's needs from OEM data.

2. **Morning ritual:** The rider opens MotoLearn with coffee. The greeting says "Good morning, Andrej — 1 task due this week." The priority card shows "Chain adjustment due in 3 days — estimated $35." They tap "Complete" after their Saturday session. The maintenance count ticks down. Satisfying.

3. **"It knows my bike" moment:** The learning section shows "Recommended for You" with an article called "V-twin Engine Winter Storage Tips" because the app knows they ride a cruiser. Not generic motorcycle content — *their* motorcycle content.

4. **Mileage triggers urgency:** They update mileage from the quick action (5 seconds). The priority card instantly changes from "Learn about brake pads" to "Brake pad replacement due at 15,000 km — you're at 14,800 km." The app reacted to their input in real-time.

5. **The catch-up moment:** After a 3-week vacation, they open the app. Instead of the normal home, they see "While you were away: 2 tasks became overdue, estimated 600 km ridden." One tap to review everything. They feel in control again.

6. **The spending awareness moment:** The maintenance section quietly shows "This month: $0 · This year: $280." No judgment, just awareness. When they plan a tire change, they glance at home and think "I've spent $280 so far — tire change will be about $200 — that's fine for the year." The app became their financial gut-check.

---

## 10. Success Metrics

### Leading Indicators (Week 1-2)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Home screen load time | < 800ms (p95) | < 500ms | Performance monitoring |
| Priority card tap-through rate | 40% of sessions | 55% | Event: `priority_card_tapped` |
| Quick action usage | 30% of home sessions | 45% | Event: `quick_action_tapped` |
| Mileage update from home | 20% of home sessions (weekly users) | 30% | Event: `mileage_updated_source=home` |
| Home → meaningful action within 30s | 50% of sessions | 60% | Funnel: home_load → any_action |

### Lagging Indicators (Month 1-3)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| DAU/MAU ratio | +15% vs. baseline | +20% | Analytics |
| Cross-feature usage (2+ features/week) | +20% vs. baseline | +25% | Event combination analysis |
| 7-day retention (new users) | +10% vs. baseline | +15% | Cohort analysis |
| Articles read per user per week | +30% vs. baseline | +50% | Event: `article_read` |
| Maintenance task completion rate | +15% vs. baseline | +25% | DB: completed_at not null |

### Evaluation Schedule
- **Day 3:** Load times, crash rates, priority card render accuracy
- **Week 1:** Tap-through rates, quick action usage distribution
- **Week 4:** DAU/MAU, cross-feature usage, article engagement
- **Week 12:** Retention, NPS, overall engagement trends

---

## 11. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should the Priority Action Card be dismissible, or always visible? Dismissing could reduce engagement but respects user agency. | Product + Design | Yes |
| 2 | How do we measure "personalized article relevance" — do we need a tagging system for articles by bike type? | Product + Engineering | Yes — affects P0-6 |
| 3 | Should the Fleet Health Banner show individual bike scores or just the aggregate? | Design | No |
| 4 | For the `HomeScreenSummary` query — single resolver or keep parallel queries? Single is fewer round-trips but creates a God query. | Engineering | No |
| 5 | Do we track "home screen sessions" as a distinct event, or infer from tab navigation? | Engineering + Data | No |
| 6 | What's the right frequency for mileage staleness alerts — 7 days? 14 days? 30 days? | Product | No |
| 7 | Should we show the spending mini-stat before the Bike Hub PRD ships (it would show $0 for everyone initially)? | Product | Yes — sequencing dependency |
| 8 | Article reading history — new DB table or device-local tracking? DB enables cross-device but adds migration. | Engineering | No — can start local, migrate later |

---

## 12. Timeline & Dependencies

### Dependencies
- **Bike Hub PRD** (cost fields, mileage_updated_at) — P0-3 spending stat and P0-2 mileage staleness depend on these columns existing
- **Article tagging system** — P0-6 personalization requires articles to be tagged with bike types and maintenance categories
- **Design** — new Fleet Health Banner and Priority Action Card need mockups before implementation

### Suggested Phasing

**Phase 1 — Structure Swap (1-2 weeks)**
- P0-1: Fleet Health Banner (replace rider card)
- P0-4: Contextual Quick Actions (replace static buttons)
- P0-7: Time-of-day aware greeting
- P1-6: Remove redundant "Check Your Bike" CTA
- *No backend changes — pure frontend restructure using existing data*

**Phase 2 — Intelligence Layer (2-3 weeks)**
- P0-2: Priority Action Card (new component + priority logic)
- P0-3: Redesigned Maintenance Summary (expanded, cross-bike, sorted)
- P0-5: Smart Empty State
- *Minimal backend — mostly client-side logic using existing queries*

**Phase 3 — Personalization (2-3 weeks)**
- P0-6: Personalized Learning Section
- Depends on: article tagging system, reading history tracking
- *Backend: article tags, user_article_reads table, personalization query*

**Phase 4 — Engagement (P1 items, ongoing)**
- P1-1: Riding streak
- P1-2: Catch-up mode
- P1-3: Weather-aware tips
- P1-4: Multi-bike switcher
- P1-5: Weekly digest

---

## 13. Competitive Context

| Feature | MotoLearn (Current) | MotoLearn (Proposed) | Competitors |
|---------|--------------------|--------------------|-------------|
| Personalized home | No — static layout | Yes — state + time + bike aware | Rare in moto apps |
| Cross-bike overview | No — primary bike only | Yes — fleet health banner | Some (RevZilla, Fuerly) |
| Priority action system | No | Yes — cascading priority logic | None in moto space |
| Contextual quick actions | No — static 3 buttons | Yes — adaptive 4 actions | Very rare |
| Spending visibility on home | No | Yes — mini-stat | Basic in premium apps |
| Content personalization | No — generic popular | Yes — by bike type + progress | None in moto apps |
| Time-of-day adaptation | Partial (greeting only) | Full (greeting + subtitle + actions) | None |
| Empty state onboarding | Basic CTA card | Rich value proposition cards | Moderate |

The proposed home screen would be a genuine differentiator. No motorcycle app currently offers a *contextual, priority-driven* home experience. Most competitors show a static dashboard or a simple task list. The "Priority Action Card" concept — one clear thing to do, adapted to your state — is borrowed from the best consumer apps (Duolingo, Apple Health) but doesn't exist in the moto space.

---

*This PRD is a living document. Update as decisions are made on open questions and as the Bike Hub PRD progresses (shared dependencies on cost fields and mileage tracking).*
