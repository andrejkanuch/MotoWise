---
title: Live Sharing Demand Test - Plan
type: feat
date: 2026-10-10
topic: live-sharing-fake-door
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Live Sharing Demand Test - Plan

## Goal Capsule

- **Objective:** Before three weeks go into live location sharing, know from MotoVault's own riders whether they want to share a ride live from the app. After this ships, the owner can read how many ride-starters asked for it and decide to build, defer or drop live sharing on that number.
- **Means:** A fake-door row on the Start Ride screen, shown until 100 riders with a qualifying ride have seen it or six weeks pass, that records opt-ins and promises nothing beyond one notification at launch if the feature is built.
- **Product authority:** Owner (Andrej). This plan covers the demand test only; the live-sharing build is a conditional next area, not active scope.
- **Open blockers:** None before planning.

---

## Product Contract

### Summary

Add a "Share this ride live with someone" row to the Start Ride screen. Tapping it opens a sheet that says the feature is being considered, asks who the rider would share with, and offers to notify them. Count riders with at least one qualifying ride who opt in with "Tell me when it's ready", run it over the air until 100 such riders have seen the row or six weeks pass, and build live sharing only if the opt-in share clears the bar in R7.

### Problem Frame

Live sharing is ranked first among Pro candidates on the strength of paid precedents at REVER, Garmin, komoot and Cardo, but nothing from a MotoVault rider says they want it: no review, support message or event mentions sharing location. Every rider already has WhatsApp live location and Find My for free. The paid value would be automation (share starts with the ride) and ride semantics (Live, Stopped, Signal lost, Paused instead of a frozen dot), and the build is about three weeks solo. Spending that on external evidence alone is the risk this test removes.

### Key Decisions

- **Fake door before the build** (session-settled: user-directed — chosen over building on the external evidence and over dropping live sharing from the top three: one day of work answers the demand question with real riders). Governs R1 to R6.
- **The decision rule is set now.** Build if about 10% or more of riders with a qualifying ride who saw the row opt in within the window and at least five riders opted in; otherwise live sharing drops behind cost trends and trip roll-up. Row taps without an opt-in are reported as the curiosity ceiling and never counted. Governs R7, R8.
- **The row promises nothing.** No date, no payment, no "coming soon" as a commitment; the sheet says the feature is being considered, and the only commitment is one notification at launch to riders who opted in, if the feature is built. Governs R3, R8.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers the demand test only. The breakdown below is the current understanding, not a committed roadmap.

- Live location sharing build (GitHub #269, #244, #245)
  - Depends on this test clearing its bar.
  - Shape carried forward if built: one free contact with manual share, Pro gets five contacts, auto-share on every ride and start and end emails; standing per-contact links; privacy zones that hide the first and last few hundred metres on every surface that shows a route to someone else; Android ships as a labelled beta alongside iOS.
  - Still to decide: whether start emails are Pro-only, and whether live sharing goes into store screenshots at launch.
- Ride-moment paywall plumbing and Rider Insights redesign
  - Can proceed independently of this test; the plans share the qualifying-ride definition (plumbing R1).

### Actors

- A1. Rider on the Start Ride screen.
- A2. Owner reading the tap counts.

### Requirements

- R1. The Start Ride screen shows a row "Share this ride live with someone" to every rider, Pro or not, below the pre-flight checklist and above Start.
- R2. Tapping opens a sheet that says MotoVault is considering live sharing, asks who the rider would share with (partner, family, friend, riding group, nobody), and offers "Tell me when it's ready".
- R3. The sheet names no date, takes no payment and opens no paywall.
- R4. After the rider taps "Tell me when it's ready" the row reads "You're on the list" for that rider and does not open the sheet again; a rider who closes the sheet without opting in sees the row unchanged.
- R5. Showing the row, tapping it and opting in emit events carrying the rider's qualifying ride count (as defined in the paywall plumbing plan's R1), Pro status, platform and the chosen audience; the audience is unset on the row-shown and row-tapped events and the rider's selected audience on the opt-in event.
- R6. The row is removed over the air at the end of the window without a store build.
- R7. The window closes when 100 riders with at least one qualifying ride have seen the row or after six weeks, whichever comes first; the result is the number of those riders who opted in with an audience other than "nobody", divided by that population; the build bar is 10% and at least five opt-ins. Taps and opt-ins by riders with no qualifying ride are reported separately and do not enter the rule.
- R8. The opt-in is stored on the rider's account in the existing preferences field, with no new backend field or table. If live sharing is dropped the row is removed and nothing is sent; if it is built, opted-in riders receive one notification at launch.

### Key Flows

- F1. Interested rider
  - **Trigger:** A1 opens Start Ride.
  - **Steps:** Row shown and event emitted; rider taps; sheet shown; rider picks "partner" and "Tell me when it's ready"; events emitted; row reads "You're on the list".
  - **Covers:** R1 to R5, R8.

### Acceptance Examples

- AE1. **Covers R1, R3.** Given a non-Pro rider, when they tap the row, then the sheet opens and no paywall is requested.
- AE2. **Covers R4.** Given a rider who opted in yesterday, when they open Start Ride, then the row reads "You're on the list" and tapping does nothing; a rider who only opened and closed the sheet sees the original row.
- AE3. **Covers R7.** Given 100 riders with a qualifying ride saw the row and 7 opted in with a real audience, then the result is 7% and live sharing does not proceed under the decision rule; a further 20 taps from riders with no qualifying ride are reported but not counted.

### Success Criteria

- The decision rule in R7 produces a number the owner can act on within six weeks.
- Guardrail: no change in started-to-saved ride ratio during the window.

### Scope Boundaries

- Not this plan: any live-sharing functionality, contacts, viewer page, emails, privacy zones.
- Deferred: the live-sharing build and its decisions, listed under How This Work Fits Together.

### Dependencies / Assumptions

- Main assumption behind live sharing: riders will add a contact and want sharing to start automatically with the ride.
- Ships over the air to the 3.25.0 runtime; no backend change.
- The Start Ride modal renders a pre-flight checklist component where the row can sit; verified.

### Outstanding Questions

**Deferred to Planning**

- Where the opt-in flag from R8 lives (user row or a separate table).

### Sources / Research

- GitHub issues #269, #244, #270 (rank 1) and the 2026-10-07 research comments.
- `apps/mobile/src/app/(modals)/start-ride.tsx` and `components/ride/pre-flight-checklist.tsx`.
- 90-day PostHog pull 2026-10-05: 40 riders, 5 made 70% of rides.
