# MotoVault — A/B Test Setup Guide

**Generated:** 2026-04-11
**Stores:** Apple (Product Page Optimization) + Google Play (Store Listing Experiments)

---

## Test cadence philosophy

- Run **one test at a time per store**. Concurrent tests pollute attribution.
- Minimum 7 days, target 14 days, max 30 days per test.
- Need at least **5,000 impressions** per variant for ≥95% confidence on icon/screenshot tests.
- Always test the **biggest assumption first**, not the easiest change.

---

## Test #1 — Apple Product Page Optimization: Screenshot order

**Hypothesis:** Leading with the AI Mechanic screenshot (the moat) increases tap-through-to-install vs. leading with maintenance.

**Setup in App Store Connect:**

1. App Store Connect → MotoVault → **Features** → **Product Page Optimization**
2. Click **+ Create**
3. Name: `Test01_HeroScreenshot_AI_vs_Service`
4. Treatment count: **2** (this gives Original + Variant A + Variant B)
5. Treatment A — change screenshot 1 to **DIAGNOSE WITH AI**
6. Treatment B — keep screenshot 1 as **NEVER MISS A SERVICE**
7. Traffic split: 33/33/33
8. Duration: 14 days
9. Submit for review (treatments require Apple review, takes 24-48 h)
10. Once live, monitor in App Analytics → Metrics → **Conversion Rate**

**Success metric:** Conversion Rate (impressions → installs)
**Win condition:** Variant beats control by ≥10% with ≥95% confidence

**Date plan:**
- Submit: 2026-04-13 (Mon)
- Live: 2026-04-15 (Wed)
- Decision: 2026-04-29 (Wed) — 14-day mark

---

## Test #2 — Apple PPO: Subtitle copy

**Hypothesis:** "AI Mechanic" in the subtitle increases conversion vs. functional language.

**Treatments:**
- A: `Service, Trips & AI Mechanic` (recommended)
- B: `Track Service, Fuel & Rides` (closer to current)

**Run after Test #1 finishes.**
- Submit: 2026-04-30
- Live: 2026-05-02
- Decision: 2026-05-16

---

## Test #3 — Apple PPO: App icon

**Hypothesis:** A wrench-overlay icon variant signals "maintenance app" stronger than the current vault icon.

**Treatments:**
- A: Current vault icon
- B: Vault + wrench overlay
- C: Helmet + checkmark

**Run after Test #2.** Icon tests need MORE impressions — extend to 21 days.
- Submit: 2026-05-18
- Live: 2026-05-20
- Decision: 2026-06-10

---

## Test #4 — Google Play Store Listing Experiment: Short description

**Hypothesis:** Persona-led short description ("The motorcycle owner's app...") converts better than feature-led.

**Setup in Play Console:**

1. Play Console → MotoVault → **Grow** → **Store presence** → **Store listing experiments**
2. Click **Create experiment**
3. Type: **Default graphics** → **Short description**
4. Variant 1: `Service log, trip planner, expense tracker & AI mechanic for motorcycle owners`
5. Variant 2: `The motorcycle owner's app: maintenance, expenses, trip planning & AI diagnostic`
6. Audience: **Global** (or split US/EU if traffic allows)
7. Confidence: **90%** (default)
8. Min detectable effect: **5%**
9. Start

**Success metric:** Store listing → install conversion rate
**Date plan:**
- Start: 2026-04-15
- Decision: when Play Console marks it confident (typically 7-14 days)

---

## Test #5 — Google Play SLE: Feature graphic

**Hypothesis:** AI Mechanic chat preview converts better than dashboard hero.

**Treatments:**
- A: Bike + dashboard
- B: AI Mechanic chat screenshot

Run after Test #4 finishes.

---

## Tracking template

Maintain this in a spreadsheet (Notion / Numbers / Sheets):

| Test ID | Store | Field | Variants | Start | End | Winner | Lift % | Confidence | Promoted? |
|---|---|---|---|---|---|---|---|---|---|
| T01 | Apple | Screenshot 1 | AI vs Service | 2026-04-15 | 2026-04-29 | TBD | – | – | – |
| T02 | Apple | Subtitle | AI Mech vs Service | 2026-04-30 | 2026-05-16 | TBD | – | – | – |
| T03 | Apple | Icon | Vault vs Wrench vs Helmet | 2026-05-20 | 2026-06-10 | TBD | – | – | – |
| T04 | Google | Short desc | Feature vs Persona | 2026-04-15 | TBD | TBD | – | – | – |
| T05 | Google | Feature graphic | Dashboard vs Chat | TBD | TBD | TBD | – | – | – |

---

## Don'ts

- Don't change metadata fields outside an active test — it pollutes data.
- Don't run two tests on the same field simultaneously.
- Don't trust results from <5,000 impressions per variant.
- Don't promote a winner with <90% confidence on Google or <95% on Apple.
- Don't test trivial copy changes — the lift won't justify the time.
