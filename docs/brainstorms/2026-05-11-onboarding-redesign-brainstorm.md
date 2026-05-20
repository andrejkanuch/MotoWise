---
date: 2026-05-11
topic: onboarding-redesign-v2
---

# Onboarding Redesign v2

## What We're Building

A complete redesign of the mobile onboarding flow, cutting from 13 screens to 6. The current onboarding was designed for the original AI diagnostics product but the app has pivoted to ride tracking, expense management, and route discovery. The current flow has a 59.5% drop-off rate with the largest cliff (44%) at the Experience step.

Key changes: add a Goals multi-select screen (Headspace pattern), auto-detect currency and measurement units from device locale, consolidate bike setup into a single skippable screen, personalize the paywall based on goals, and add a post-onboarding checklist on the Home tab.

## Why This Approach

Three approaches were considered:

1. **Slim & Ship** (just remove screens) — too conservative. Wouldn't fix the Experience step cliff or add personalization. Fast but low impact.
2. **Research-Backed Redesign** (chosen) — applies 9 evidence-backed patterns from Headspace (+10% conversion), Houzz (+15% conversion), Dollar Shave Club (+5.24% subscriptions), Mural (+10% retention), and Grammarly (+10-20% upgrades). Balanced effort-to-impact ratio.
3. **Progressive Reveal** (no wizard, just checklist) — architecturally risky. Moving the paywall out of onboarding threatens the 25% conversion rate. Requires backend refactoring of CompleteOnboarding mutation.

Approach B was chosen because it maximizes impact per engineering hour while keeping the paywall in its proven position.

## Data Foundation (PostHog, 30d, Slovakia-filtered)

### Current Funnel
```
142 installs → 79 start onboarding → 32 complete → 14 return → 7 active riders
```

### Current Step Drop-off
| Step | Unique Users | Drop |
|---|---|---|
| Started | 79 | — |
| Experience | 44 | -35 (44%) |
| Bike Year | 39 | -5 (+11 skipped) |
| Bike Make | 36 | -3 |
| Bike Photo | 30 | -6 |
| Currency | 26 | -4 |
| Bike Type | 24 | -2 |
| Bike Model | 24 | 0 |
| Smart Maintenance | 21 | -3 |
| Insights | 20 | -1 |
| Paywall | 18 | -2 |
| Completed | 32 | — |

### Feature Usage (Clean, What Users Actually Do)
1. Rides & Tracking: 201 events, 7 users, 28.7 events/user (deepest engagement)
2. Expenses & Fuel: 64 events, 7 users, 9.1 events/user
3. Discover & Routes: 64 events, 29 users, 2.2 events/user (widest reach)
4. AI Diagnostics: 17 events, 8 users
5. Trip Planning: 16 events, 3 users (near-zero real usage)

### Monetization
- 28 users saw paywall, 7 purchased (25% conversion)
- 12 users cancelled at App Store sheet (price shock)

## New Flow (6 Screens)

```
1. Welcome        — Animated value prop (rides, expenses, routes). Single CTA.
2. Experience      — "How long have you been riding?" Conversational tone.
                     3 options with icons. NOT "Select experience level."
3. Goals (NEW)     — "What do you want from MotoVault?" Multi-select:
                     □ Track my rides    □ Manage expenses
                     □ Discover routes   □ Maintain my bike
                     □ Just exploring
4. Bike Setup      — Year picker + searchable Make on one screen.
                     Prominent "I'll add my bike later" skip.
                     Model, type, photo deferred to post-onboarding.
5. Paywall         — RevenueCat remote paywall. Offering selected based on
                     Goals (ride-focused, route-focused, maintenance-focused,
                     or generic). Benefits unbundled as individual items.
6. Personalizing   — Mutation + 2.5s animation (down from 4s).
                     No photo upload (deferred).
```

### What's Removed
| Screen | Reason |
|---|---|
| Bike Model | Deferred to Garage — not needed for expenses/maintenance |
| Bike Type | Deferred to Garage — zero dependencies found |
| Bike Photo | Deferred to post-onboarding checklist |
| Smart Maintenance | Value prop merged into paywall benefits |
| Insights | Value prop merged into paywall benefits |
| Currency | Auto-detected from device locale |

### What's Auto-Detected
| Setting | Detection Method | Override Location |
|---|---|---|
| Currency | Device locale → Intl.NumberFormat resolvedOptions | Settings |
| Measurement units (mi/km, lb/kg) | Device locale (US/UK/LR = imperial, else metric) | Settings |

### Post-Onboarding Checklist (Home Tab)
Persistent card on Home after onboarding completion:
- Items ordered by Goals selection
- Deep-links to relevant features
- Dismissible, re-accessible from Profile
- Completing items fires `checklist_item_completed` event

Example items: "Start your first ride", "Browse routes near you", "Add your first expense", "Complete your bike profile", "Invite a riding buddy"

## Key Decisions

- **Keep paywall in onboarding**: 25% conversion rate is too good to risk. Research confirms 20-30% of upgrades come from onboarding paywall.
- **Goals multi-select over single-select**: Headspace proved +10% conversion with multi-intent. Users have layered motivations.
- **One decision per screen, not consolidated forms**: Houzz proved +15% by splitting fields across screens. Cognitive load per screen matters more than screen count.
- **Conversational copy**: Dollar Shave Club proved +5.24% with brand-aligned tone. "How long have you been riding?" not "Select experience level."
- **Auto-detect currency + units**: Eliminates a full screen. Can always be changed in Settings. Currency screen had 4-user drop-off — small but unnecessary.
- **Bike setup is skippable**: Expenses and maintenance work with just year + make (confirmed: bikeModel, bikeType, bikePhoto are all nullable in CompleteOnboardingInput). Model/type/photo deferred to contextual prompts.
- **Experience step cliff is UX + natural bounce**: ~44% drop is a mix of the screen not landing well (fixable) and natural install-and-bounce behavior (accepted). Fix the UX, don't obsess over eliminating all drop-off.

## Technical Notes

- Onboarding screens: `apps/mobile/src/app/(onboarding)/`
- Config: `apps/mobile/src/config/onboarding.ts` — ONBOARDING_SCREENS array
- State: `apps/mobile/src/stores/onboarding.store.ts` — Zustand + AsyncStorage
- Paywall: `apps/mobile/src/lib/subscription.ts` — `presentPaywall()` with RC placements
- Personalizing: `apps/mobile/src/app/(onboarding)/personalizing.tsx` — CompleteOnboarding mutation
- All bike fields in CompleteOnboardingInput are nullable — no API changes needed for minimal bike data
- RevenueCat uses remote paywalls via `react-native-purchases-ui` v9.12.0 — personalization requires multiple RC offerings mapped to goals, configured in RC dashboard

## Research Sources Applied

| Source | Finding | How We Apply It |
|---|---|---|
| Headspace | Multi-intent selection +10% conversion | Goals multi-select screen |
| Dollar Shave Club | Conversational tone +5.24% subscriptions | Rewrite all onboarding copy |
| Dollar Shave Club | Unbundle value props +11.2% | Individual benefit items on paywall |
| Houzz | Split fields across screens +15% | One decision per screen |
| Grammarly | Personalized pricing +10-20% upgrades | Goals → RC offering mapping |
| Mural | Onboarding checklist +10% week-1 retention | Home tab checklist |
| HubSpot | Keep flows native = double-digit lift | Native paywall, no redirects |
| General | Early paywall = 20-30% of upgrades | Keep paywall in onboarding |
| E-commerce | Timely disclosure > upfront shock | Benefits before price on paywall |

## Success Metrics

| Metric | Current | Target | Stretch |
|---|---|---|---|
| Onboarding completion | 40.5% | 70% | 80% |
| Experience step drop-off | 44% | <15% | <10% |
| D1 retention | 8.1% | 15% | 20% |
| Paywall-to-purchase | 25% | 25% (maintain) | 30% |
| Install-to-signup | 9.2% | 20% | 25% |
| Checklist 3+ items completed | N/A | 40% | 60% |

## Open Questions (All Resolved)

| # | Question | Answer |
|---|---|---|
| 1 | Can RC paywall reorder benefits dynamically? | No — use multiple offerings in RC dashboard, map to goals via offeringIdentifier |
| 2 | What does personalizing screen do? | Real work: photo upload, CompleteOnboarding mutation, Meta attribution. Keep but shorten to 2.5s |
| 3 | Can expenses/maintenance work with just make + year? | Yes — bikeModel, bikeType, bikePhoto all nullable, zero references in expense/maintenance code |
| 4 | Checklist: card or bottom sheet? | Home screen card — persistent, visible across sessions |

## Next Steps

-> `/ce:plan` for implementation breakdown
