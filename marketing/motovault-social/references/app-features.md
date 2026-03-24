# MotoVault App Features & Screenshot Inventory

## App Overview

MotoVault is an AI-powered motorcycle learning & diagnostics platform. The mobile app (Expo/React Native) has 5 main tabs: Home, Learn, Diagnose, Garage, Profile.

## Features by Tab

### Home Dashboard
**What it does**: Personalized greeting, bike health score ring (0-100, grades A-F), mileage display, expense summary, next service countdown, maintenance alerts, recommended articles.

**Screenshots available**:
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.19.35.png` — Home top (greeting, health ring 100, mileage 13,500 km, expenses $46)
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.21.37.png` — Home bottom (expenses, next service 13 days, maintenance alerts list)
- `apps/web/public/images/features/home.png` — Home screen (same as simulator)
- `apps/web/public/images/features/home-dashboard.jpg` — Dashboard variant
- `apps/web/public/images/features/alerts.png` — Alerts section

**Post angles**: "Your bike's command center", "Everything at a glance", "Smart alerts before things break"

### Garage (Bike Management)
**What it does**: Digital garage listing all motorcycles. Add bikes with make/model/year/photo. Set primary bike. Health score per bike. Quick actions (Add Task, Add Expense, Edit, More).

**Screenshots available**:
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.21.14.png` — Garage list (BMW R 1250 GS, "Add a Bike" button)
- `apps/web/public/images/features/garage.png` — Garage screen
- `apps/web/public/images/features/bike-details.png` — Bike detail with photo, health 100%, mileage, maintenance tasks

**Post angles**: "Your bikes, one place", "Digital garage for every rider", "Know your bike inside out"

### Maintenance Tracking
**What it does**: Create maintenance tasks with title, priority (critical/high/medium/low), due dates, mileage targets. Filter by status. Health score algorithm (50% overdue weight, 25% urgency, 25% completion rate). Complete tasks, schedule recurring. Export history as PDF.

**Screenshots available**:
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.20.46.png` — Maintenance task list (Front Tire Replacement HIGH, 20,000km Major Service HIGH, Coolant Replacement LOW)
- `apps/web/public/images/features/maintenance.png` — Same maintenance view

**Post angles**: "Never miss a service", "Priority-based task tracking", "Your bike's health report card"

### Expense Tracking
**What it does**: Log expenses by category (fuel, maintenance, parts, gear). Track by year or all-time. View YTD total, avg/month, entries count, cost/km. Category breakdown with color-coded bars.

**Screenshots available**:
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.21.00.png` — Expense Insights ($2,588 all time, $215.67 avg/mo, 27 entries, $0.19/km, category breakdown)
- `apps/web/public/images/features/expenses.png` — Same expense view

**Post angles**: "Know every dollar", "Where does your bike money go?", "Cost-per-kilometer tracking"

### AI Diagnostics
**What it does**: 4-step diagnostic flow: (1) Select motorcycle, (2) Describe symptoms (noise, leak, vibration, smoke, electrical) + timing + location, (3) Take photo + add details + urgency level, (4) Review & submit. AI returns: identified parts with confidence %, severity assessment, ranked issues, step-by-step fixes, mechanic recommendation.

**Screenshots available**:
- `marketing-material/Simulator Screenshot - iPhone 17 Pro - 2026-03-20 at 10.20.08.png` — Diagnose home screen
- `marketing-material/carousel-diagnostics/step1.png` — Select motorcycle step
- `marketing-material/carousel-diagnostics/step2.png` — Symptoms selection
- `marketing-material/carousel-diagnostics/step3.png` — Photo & details step
- `marketing-material/carousel-diagnostics/step4.png` — Review & submit step
- `marketing-material/carousel-diagnostics/result1.png` — AI diagnosis result overview
- `marketing-material/carousel-diagnostics/result2.png` — Issues list
- `marketing-material/carousel-diagnostics/result3.png` — Next steps
- `apps/web/public/images/features/diagnose.png` — Diagnose home
- `apps/web/public/images/features/diagnose-flow/` — Full flow screenshots

**Post angles**: "Snap a photo, get answers", "Your AI mechanic", "Diagnose from anywhere"
**Note**: Already covered in carousel-diagnostics. Could do a different angle (e.g., results focus, before/after mechanic visit).

### Learn (Articles & Quizzes)
**What it does**: AI-generated educational articles about motorcycle maintenance, riding tips, safety. Quizzes to test knowledge. Content adapts to user's bike(s).

**Screenshots available**: Limited — check `apps/web/public/images/features/` for any learn-related screenshots.

**Post angles**: "Level up your riding knowledge", "AI-curated lessons for your bike", "Learn while you ride"

## Existing Carousels (don't repeat these exact angles)

1. **carousel-diagnostics/** — "Snap a Photo. Get Answers." (AI Diagnostics walkthrough)
2. **carousel-maintenance/** — "Never Miss a Service Again." (Maintenance tracking)
3. **carousel-garage/** (our latest) — "Your Bikes. One Place." (Garage & bike management)

## Logo & Brand Assets

- **Logo**: `marketing-material/MotoVault-logo.png` (MW monogram on dark blue, rounded square)
- **Store previews**: `marketing-material/store-previews/` (App Store & Google Play preview images)

## Key Stats for Captions

- 3 free AI diagnostics per month (free tier)
- Works with any motorcycle (sport, cruiser, adventure, touring, scooter)
- Health score: A-F grading system
- Expense categories: fuel, maintenance, parts, gear
- Maintenance priorities: critical, high, medium, low
- Free on iOS & Android
- Website: motovault.app
