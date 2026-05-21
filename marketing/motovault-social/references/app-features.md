# MotoVault App Features & Screenshot Inventory

## App Overview

MotoVault is the rider's companion app for iOS and Android. One app for your entire moto life: trip planning, ride recording, maintenance tracking, expense analytics, AI diagnostics, route discovery, and learning. Built for motorcycles only.

## 5 Main Tabs

Home · Garage · Diagnose · Learn · Discover

## Features by Area

### Home Dashboard

**What it does**: Personalized greeting ("Today in your garage"), primary bike hero card with ODO, health score (% ready), next service countdown, overdue alerts. Quick actions: Diagnose, Add Task, Expenses, Plan. Bottom section: upcoming tasks, monthly mileage goal with progress bar, last 7 days bar chart, open analytics link. Expense summary (this month vs last month, YTD).

**Key stats**: Most-used entry point. Users check home → expenses → ride history flow.

**Post angles**: "Your bike's command center", "Everything at a glance", "Smart alerts before things break"

### Garage (Bike Management)

**What it does**: Digital garage shelf view with all bikes as cards. Each card shows: make/model/year, ODO, health score %, "since [year]" ownership date. Set primary bike. "By the Numbers" section: total km across fleet, oldest bike, open tasks. Bike detail view: hero photo, full stats, cost/km, ride count, Analytics link, Service Report card.

**Post angles**: "Your bikes, one place", "Fleet at a glance", "Know your bike inside out"

### Maintenance Tracking

**What it does**: Per-bike maintenance with Active/History tabs. Mileage-aware reminders: overdue (red), due-soon, upcoming. Common tasks: oil change, chain lube, tire pressure, brake fluid flush, valve clearance, major service. Task priorities: critical/high/medium/low. Health score algorithm: 50% overdue weight, 25% urgency, 25% completion rate. Service reports. OEM schedule import via NHTSA.

**Analytics insight**: Health report views growing week-over-week. Good "save this" content.

**Post angles**: "Never miss a service", "Your bike's health report card", "Mileage-based reminders that actually work"

### Expense Tracking & Analytics

**What it does**: Log expenses by category (fuel, service, parts, tires, gear, insurance, mods, training, registration, tolls/parking). Expense Insights dashboard: all-time total, category breakdown (color-coded bar), total cost of ownership (bike price + all expenses), avg/month, entry count, cost/km or cost/mile. Monthly trend stacked bar chart. Per-bike breakdown.

**Analytics insight**: Expense dashboard is the single most-viewed screen in the app. Users check spending more than they log — the feature is sticky.

**Post angles**: "Where does your bike money go?", "Cost-per-km tracking", "Total cost of ownership — the number you've been avoiding"

### Trip Planning

**What it does**: Multi-day trip planner with drag-and-drop waypoints. Typed waypoints: fuel, scenic, overnight, pass summit, food, camera. Day-by-day itinerary with morning/afternoon/evening sections. Difficulty: Easy/Moderate/Challenging/Expert. Visibility: Private/Link only/Public. GPX export. Clone trip. Share via link. Draft → Publish workflow. Max riders setting for group trips.

**Analytics insight**: Trip planning is aspirational content that performs well visually on social.

**Post angles**: "Plan your next multi-day ride", "Waypoint by waypoint", "Share your route — GPX or link"

### Route Discovery (Discover Tab)

**What it does**: Map with nearby routes, search bar, country/region chips. Filter by: Popular, Twisty, Paved, Mixed, Off-Road. Route list with distance, surface type, difficulty. Editor's Picks. Bike-specific recommendations. Weather badge. Plan trip FAB. Route reviews and ratings.

**Analytics insight**: Discover tab has strong daily engagement (75 events/30d excl. Slovakia).

**Post angles**: "Find your next road", "Curated curvy roads near you", "Routes rated by riders"

### Ride Recording & HUD

**What it does**: GPS ride recording with live HUD overlay: speed, lean angle gauge, distance, time, elevation, altitude, avg/max stats grid. Pause/resume. "Hold to End" completion. Post-ride AI summary with stats. Activity feed with ride cards (name, date, stats). Weekly + all-time mileage. Rides history with filtering. Ride sharing.

**Analytics insight**: Ride tracking is the #1 most-used active feature (220 events/30d). Combined ride events dominate all other feature clusters.

**Post angles**: "Every km tracked", "Live HUD — speed, lean, elevation", "Your ride history, forever"

### AI Diagnostics

**What it does**: Snap a photo of a warning light, leak, or part — or describe the symptom in text. AI answer in under 5 seconds (powered by Claude). No OBD hardware needed. Contextual: considers rider experience level, maintenance history, bike type, mileage. Severity classification: Critical/High/Warning/Medium/Low/OK. Actionable recommendations: parts affected, tools needed, difficulty, next steps. Recent diagnostic history per bike.

**Analytics insight**: Lowest engagement feature (10 events/30d). Do NOT lead social content with diagnostics. Use sparingly and only when the angle is genuinely fresh.

**Post angles**: "Snap a photo, get answers", "No OBD required", "AI mechanic in your pocket"

### Learning Hub

**What it does**: Modular learning paths: Engine Basics, Suspension, Electrical Systems, Maintenance Fundamentals. Multiple formats: quick tips (2-3 min), deep dives (10+ min), video walkthroughs, hands-on quizzes. AI-generated articles personalized to user's bike. Progress tracking. Bookmarks. Popular topics feed.

**Post angles**: "Master your bike", "Quick tips between rides", "Learn what your mechanic knows"

### Group Rides

**What it does**: Create and join group rides. Manage participant lists and status. Share trip itineraries with riding buddies. Publish to Discover for public visibility. Invite-only or public. "Clone Trip" for the community.

**Post angles**: "Ride with your crew", "Coordinate your next group ride", "Share your route with the community"

### Rider Profiles & Community

**What it does**: Rider profiles with follow/followers. Ride sharing. Trip reviews and ratings. Kudos system for engagement.

**Post angles**: "Your riding identity", "Share your rides", "Join the community"

### MotoVault Pro

**What it does**: Unlocks unlimited bikes (free: 1), unlimited AI Mechanic questions, advanced trip planning, expense reports, cloud backup. 7-day free trial.

**Post angles**: "Unlimited bikes, unlimited answers", "Pro tools for serious riders", "7-day free trial"

## Screenshot Catalog

See `infra/social-worker/src/screenshots.ts` for the full catalog with Supabase Storage paths and descriptions. 22 screenshots covering all major screens.

## Key Stats for Captions

- Free on iOS & Android, no trial, no credit card for basic tier
- 3 free AI diagnostics per month (free tier)
- Works with any motorcycle (sport, cruiser, adventure, touring, naked, scooter)
- Health score: percentage-based (98% ready)
- Expense categories: 10 types with color-coded breakdown
- Maintenance priorities: critical, high, medium, low
- Trip difficulty: Easy/Moderate/Challenging/Expert
- Cost/km and cost/mile tracking
- Total cost of ownership calculation
- Website: motovault.app

## Feature Engagement Ranking (PostHog, 30-day, excl. Slovakia)

1. Ride tracking — 220 events (dominant)
2. Expenses — 107 events (strong #2)
3. Discover/Routes — 75 events
4. Maintenance/Health — 47 events (growing)
5. Trip planning — 18 events (aspirational)
6. Diagnostics — 10 events (weakest)

Lead social content with rides and expenses. Use diagnostics sparingly.
