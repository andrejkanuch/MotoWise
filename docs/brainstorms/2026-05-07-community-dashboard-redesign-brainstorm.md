---
date: 2026-05-07
topic: community-dashboard-redesign
---

# Community Dashboard Redesign

## What We're Building

Redesign the logged-in web experience from three tabs (Feed, Garage, Profile) to two tabs (Garage, Profile) with real, useful data and prominent Pro status treatment.

**Feed is removed.** The ride feed was a social feature that doesn't drive retention on web — riders interact with it on mobile.

**Garage becomes the dashboard.** It surfaces bikes, expenses, maintenance, and saved trips — light management (view + basic actions like logging an expense, marking maintenance done, unsaving a trip). Complex operations stay in the mobile app.

**Pro status is prominent.** Pro users get a distinct visual treatment (banner, nav badge, unlocked sections). Free users see blurred/locked sections with "Upgrade to Pro" overlays — they can see what data exists but need Pro to interact with it fully.

## Why This Approach

- The API already exposes ExpenseDashboard, MaintenanceTasks, SavedTrips queries — no backend work needed
- Read-only dashboards don't drive engagement; light management (log expense, mark done) gives users a reason to return
- Prominent Pro treatment creates natural conversion moments without being aggressive — free users see their data exists but it's gated

## Garage Page — New Sections

### 1. Bikes (existing, enhanced)
- Keep bike cards with photo, make/model/year, mileage, primary badge
- Add: engine CC, type badge
- Add: quick action buttons (functional, not "Coming Soon")
- Pro users: all bikes visible. Free users: first bike visible, rest blurred with "Upgrade" overlay

### 2. Expense Dashboard (new)
- YTD total spend, monthly bar chart, category breakdown (fuel, insurance, parts, gear, etc.)
- Per-bike expense filtering
- "Log Expense" button (opens a simple form)
- Pro-gated: free users see the section with blurred numbers + upgrade CTA

### 3. Maintenance (new)
- Upcoming/overdue tasks with priority badges (critical, high, normal)
- Due date or target mileage indicator
- "Mark Done" button on each task
- Pro-gated: free users see 1-2 tasks, rest blurred

### 4. Saved Trips (replaces broken Saved Routes)
- Grid of saved trip cards (title, country, distance, day count)
- Link to trip detail page
- "Unsave" action
- Available to all users (not Pro-gated)

### 5. Ride Stats Summary (new)
- Total rides, total distance, total duration
- Pulled from GetRiderProfile query
- Available to all users

## Profile Page — Enhancements

- Keep: bio, followers/following, bike list, edit button
- Add: ride stats (total rides, total distance)
- Enhance Pro badge: larger treatment, show plan type (monthly/annual), trial countdown
- Remove: garage section (bikes now live on Garage page only)

## Navigation Changes

- Remove "Feed" tab
- Keep "Garage" and "Profile"
- Add Pro badge/indicator next to user name in nav (crown icon for Pro, "Upgrade" link for free)
- Garage becomes the default landing page after login

## Pro Gating Strategy

| Section | Free | Pro |
|---------|------|-----|
| Bikes | 1 bike visible, rest blurred | All bikes |
| Expense Dashboard | Blurred with upgrade CTA | Full access + log expense |
| Maintenance | 1-2 tasks visible, rest blurred | Full access + mark done |
| Saved Trips | Full access | Full access |
| Ride Stats | Full access | Full access |
| GPX Download | 1/month | Unlimited |

## Key Decisions

- **Feed removed**: Social features belong on mobile, not web
- **Light management over read-only**: Log expense + mark maintenance done give web a purpose
- **Prominent Pro, not aggressive**: Blurred sections with upgrade CTA — user sees their data exists, understands the value
- **Garage = default landing**: After login, users land on their dashboard, not a social feed
- **Saved Routes → Saved Trips**: Align with the routes-to-trips migration already done on API

## Open Questions

- Should "Log Expense" on web be a modal form or a full page?
- Should the nav show a persistent "X days left in trial" banner for trialing users?
- Do we want a "Quick Stats" card at the top of Garage (total bikes, YTD spend, upcoming tasks count)?

## Next Steps

-> `/ce:plan` for implementation details
