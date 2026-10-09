# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One React Native (Expo SDK 57, RN 0.86) app shipped to iOS and Android. It should feel native on each OS — haptics and continuous corner curves on iOS, Material behaviours on Android — from one codebase. The web app (`apps/web`) is a separate surface with its own editorial direction and is out of scope for this record.

## Users

Motorcycle riders in Europe and the Americas who want one app for their whole moto life. They are hands-on owners who value their machines and want to feel in command of every detail. They open the app before a ride, after a service or a fuel stop, or when something sounds wrong — often standing next to the bike, phone in one hand, sometimes with gloves or dirty hands.

India and other markets are not targets.

## Product Purpose

MotoVault keeps a rider's bikes, rides and running costs in one place, so the next ride, service or spend decision is obvious:

- **Rides** — GPS ride tracking and history. The most-used feature (PostHog).
- **Expenses** — logging fuel, parts, services and gear per bike, including receipt scan. The most-valued action.
- **Maintenance** — service tasks, intervals and due reminders per bike, OEM schedule import, logging past work.
- **Garage / bike hub** — each bike's overview: odometer, what's due, costs, notes with photos, documents.
- **Discover / trips** — routes and group rides.
- **Learn & AI diagnostics** — available, but secondary. Not part of the positioning.

Success means a rider logs real activity (a ride, an expense, a service) in their first week and keeps coming back after a ride or service. Today, the first-week core action is the ceiling: most installs never return after day one.

## Positioning

One rider-owned record of the bike: what it costs, what it needs next and where it has been, kept by the rider in seconds from the bike itself. Logging is the core and is never paywalled. Pro monetizes depth (analytics, extras), never the act of recording.

## Operating Context

- Used in short bursts around riding: pre-ride check, post-ride or post-fuel log, at the workshop counter, reading a receipt.
- Units are per rider (km or mi). Odometer values are stored in the rider's own unit.
- Currencies are per rider. Real invoices are in local currencies (e.g. EUR, Spanish-language receipts).
- Ride tracking runs in the background with GPS. CarPlay is a companion on iOS; Android Auto is excluded.
- A night mode (amber-red) exists for riding in the dark.

## Capabilities and Constraints

- Navigation: native tabs Home · Discover · Garage · Profile, each with its own stack. Modals and sheets are native form sheets.
- The bike hub (bike detail) is mid-redesign. Phase 1 shipped in 3.22.0: header, segment bar (Overview · Service · Costs · Bike), Overview, Log sheet, Odometer sheet, and Notes with photos. Service, Costs and Bike still wrap the previous sections until their phases land (spec: `docs/design/app-screens/05-garage/02-bike-detail/redesign/DESIGN-SPEC.md`, plan in `PROGRESS.md`).
- Every surface, the bike hub included, supports light and dark and follows the app's theme setting (System / Light / Dark). Dark-first in design priority.
- All copy goes through i18n, with 13 locales in `src/i18n/locales`. New keys must exist in every locale.
- All colours come from `@motovault/design-system` `palette`. No colour literals in components.
- OTA updates only reach builds with the same app version (runtime = appVersion).
- Monetization is RevenueCat Pro. An onboarding paywall is required by the owner.
- Undecided: the redesign phases 2–6 (Service, Costs, Bike, Home card, cross-links) — scope is set by DESIGN-SPEC.md, but their build order and some data decisions are still open.

## Brand Commitments

- Name: **MotoVault**. Signature colour: exhaust copper. Personality: rugged, premium, confident.
- No gamification (badges, streaks, cartoon icons), no generic SaaS dashboard look, and no forum clutter.
- Voice: plain, rider-to-rider, precise with numbers. No hype.

## Evidence on Hand

- Product analytics (PostHog, 2026): rides are #1 by use; expense logging ~13 users vs AI diagnostics ~5; 670 installs/90 days → 6.6% alive at day 7; onboarding goal "track rides" ~60%, "manage expenses" ~20%.
- App Store: very few ratings. Trust is the main conversion leak. No testimonials exist, and none may be invented.
- Real data: the test account carries a Honda Africa Twin 2022 DCT seeded with real Spanish/EUR invoice data.
- Screen library: `docs/design/app-screens/` (captures) and the bike-hub `.dc.html` mocks under `redesign/screens/`.

## Product Principles

1. **Logging is free and fast.** Recording a ride, expense, service or note must take seconds and never hit a paywall or a count limit.
2. **Next thing first.** Every screen leads with what matters for the next ride, service or decision; history and detail sit one step deeper.
3. **The rider's numbers are sacred.** Units, currency and odometer are exactly what the rider entered; never silently converted, rounded away or lost on a failed save.
4. **Nothing is lost.** A failed upload, a dropped connection or a dismissed sheet keeps the rider's work and says what happened.
5. **Native, not generic.** It behaves like a first-party tool on each OS rather than a cross-platform template.

## Accessibility & Inclusion

- Supports Dynamic Type up to accessibility sizes (the bike hub is verified at AX5).
- VoiceOver/TalkBack labels on every icon-only control, and live-region announcements for async results (saves, undo, errors).
- Minimum tap target: `HUB_TOUCH_TARGET` (44pt iOS / 48dp Android).
- Usable one-handed and with gloves: primary actions sit low and large.
