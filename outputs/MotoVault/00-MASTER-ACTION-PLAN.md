# MotoVault — ASO Master Action Plan

**Generated:** 2026-04-11
**App:** MotoVault (Apple ID 6760291360, com.motovault.app)
**Status:** Already live — this is a metadata/visual REFRESH, not a first launch
**Markets:** US + Europe (English-speaking + DE/FR/IT/ES)
**Estimated end-to-end timeline:** 2 weeks to refresh live + 90-day optimization runway

---

## Strategic summary

MotoVault sits in an uncontested 4th tribe of motorcycle apps. The market splits into:
1. **Navigation/GPS giants** (REVER, Scenic, calimoto, Detecht, RISER, MyRide) — tens of thousands of reviews; do NOT fight head-on
2. **Maintenance/service log specialists** (Bikeminder, mo.ride, MotoMainte) — fragmented, all under 200 reviews, ugly UIs, single-developer hobby projects
3. **Cross-vehicle fuel apps** (Fuelly) — car-first, dormant
4. **MotoVault** — the only polished, motorcycle-first app combining maintenance + expenses + trip planning + ride logging + **AI Mechanic**

**The moat:** AI Mechanic. No competitor in any tribe has it. None will pivot to add it (it conflicts with their core positioning). This is the differentiator we lead with everywhere.

**Recommended positioning:** "The motorcycle owner's app — not just a GPS." Where REVER/Scenic are about THE RIDE, MotoVault is about THE BIKE.

---

## Quick start

1. Read this master plan top-to-bottom
2. Work phases in order (01 → 02 → 03 → 04 → 05)
3. Each phase has its own action checklist (`action-*.md`)
4. Don't skip Phase 1 — the keyword/competitor context informs every later decision
5. Submit by 2026-04-15 to capture spring riding season

---

## Phase 1: Research (2 hours)

**Files:** `01-research/keyword-list.md`, `01-research/competitor-gaps.md`, `01-research/action-research.md`

Tasks:
- [ ] Read keyword list and competitor gaps
- [ ] Install REVER, Scenic, mo.ride, Bikeminder for hands-on context
- [ ] Decide localization scope (recommend en-GB + de-DE + fr-FR + it-IT + es-ES)
- [ ] Confirm AI Mechanic, trip planner, service reminders are production-ready

**Output:** Validated understanding of where MotoVault wins and what to claim.

**Dependency:** None
**Next:** Phase 2

---

## Phase 2: Metadata Implementation (3-4 hours, +6h per locale)

**Files:** `02-metadata/apple-metadata.md`, `02-metadata/google-metadata.md`, `02-metadata/visual-assets-spec.md`, `02-metadata/action-metadata.md`

Tasks:
- [ ] Update Apple App Store Connect with new name, subtitle, keywords, description, promo text
- [ ] Update Google Play Console with new title, short description, full description
- [ ] Verify all character limits
- [ ] Reorder screenshots — AI Mechanic first
- [ ] Generate the pending Discover screenshot (#5)
- [ ] Localize to en-GB at minimum, ideally de-DE/fr-FR/it-IT/es-ES

**Output:** Metadata draft saved in both consoles, ready for submission.

**Dependency:** Phase 1
**Next:** Phase 3

---

## Phase 3: A/B Testing Setup (1 hour setup + ongoing)

**Files:** `03-testing/ab-test-setup.md`, `03-testing/action-testing.md`

Tasks:
- [ ] Create tracking spreadsheet
- [ ] Submit Apple Test 01 (Screenshot 1 ordering: AI vs Service)
- [ ] Start Google Test 04 (Short description: feature vs persona)
- [ ] Schedule Tests 02, 03, 05 in calendar (cascading dates)
- [ ] Set decision-day reminders

**Output:** First two tests running, calendar set for the next 90 days of experiments.

**Dependency:** Phase 2 metadata draft
**Next:** Phase 4

---

## Phase 4: Refresh Submission (1 day prep + 3-7 days review)

**Files:** `04-launch/relaunch-checklist.md`, `04-launch/submission-guide.md`, `04-launch/timeline.md`, `04-launch/action-launch.md`

Tasks:
- [ ] Complete relaunch checklist (~25 items)
- [ ] Submit Apple metadata refresh (Option A — metadata-only, no new build)
- [ ] Submit Google Play store listing update
- [ ] Monitor Resolution Center daily until both approved
- [ ] Coordinate launch comms with social-worker schedule
- [ ] Day-7 baseline metrics captured

**Target submission date:** 2026-04-15
**Target live date:** 2026-04-17 (Google) and 2026-04-18 (Apple)

**Dependency:** Phases 2 & 3
**Next:** Phase 5

---

## Phase 5: Ongoing Optimization (continuous)

**Files:** `05-optimization/review-responses.md`, `05-optimization/ongoing-tasks.md`, `05-optimization/action-optimization.md`

**Daily (15 min):**
- [ ] Respond to all unanswered reviews
- [ ] Glance at crash reports

**Weekly (30-60 min, Friday):**
- [ ] Pull keyword ranks for top 10 keywords
- [ ] Pull conversion rate, install velocity, subscription metrics
- [ ] Promote A/B test winners
- [ ] Note recurring review themes

**Monthly (2 hours, first Monday):**
- [ ] Full health-score audit
- [ ] Refresh promo text per seasonal variants
- [ ] Re-run competitor scan
- [ ] Plan next month's A/B test

**Quarterly (half day):**
- [ ] Strategic review
- [ ] Plan next quarter's tests + localization expansion

---

## Success metrics (90-day targets)

| Metric | Baseline | 30 days | 60 days | 90 days |
|---|---|---|---|---|
| Apple impressions | TBD | +20% | +50% | +80% |
| Conversion rate | TBD | maintain | +10% | +20% |
| Top 5 keywords in top 50 | TBD | 3/5 | 4/5 | 5/5 |
| Average rating (both stores) | TBD | ≥4.5 | ≥4.5 | ≥4.6 |
| Pro subscription rate | TBD | maintain | +10% | +25% |
| At least 1 A/B test winner promoted | – | yes | yes | yes |

---

## Top 3 highest-leverage actions (do these first)

1. **Replace "Bike" with "Motorcycle" in name + subtitle.** Apple's algorithm conflates "Bike" with bicycles, dragging your relevance for moto searches. New name: `MotoVault: Motorcycle Garage`. (Phase 2, 5 min)
2. **Add "AI Mechanic" to subtitle.** Zero competitors use this phrase. Instant differentiation. New subtitle: `Service, Trips & AI Mechanic`. (Phase 2, 5 min)
3. **Reorder screenshots so AI Mechanic is screen 1.** Screen 1 drives 60-70% of tap-to-install conversion; lead with the moat. (Phase 2 + Phase 3 PPO test)

---

## File index

```
outputs/MotoVault/
├── 00-MASTER-ACTION-PLAN.md          ← you are here
├── FINAL-REPORT.md                    ← executive summary
├── 01-research/
│   ├── keyword-list.md
│   ├── competitor-gaps.md
│   └── action-research.md
├── 02-metadata/
│   ├── apple-metadata.md
│   ├── google-metadata.md
│   ├── visual-assets-spec.md
│   └── action-metadata.md
├── 03-testing/
│   ├── ab-test-setup.md
│   └── action-testing.md
├── 04-launch/
│   ├── relaunch-checklist.md
│   ├── submission-guide.md
│   ├── timeline.md
│   └── action-launch.md
└── 05-optimization/
    ├── review-responses.md
    ├── ongoing-tasks.md
    └── action-optimization.md
```
