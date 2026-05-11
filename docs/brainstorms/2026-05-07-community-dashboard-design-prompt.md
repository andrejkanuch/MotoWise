# MotoVault Community Dashboard Redesign — Design Prompt

## Context

MotoVault is a motorcycle platform (dark theme, warm amber accents). The logged-in web dashboard currently has 3 tabs: Feed, Garage, Profile. We're redesigning to **2 tabs: Garage (dashboard) and Profile**.

**Design system:** Dark backgrounds (oklch 0.09–0.15), warm amber accent (`oklch(0.76 0.18 60)` / `oklch(0.84 0.15 68)`), 20px border radius, Geist font, neutral-800 borders, neutral-900/50 card backgrounds. Tailwind CSS classes. See `design-system.css` tokens.

**Stack:** Next.js App Router, React, Tailwind CSS, Lucide icons, TanStack Query for data fetching.

---

## What to Design

### 1. Community Navigation Bar

**Current:** Sticky top bar with logo, three links (Feed, Garage, Profile), user name, sign out button.

**New design:**
- Remove "Feed" link — only **Garage** and **Profile** tabs remain
- Garage is the default landing page after login
- Add **Pro badge** next to user display name:
  - Pro users: small crown icon + "Pro" text in warm-400/amber
  - Trialing users: crown + "Trial · Xd left"
  - Free users: subtle "Upgrade" link in neutral-500 that links to `/pro`
- Keep: logo (left), nav links (center), user name + sign out (right)
- Keep: mobile hamburger menu at ≤640px

---

### 2. Garage Page (the main dashboard)

This is the core redesign. The page should feel like a **personal motorcycle dashboard** — not a settings page.

#### Section A: Quick Stats Bar (top of page)
A horizontal row of 3–4 stat cards at the top:
- **Bikes:** count of motorcycles
- **YTD Spend:** total expenses this year (formatted as currency)
- **Upcoming Tasks:** count of pending maintenance items
- **Total Rides:** lifetime ride count

Use compact cards with icon + number + label. Warm amber accent for the numbers.

#### Section B: Motorcycles
Enhanced bike cards showing:
- Bike photo (or placeholder icon), nickname, make/model/year
- Mileage, type badge, purchase date
- "Primary" badge if applicable
- **Functional action buttons** (not disabled "Coming Soon"):
  - "Log Expense" — opens a modal form (fields: amount, category dropdown, date, notes)
  - "View Maintenance" — scrolls to or links to maintenance section for this bike
- If user has multiple bikes, show a bike selector/filter that controls the expense and maintenance sections below

**Pro gating for bikes:**
- Free users: first bike fully visible, additional bikes shown as blurred/frosted cards with a lock icon and "Upgrade to Pro to manage all your bikes" overlay
- Pro users: all bikes fully visible and interactive

#### Section C: Expense Dashboard
A summary card showing:
- **YTD total** (large number, warm amber)
- **Monthly bar chart** — simple horizontal bars for each month (current year), colored by amount relative to max
- **Category breakdown** — list of categories (Fuel, Insurance, Parts, Gear, Service, Other) with amounts and small progress bars
- **Recent expenses** — last 3–5 expense entries with date, category icon, description, amount
- "Log Expense" button (same modal as bike section)

**Pro gating:**
- Free users: section visible but content blurred/frosted with glassmorphism overlay. Show a centered card on top: crown icon, "Unlock Expense Tracking", "Track every dollar spent on your bikes with detailed breakdowns and monthly trends.", "Upgrade to Pro" button (links to `/pro/checkout?redirect=/garage`)
- Pro users: full access, all data visible

#### Section D: Maintenance
A list of maintenance tasks grouped by status:

- **Overdue** (red/danger accent) — tasks past due date or past target mileage
- **Upcoming** (warm amber) — tasks due within 30 days or 500km
- **Scheduled** (neutral) — future tasks

Each task card shows:
- Task name, priority badge (critical/high/normal)
- Due date or target mileage
- Associated bike name
- "Mark Done" button

**Pro gating:**
- Free users: show 1–2 real tasks (if they exist), rest blurred. Same glassmorphism upgrade overlay as expenses: "Unlock Maintenance Tracking", "Never miss an oil change, chain adjustment, or tire swap.", "Upgrade to Pro" button
- Pro users: full list, all actions functional

#### Section E: Saved Trips (replaces broken "Saved Routes")
Grid of saved trip cards (2 columns on desktop, 1 on mobile):
- Trip title, country flag + name, distance, day count, difficulty badge
- Link to trip detail page (`/trips/{country}/{region}/{slug}`)
- "Unsave" heart/bookmark toggle
- Empty state: "No saved trips yet. Explore routes and save your favorites."

**Not Pro-gated** — available to all users.

---

### 3. Profile Page (enhanced)

**Current:** Works fine. Enhance with:

- **Ride stats row** below follower/following stats: Total Rides, Total Distance (km), Member Since
- **Larger Pro badge treatment:** If Pro, show a banner-style element at the top of the profile card: "MotoVault Pro" with crown, plan type (Monthly/Annual), and if trialing "X days remaining"
- **Remove the "Garage" bikes section** from profile (bikes now live on the Garage page)
- Keep everything else (bio, followers, edit button)

---

### 4. Pro Gating Overlay Component

Design a reusable overlay component for blurred/locked sections:

```
┌─────────────────────────────────────────┐
│  ░░░░░░░ blurred content behind ░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                         │
│         👑                              │
│    Unlock [Feature Name]                │
│    [1-line description of value]        │
│                                         │
│    ┌──────────────────┐                 │
│    │  Upgrade to Pro  │                 │
│    └──────────────────┘                 │
│                                         │
│    "From $5.99/month · 7-day free trial"│
│                                         │
└─────────────────────────────────────────┘
```

- Background: the actual section content rendered but with `blur(8px)` + `opacity(0.4)` + `pointer-events: none`
- Overlay: centered card with glassmorphism background, crown icon, feature name, description, CTA button (warm-500 bg), price line
- The CTA links to `/pro/checkout?redirect=/garage`

---

## Visual Reference — Current Pages

### Current Garage Page
- Simple list: saved routes section (broken) + motorcycle cards
- Cards: neutral-900/50 bg, neutral-800 border, 2xl rounded corners
- Disabled "Coming Soon" buttons for maintenance/expenses
- File: `apps/web/src/app/(community)/garage/page.tsx`

### Current Profile Page
- Profile header card with avatar, name, Pro badge (small), username, city, bio
- Follower/following counts
- Simple bike list
- File: `apps/web/src/app/(community)/profile/page.tsx`

### Current Nav
- Sticky top, neutral-950/80 bg, backdrop blur
- Three text links: Feed, Garage, Profile
- Active link: warm-400 color
- File: `apps/web/src/components/community-nav.tsx`

---

## Design Constraints

- Dark theme only (no light mode)
- Use existing Tailwind classes: `bg-neutral-900/50`, `border-neutral-800`, `text-warm-400`, `rounded-2xl`
- Icons: Lucide React (`Crown`, `Wrench`, `CircleDollarSign`, `Gauge`, `Bike`, `Calendar`, `MapPin`, `Route`, `CheckCircle2`, `AlertTriangle`, `Lock`)
- Mobile responsive: stack to single column below `sm:` breakpoint
- Cards use `border border-neutral-800 bg-neutral-900/50 rounded-2xl`
- Accent color for highlights: warm-400/warm-500 (amber)
- Danger color for overdue items: `text-red-400`, `bg-red-500/10`
- Success color for completed: `text-green-400`, `bg-green-500/10`
- Keep the same editorial, minimal feel as the trip detail pages

---

## Data Shape (for realistic mockup content)

```
Bikes: [
  { nickname: "Black Mamba", make: "Ducati", model: "Monster 821", year: 2022, mileage: 12450, type: "naked", isPrimary: true, photo: exists },
  { nickname: null, make: "BMW", model: "R 1250 GS", year: 2024, mileage: 3200, type: "adventure", isPrimary: false, photo: null },
]

Expenses (YTD): $2,847
  - Fuel: $890
  - Insurance: $780
  - Parts: $520
  - Service: $420
  - Gear: $237

Maintenance:
  - "Oil Change" — overdue, was due May 1
  - "Chain Adjustment" — upcoming, due May 15, at 13000 km
  - "Tire Replacement (Front)" — scheduled, due July 2025

Saved Trips:
  - "Dalton Highway — Fairbanks to the Arctic Ocean" — US/AK, 666 km, 3 days, Expert
  - "Route 66 — Chicago to Santa Monica" — US/IL, 3940 km, 14 days, Intermediate

Ride Stats: 47 rides, 8,420 km total

Pro status: false (for gating preview)
```

---

## Deliverables

1. **Garage page** — full page with all 5 sections (stats bar, bikes, expenses, maintenance, saved trips)
2. **Profile page** — enhanced with ride stats and larger Pro badge
3. **Community nav** — updated with 2 tabs + Pro indicator
4. **Pro gating overlay** — reusable component for blurred sections
5. All in a single `page.tsx` or broken into components as needed
