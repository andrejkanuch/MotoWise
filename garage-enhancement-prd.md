# PRD: Garage Section Enhancement — "Your Bike, Your Way"

**Author:** MotoVault Product
**Date:** March 8, 2026
**Status:** Draft
**Version:** 1.0

---

## 1. Problem Statement

The MotoVault Garage currently lets riders add their motorcycles and create manual maintenance tasks — but that's where the relationship between the rider and their bike ends in the app. For any motorcycle owner, the garage is the emotional center of ownership. It's where you tinker, plan, worry, remember, and dream. Right now our Garage feels like a to-do list bolted onto a vehicle record.

Riders — from weekend cruisers to daily commuters to track-day junkies — constantly need to answer questions like: "When did I last change my oil?", "How much have I spent on this bike this year?", "What's my tire pressure supposed to be?", "Is my chain due for adjustment?", "What was that weird noise last week?" They currently answer these questions across scattered notebooks, spreadsheets, forum bookmarks, and memory. MotoVault should be the single place a rider goes to *know their bike*.

If we don't solve this, the Garage tab becomes a static record that riders open once (when they add their bike) and rarely revisit — killing retention and making MotoVault feel like a learning app only, not a riding companion.

---

## 2. Goals

**User Goals:**

- **G1:** Riders can track their bike's full lifecycle in one place — from purchase day to every oil change, tire swap, and weekend ride — without needing external spreadsheets or notebooks.
- **G2:** Riders never miss a maintenance interval again. The app proactively tells them what's coming up based on mileage AND time, not just manual reminders.
- **G3:** Riders understand what they're spending on their motorcycle and can make informed decisions (e.g., "Is it time to sell?", "Should I do this repair myself?").
- **G4:** The Garage becomes a daily or weekly touchpoint, not a one-time setup screen.

**Business Goals:**

- **B1:** Increase Garage tab weekly active usage from ~1 visit/user/week to 3+ visits/user/week within 60 days of launch.
- **B2:** Improve D30 retention by 15% — the Garage should be the "sticky" feature that keeps riders coming back.
- **B3:** Lay the data foundation for AI-powered diagnostics (Phase 2 of MotoVault's AI roadmap) by collecting rich per-bike history.

---

## 3. Non-Goals

- **Marketplace / parts purchasing:** We will not build e-commerce or affiliate links to parts stores. (Separate initiative, needs partnerships.)
- **Social features / bike sharing:** No public profiles, no "show off your garage" feed. (Premature — focus on utility first.)
- **GPS ride tracking / route planning:** This is a separate feature area (Rides tab). We may *display* ride summaries in the Garage, but won't build the tracking itself here.
- **Insurance / registration management:** While interesting, handling legal documents adds compliance complexity. (Future consideration.)
- **Dealer/shop integration:** No booking mechanic appointments or syncing with shop systems. (Too fragmented, revisit after scale.)

---

## 4. Feature Areas & User Stories

### 4A. Enriched Bike Profile

*Right now the bike card shows make/model/year and an optional nickname. A rider's relationship with their bike is much richer than that.*

> **As a rider who just bought a 2019 Yamaha MT-07**, I want to fill in my bike's full profile — VIN, engine size, color, purchase date, purchase price, and a photo — so that I have a complete digital record of my motorcycle.

> **As an owner of multiple bikes**, I want each bike card to show a photo I took, the current mileage, and a quick health summary so I can glance at my garage and know the state of each machine.

> **As a new rider who doesn't know their bike's specs**, I want the app to auto-fill technical details (engine CC, weight, fuel capacity, tire sizes) when I enter my make/model/year so I don't have to look them up.

> **As a touring rider**, I want to record my bike's stock and aftermarket modifications (exhaust, windscreen, luggage, suspension) so I have a complete record of what's on my bike — useful for insurance claims, resale, or remembering what I've changed.

**What exists today vs. what's new:**

| Field | DB exists? | Exposed in UI? | New? |
|-------|-----------|----------------|------|
| VIN | Yes (varchar 17) | No | Expose |
| Engine CC | Yes (integer) | No | Expose |
| Purchase date | Yes (date) | No | Expose |
| Photo | Yes (primary_photo_url) | No | Expose |
| Motorcycle type | Yes (enum) | No | Expose |
| Current mileage | Yes (integer) | No | Expose |
| Mileage unit | Yes (mi/km) | No | Expose |
| Color | No | No | New field |
| Purchase price | No | No | New field |
| Weight | No | No | New field |
| Fuel capacity | No | No | New field |
| Stock tire sizes (front/rear) | No | No | New field |
| Modifications list | No | No | New table |

---

### 4B. Odometer / Mileage Tracking

*The `current_mileage` field exists in the DB but is completely invisible to the rider. Mileage is the beating heart of motorcycle maintenance — oil changes, valve adjustments, chain replacements, and tire swaps are ALL mileage-driven.*

> **As a daily commuter**, I want to log my current odometer reading whenever I think of it (weekly, at gas stops, etc.) so the app can estimate my riding pace and predict when maintenance is due.

> **As a rider who just completed a maintenance task**, I want to record the mileage at which I did it so the app can calculate when the next interval is due (e.g., "oil changed at 12,000 mi → next at 16,000 mi").

> **As a casual weekend rider**, I want the app to gently remind me to update my mileage if it's been more than 2 weeks since my last log, without being annoying.

> **As a data-curious rider**, I want to see a simple chart of my mileage over time so I can see my riding patterns (seasonal dips in winter, spikes during road trips).

**Implementation notes:**
- New `mileage_logs` table: `id, motorcycle_id, user_id, mileage, logged_at, source (manual | task_completion | ride_import)`
- `motorcycles.current_mileage` stays as the latest snapshot, updated on each log entry
- Mileage must be monotonically increasing (validate: new entry >= current_mileage)
- Support both miles and kilometers per bike (already in schema as `mileage_unit`)

---

### 4C. Smart Maintenance Schedules (Interval-Based)

*Today, maintenance tasks are fully manual. The rider has to know their intervals, create tasks, and track them. Most riders don't know their intervals — or forget. This is where MotoVault should shine.*

> **As a rider who just added my bike**, I want the app to suggest a default maintenance schedule based on my motorcycle type (e.g., sportbike vs. cruiser) so I have a starting point without reading my entire owner's manual.

> **As a meticulous owner**, I want to customize maintenance intervals (e.g., "oil change every 4,000 mi or 6 months, whichever comes first") so the schedule matches my riding style and the products I use.

> **As a rider who logs mileage regularly**, I want the app to automatically calculate when my next oil change / chain lube / tire replacement is due based on my actual riding pace and the interval I set.

> **As a forgetful rider**, I want to see a clear "Upcoming" panel on my bike's page showing the next 3-5 maintenance items due, sorted by urgency, with estimated dates based on my riding pace.

> **As a new rider who has no idea about maintenance**, I want the app to explain *why* each maintenance item matters (e.g., "Chain tension: A loose chain can skip off the sprocket at speed") so I understand what I'm maintaining and feel confident.

**Concept: Maintenance Templates**

Pre-built schedules by motorcycle type that the user can adopt and customize:

| Task | Sportbike | Cruiser | ADV/Touring | Scooter |
|------|-----------|---------|-------------|---------|
| Oil + filter change | 4,000 mi / 6 mo | 5,000 mi / 6 mo | 6,000 mi / 6 mo | 3,000 mi / 6 mo |
| Chain clean + lube | 500 mi / 2 wk | 1,000 mi / mo | 500 mi / 2 wk | N/A (belt/shaft) |
| Chain tension check | 1,000 mi / mo | 2,000 mi / mo | 1,000 mi / mo | N/A |
| Tire pressure check | 500 mi / wk | 1,000 mi / 2 wk | 500 mi / wk | 500 mi / wk |
| Coolant flush | 12,000 mi / 2 yr | 12,000 mi / 2 yr | 12,000 mi / 2 yr | 12,000 mi / 2 yr |
| Brake fluid flush | 12,000 mi / 2 yr | 12,000 mi / 2 yr | 12,000 mi / 2 yr | 12,000 mi / 2 yr |
| Air filter | 12,000 mi / yr | 12,000 mi / yr | 6,000 mi / yr | 6,000 mi / yr |
| Valve clearance check | 16,000 mi | 16,000 mi | 16,000 mi | 8,000 mi |
| Spark plugs | 12,000 mi | 12,000 mi | 12,000 mi | 6,000 mi |
| Brake pad inspection | 6,000 mi / 6 mo | 6,000 mi / 6 mo | 6,000 mi / 6 mo | 4,000 mi / 6 mo |
| Fork oil / suspension | 20,000 mi / 2 yr | 20,000 mi / 2 yr | 15,000 mi / yr | — |

---

### 4D. Service History / Maintenance Log

*Completing a task today just marks it "done." There's no persistent log of everything you've ever done to the bike. This history is incredibly valuable — for resale, warranty claims, diagnosing recurring issues, and just feeling good about taking care of your machine.*

> **As a rider who's owned my bike for 3 years**, I want to see a chronological timeline of every maintenance action I've performed, with dates, mileage, and notes, so I have a complete service history.

> **As someone selling my motorcycle**, I want to export or share my bike's full service history as a PDF so I can prove to the buyer that the bike was well-maintained.

> **As a rider troubleshooting a problem**, I want to search my history (e.g., "when did I last change the brake fluid?") so I can quickly find relevant past work.

> **As someone who got work done at a shop**, I want to log service done by a mechanic (not just DIY) and optionally attach a photo of the receipt so I have everything in one place.

**Implementation notes:**
- Completed maintenance tasks already have `completed_at` and `completed_mileage` — these form the backbone of the log
- Add: `cost` (decimal), `performed_by` (self | shop), `shop_name` (text, optional), `receipt_photo_url` (text, optional)
- The service history view is essentially a filtered, read-only list of completed tasks sorted by `completed_at DESC`
- Future: AI can analyze service history patterns ("You're changing brake pads more often than average — possible caliper issue?")

---

### 4E. Cost Tracking & Ownership Insights

*Every rider secretly (or not so secretly) wants to know: "How much is this bike costing me?" It's part pride, part financial planning, part justification to their partner.*

> **As a budget-conscious rider**, I want to log the cost of each maintenance task (parts + labor) so I can see my total spending on the bike over time.

> **As an owner considering selling**, I want to see a summary: total cost of ownership (purchase price + all maintenance) vs. estimated current value, so I can make an informed decision.

> **As someone who tracks expenses**, I want a simple breakdown: "This year you've spent $X on maintenance — $Y on parts, $Z on labor" so I understand where my money goes.

> **As a multi-bike owner**, I want to compare costs across my bikes so I can see which one is the money pit.

**Data points (all optional, rider fills in what they care about):**
- Cost per maintenance task (parts cost, labor cost)
- Fuel cost per fill-up (if we add fuel logging — see 4F)
- Annual insurance cost (simple manual entry)
- Purchase price (already planned in 4A)

---

### 4F. Fuel Log (Lightweight)

*Many riders track fuel to monitor consumption patterns. A sudden drop in fuel efficiency can signal mechanical issues (clogged injector, air filter, etc.). This doesn't need to be a full fuel-tracking app — just enough to be useful.*

> **As a touring rider**, I want to log fill-ups (gallons/liters, cost, odometer) so I can track my fuel efficiency over time.

> **As a rider who notices my bike seems thirstier lately**, I want to see my MPG/L per 100km trend so I can spot efficiency drops that might indicate a problem.

> **As a commuter**, I want to know my average fuel cost per month so I can budget.

**Implementation:**
- New `fuel_logs` table: `id, motorcycle_id, user_id, mileage_at_fillup, fuel_amount, fuel_unit (gal | L), cost, is_full_tank (bool), logged_at, notes`
- MPG/L-per-100km calculated between consecutive full-tank fill-ups
- Simple line chart of efficiency over time
- Flag: "Your last 3 fill-ups averaged 35 MPG — down from your usual 42 MPG. Might be worth checking your air filter or tire pressure."

---

### 4G. Bike Documents & Quick Reference

*Every rider has moments where they need a quick spec lookup: "What's my tire pressure?", "What oil weight does my bike take?", "What's the torque spec for my axle nut?" Currently they Google it every single time.*

> **As a rider at the gas station**, I want to quickly look up my recommended tire pressure (front and rear) without Googling it.

> **As a DIY mechanic about to do an oil change**, I want to see my bike's oil type, capacity, and filter part number saved in the app so I know exactly what to buy.

> **As someone who just bought a used bike**, I want to store a photo of my registration, insurance card, and owner's manual cover page so I have quick access on my phone.

> **As a rider preparing for a track day**, I want a quick-reference card with my bike's key specs (weight, power, tire sizes, coolant type) accessible in two taps.

**Concept: "Quick Specs" card on the bike detail page**

| Spec | Example |
|------|---------|
| Oil type + capacity | 10W-40, 3.7 quarts |
| Oil filter part # | HF204 |
| Front tire size | 120/70ZR17 |
| Rear tire size | 180/55ZR17 |
| Tire pressure (front/rear) | 36 / 42 PSI |
| Chain size | 525, 118 links |
| Spark plug | NGK CR9EK |
| Coolant type | Ethylene glycol 50/50 |
| Battery type | YTZ10S |
| Fuel octane (min) | 91 |

These specs can be:
1. Auto-populated from a community database or AI (stretch goal)
2. Manually entered by the rider
3. Crowdsourced — "87% of MT-07 owners use these specs" (future)

**Document storage:**
- New `bike_documents` table: `id, motorcycle_id, user_id, doc_type (registration | insurance | manual | receipt | other), title, photo_url, expiry_date (nullable), notes`
- Simple photo capture + basic metadata
- Insurance/registration can show "expires in 30 days" alerts

---

### 4H. Bike Health Score

*A single number that tells you "your bike is in good shape" or "you've got some overdue items." Gamification meets practical value.*

> **As a rider glancing at my garage**, I want to see a health score (e.g., 85/100) on each bike card so I know at a glance if anything needs attention.

> **As a rider whose health score just dropped**, I want to tap the score and see exactly which overdue or upcoming tasks are dragging it down so I can prioritize.

> **As a competitive person**, I want to keep my health score at 100% because it feels satisfying and I know it means my bike is well-maintained.

**Scoring algorithm (client-side, transparent):**
- Start at 100
- Each overdue task: -5 to -15 points depending on priority (critical=-15, high=-10, medium=-7, low=-5)
- Each task due within 7 days: -2 points
- No mileage log in 30+ days: -5 points
- Bonus: +5 if all tasks are on schedule (max 100)
- Display as a ring/gauge on the bike card with color coding (green 80-100, yellow 60-79, red <60)

---

## 5. Requirements

### Must-Have (P0) — Ships in V1

1. **Expose existing bike fields in UI:** VIN, engine CC, motorcycle type, purchase date, current mileage, mileage unit, photo upload. All fields already exist in the database — this is purely UI + GraphQL exposure work.
   - *Acceptance:* Rider can fill in all fields from the Edit Bike screen. Fields display on the bike detail page.

2. **Odometer logging:** Rider can log current mileage from the bike detail screen. Each log is timestamped. Current mileage updates on the bike card.
   - *Acceptance:* New mileage log entry validates >= previous entry. Mileage displays on the garage list bike cards. Completed tasks record mileage.

3. **Smart maintenance intervals:** Each maintenance task can have a `mileage_interval` and/or `time_interval`. The app calculates "next due" from the last completion.
   - *Acceptance:* Given a task with interval 4,000 mi completed at 12,000 mi, the app shows "Next due: 16,000 mi." Given a task with interval 6 months completed on Jan 1, the app shows "Next due: Jul 1."

4. **Maintenance templates:** Pre-built schedules per motorcycle type. Rider selects their type → template populates tasks with suggested intervals. Rider can customize or delete any.
   - *Acceptance:* At least 4 templates (sportbike, cruiser, ADV, scooter). Rider can adopt a template in ≤3 taps from an empty bike.

5. **Service history timeline:** Completed tasks display as a chronological log with date, mileage, title, and notes.
   - *Acceptance:* Scrollable timeline on the bike detail page. Sortable by date (newest/oldest). Searchable by title.

6. **Cost per task:** Optional cost field (parts + labor) on maintenance tasks. Total spend visible on the service history.
   - *Acceptance:* Rider can enter cost when creating or completing a task. Bike detail shows "Total spent: $X."

7. **Bike health score:** Client-side calculated score displayed on each bike card in the garage list.
   - *Acceptance:* Score visible as a colored ring on each bike card. Tapping shows breakdown.

### Nice-to-Have (P1) — Fast Follow

8. **Quick Specs card:** Manual entry of oil type, tire sizes, tire pressure, battery, chain size, spark plug, etc. Displayed as a quick-reference card on bike detail.
   - *Acceptance:* Card accessible in ≤2 taps from garage. Fields are all optional and persist across sessions.

9. **Fuel logging:** Log fill-ups with amount, cost, mileage. Calculate MPG/efficiency. Show trend chart.
   - *Acceptance:* Efficiency calculated between full-tank fill-ups. Simple line chart renders.

10. **Mileage trend chart:** Visual chart of odometer readings over time on the bike detail page.
    - *Acceptance:* Chart renders with ≥3 data points. Shows riding pace (mi/month).

11. **Modifications tracker:** List of aftermarket parts/mods with name, date installed, cost, and optional notes.
    - *Acceptance:* Rider can add/edit/delete mods. Total mod spend calculated.

12. **Service history PDF export:** Generate a clean PDF of the bike's full history for resale or records.
    - *Acceptance:* PDF includes bike details, all completed tasks with dates/mileage/cost, and total spend.

13. **Mileage-based nudge notifications:** "You haven't logged your mileage in 2 weeks — quick update?" push notification.
    - *Acceptance:* Notification fires if no mileage log in 14 days. Tapping opens the mileage input. Respects notification permissions.

### Future Considerations (P2)

14. **AI-powered diagnostics from service history:** "You're replacing brake pads every 5,000 mi — this is below average. Possible causes: aggressive braking, stuck caliper, or contaminated pads."
15. **Document storage:** Photo capture for registration, insurance, receipts.
16. **Community specs database:** Crowdsourced specs per make/model/year — "92% of MT-07 owners recommend 10W-40."
17. **Multi-bike cost comparison dashboard.**
18. **Integration with OBD-II Bluetooth adapters** for automatic mileage and diagnostic code reading.
19. **Seasonal storage checklist** (battery tender, fuel stabilizer, cover, etc.)
20. **Recall alerts** via NHTSA API by VIN.

---

## 6. Success Metrics

### Leading Indicators (1-4 weeks post-launch)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| Bike profile completion rate (≥5 fields filled) | 40% of bikes | 60% | Query motorcycles table for non-null optional fields |
| Mileage log entries per active rider per week | 1.0 | 2.0 | Count mileage_logs per user per week |
| Maintenance template adoption rate | 50% of new bikes | 70% | % of bikes with ≥1 interval-based task within 24h of creation |
| Cost logging rate (% of completed tasks with cost) | 25% | 40% | completed tasks with cost > 0 / total completed |
| Garage tab visits per user per week | 3.0 | 5.0 | Analytics event tracking |

### Lagging Indicators (1-3 months)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| D30 retention | +15% vs. baseline | +25% | Cohort analysis pre/post launch |
| Health score engagement (% riders who tapped score) | 60% | 80% | Analytics click event on health score |
| Service history entries per bike (at 90 days) | 5.0 | 10.0 | Average completed tasks per bike |
| NPS improvement (Garage-specific) | +10 points | +20 | In-app survey after 30 days |

---

## 7. New Database Objects (Summary)

### New Tables

```
mileage_logs
├── id (UUID, PK)
├── motorcycle_id (UUID, FK → motorcycles)
├── user_id (UUID, FK → users)
├── mileage (INTEGER, NOT NULL)
├── mileage_unit (VARCHAR 2, CHECK 'mi'|'km')
├── source (TEXT, CHECK: manual | task_completion | ride_import)
├── logged_at (TIMESTAMPTZ, default NOW())
└── created_at (TIMESTAMPTZ, default NOW())

fuel_logs (P1)
├── id (UUID, PK)
├── motorcycle_id (UUID, FK → motorcycles)
├── user_id (UUID, FK → users)
├── mileage_at_fillup (INTEGER, NOT NULL)
├── fuel_amount (DECIMAL, NOT NULL)
├── fuel_unit (VARCHAR 3, CHECK: gal | L)
├── cost (DECIMAL, nullable)
├── currency (VARCHAR 3, default 'USD')
├── is_full_tank (BOOLEAN, default true)
├── logged_at (TIMESTAMPTZ, default NOW())
└── notes (TEXT, nullable)

motorcycle_modifications (P1)
├── id (UUID, PK)
├── motorcycle_id (UUID, FK → motorcycles)
├── user_id (UUID, FK → users)
├── name (TEXT, NOT NULL, max 200)
├── category (TEXT: exhaust | suspension | ergonomics | electronics | luggage | protection | cosmetic | performance | other)
├── installed_date (DATE, nullable)
├── cost (DECIMAL, nullable)
├── notes (TEXT, nullable, max 1000)
├── deleted_at (TIMESTAMPTZ, nullable)
└── created_at (TIMESTAMPTZ, default NOW())

motorcycle_specs (P1)
├── id (UUID, PK)
├── motorcycle_id (UUID, FK → motorcycles, UNIQUE)
├── user_id (UUID, FK → users)
├── oil_type (TEXT, nullable)
├── oil_capacity (TEXT, nullable)
├── oil_filter_part (TEXT, nullable)
├── front_tire_size (TEXT, nullable)
├── rear_tire_size (TEXT, nullable)
├── front_tire_pressure (TEXT, nullable)
├── rear_tire_pressure (TEXT, nullable)
├── chain_size (TEXT, nullable)
├── spark_plug (TEXT, nullable)
├── battery_type (TEXT, nullable)
├── coolant_type (TEXT, nullable)
├── fuel_octane_min (INTEGER, nullable)
└── updated_at (TIMESTAMPTZ, auto-updated)
```

### Modified Tables

```
motorcycles (add columns)
├── color (TEXT, nullable)
├── purchase_price (DECIMAL, nullable)
├── currency (VARCHAR 3, default 'USD')
├── weight_kg (DECIMAL, nullable)
├── fuel_capacity_liters (DECIMAL, nullable)

maintenance_tasks (add columns)
├── mileage_interval (INTEGER, nullable) — e.g., 4000
├── time_interval_days (INTEGER, nullable) — e.g., 180
├── is_recurring (BOOLEAN, default false)
├── template_source (TEXT, nullable) — which template it came from
├── cost_parts (DECIMAL, nullable)
├── cost_labor (DECIMAL, nullable)
├── performed_by (TEXT, CHECK: self | shop, nullable)
├── shop_name (TEXT, nullable)
```

---

## 8. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should we build maintenance templates as static JSON in the app or as a server-side table that we can update without app releases? | Engineering | Yes |
| 2 | Do we want to auto-populate specs using the NHTSA VIN decoder API, or is that too unreliable for motorcycle-specific data? | Engineering + Product | No |
| 3 | Should the health score formula be transparent to the user (show the calculation) or just show the score + breakdown of contributing factors? | Design | No |
| 4 | For fuel logging, should we support both gallons and liters (per-bike setting) or force one unit with conversion? | Product | No — follow mileage unit pattern |
| 5 | What's the right "nudge" frequency for mileage logging? 2 weeks feels right for active riders but may annoy seasonal riders. Should this be configurable? | Product + Design | No |
| 6 | Do we need an onboarding flow for the Garage after this expansion? ("Let's set up your bike properly" — guided profile completion) | Design | No, but recommended |
| 7 | Should cost tracking support multiple currencies, or is single-currency (user-selected) sufficient for v1? | Product | No — USD default, configurable later |
| 8 | How should recurring tasks work when completed early or late? Reset from completion date or from the original due date? | Product + Engineering | Yes |

---

## 9. Timeline Considerations

**Phase 1 (P0 — 4-5 weeks):**
Week 1-2: Expose existing DB fields in UI + GraphQL, odometer logging
Week 3-4: Smart intervals, maintenance templates, health score
Week 5: Service history timeline, cost tracking, QA

**Phase 2 (P1 — 3-4 weeks):**
Quick Specs card, fuel logging, mileage chart, modifications tracker

**Phase 3 (P1 continued — 2 weeks):**
PDF export, nudge notifications

**Dependencies:**
- Push notifications (expo-notifications) setup is a prerequisite for mileage nudges
- Photo upload infrastructure (Supabase Storage) needed for bike photos and receipts
- The health score algorithm should be finalized with Design before implementation begins

---

## 10. Rider Perspective: Why This Matters

Talking as a rider — here's what makes me open a motorcycle app every day vs. deleting it after a week:

**I open it when it knows my bike.** Not just make/model/year, but my tire pressure, my oil type, the fact that I installed a fender eliminator last spring. It's *my* bike in there.

**I open it when it saves me from Googling.** Every single time I do maintenance, I Google the same specs. Tire pressure, oil capacity, torque specs. If I can get that in two taps from my garage, that's a win every time.

**I open it when it tells me something I didn't know I needed.** "Your oil change is due in about 400 miles based on your riding pace." That's not a notification I dismiss — that's a notification I act on.

**I open it when it makes me feel like a responsible owner.** That health score at 95% and a clean service history timeline? That's satisfying. That's the same feeling as a clean chain and fresh oil.

**I keep coming back when it holds my motorcycle's story.** Two years from now, I want to scroll through the timeline and see every oil change, every tire swap, the day I installed the slip-on exhaust. That's not data — that's a relationship with my machine.

The Garage shouldn't feel like a database. It should feel like walking into your actual garage, seeing your bike, and knowing exactly what it needs.
