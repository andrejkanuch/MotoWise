# Design Review: Ride Feature (React Native) — Compound Design Loop

**Target files:**
- `apps/mobile/src/app/(modals)/start-ride.tsx`
- `apps/mobile/src/app/(modals)/ride-hud.tsx` + HUD components
- `apps/mobile/src/app/(modals)/ride-summary.tsx`
- `apps/mobile/src/app/(modals)/ride-detail.tsx` (NEW)
- `apps/mobile/src/app/(tabs)/(profile)/rides.tsx` + `ride-card.tsx`
- `apps/mobile/src/components/home/recent-rides-widget.tsx` (NEW)

**Domain:** motorcycle (rider-focused, glanceability, glove operation, sunlight readability)

---

## Iteration 1 — DIAGNOSE ✓
- [x] /critique + /audit (UX/Accessibility Auditor) — 32 findings
- [x] Domain Expert (Motorcycle Rider) — 12 critical recommendations
- [x] Lead Designer (Visual Quality) — 15 design recommendations

## Iteration 2 — SYSTEMATIZE ✓
- [x] /normalize — Night mode colors → palette tokens (nightText, nightBg, nightAccent, nightGlow)
- [x] /normalize — Speed gradient colors → palette tokens (speedSlow, speedMedium, speedFast)
- [x] /normalize — Surface elevation → palette tokens (surfaceElevated, surfaceSubtle, hudGlow)
- [x] /typeset — Replaced Courier with system font, fontWeight: '200', 112pt, letterSpacing: -4
- [x] /typeset — tabular-nums on all numeric displays across all screens
- [x] /typeset — Fixed stat label opacity hack → proper palette.neutral500
- [x] /arrange — Standardized padding to 20px across all ride screens
- [x] /arrange — Fixed stats grid from width: '47%' to flexBasis + flexGrow
- [x] /clarify — "Start a Ride" → "Ready to Ride" with subtitle
- [x] /clarify — Smart ride naming: time-of-day + day name ("Saturday Morning Ride")
- [x] /clarify — Added "Discard Ride" option with confirmation dialog

## Iteration 3 — ENHANCE + HARDEN ✓
- [x] /animate — Paused state: pulsing amber overlay + badge pulse animation
- [x] /animate — Celebration moment: ZoomIn checkmark + FadeInUp stats on ride complete
- [x] /animate — Bike selection: ZoomIn spring animation on header icon
- [x] /delight — Gradient CTA buttons (accent400 → accent500)
- [x] /delight — Speed glow effect (radial background behind speed number)
- [x] /delight — Dimmed speed (opacity 0.35) when paused for instant state recognition
- [x] /distill — Single-bike owners: skip full picker, show compact "RIDING WITH" display
- [x] /distill — Multi-bike: collapsible picker with radio indicators
- [x] /distill — Quick Ride: de-emphasized at bottom of picker list
- [x] /harden — Guard against NaN in avg speed calculation (division by zero)
- [x] /harden — maxLength={100} on ride name input
- [x] /harden — Discard ride with confirmation dialog
- [x] /colorize — Night mode: #CC0000 → #D44A1A (amber-red, less aggressive)
- [x] /colorize — Night bg: #0a0000 → #0D0604 (warmer dark)
- [x] /colorize — Border treatment: surfaceElevated borders on all cards for depth

## Iteration 4 — POLISH + SHIP ✓
- [x] /adapt — Glove-friendly toggles: 36pt → 52pt with 12pt gap
- [x] /adapt — Unfinished ride buttons: 40pt → 48pt
- [x] /adapt — Map control buttons: 40pt → 44pt
- [x] /onboard — Empty state for rides: "Start your first ride" with Navigation icon
- [x] /onboard — Recent rides widget for home screen with weekly activity dots
- [x] /optimize — LinearGradient fade on map → content transition
- [x] /polish — Consistent border treatment across all cards
- [x] /polish — Stat icons use accent500 for visual consistency
- [x] /extract — 7 new palette tokens extracted to design system
- [x] /bolder — Weekly stats hero card with 32pt light-weight numbers
- [x] /bolder — Monthly + All Time stats strip at bottom of hero card

---

## New Screens Created
1. **ride-detail.tsx** — Dedicated read-only ride detail (fetches from API, decodes polyline, proper delete)
2. **recent-rides-widget.tsx** — Home screen widget with weekly stats + activity dots + recent rides

## Design Team Sign-off
- **UX/Accessibility Auditor**: Approved — accessibility labels added to all interactive elements
- **Motorcycle Domain Expert**: Approved — glove targets 52pt+, amber night mode, dramatic paused state
- **Lead Product Designer**: Approved — premium typography, gradient CTAs, celebration moment, depth hierarchy

## Total Fixes Applied: 45+
## Files Modified: 11
## Files Created: 2
