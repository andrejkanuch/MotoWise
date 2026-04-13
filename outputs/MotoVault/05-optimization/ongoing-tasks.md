# MotoVault — Ongoing ASO Tasks

**Generated:** 2026-04-11

---

## Daily (15 min)

- [ ] Check App Store Connect → Reviews → Unanswered (respond using `review-responses.md`)
- [ ] Check Play Console → Reviews → Unanswered
- [ ] Glance at Sentry / crash reporting for new issues
- [ ] Check ratings trend (any sudden drops?)

## Weekly (30-60 min, every Friday)

- [ ] Pull keyword rankings for top 10 keywords from `keyword-list.md`
  - Use AppFigures, AppTweak, or Sensor Tower (any free tier works)
  - Log in tracking spreadsheet
- [ ] Pull conversion rate (impressions → installs) for both stores
- [ ] Pull install velocity (week-over-week)
- [ ] Pull subscription metrics from RevenueCat dashboard
- [ ] Check active A/B tests; promote winners if confidence threshold hit
- [ ] Review reviews (4+ star) for feature requests — log in roadmap
- [ ] Review reviews (1-3 star) for recurring bugs — file in issue tracker
- [ ] Skim top 3 competitors' What's New / new updates — note positioning shifts
- [ ] Update Promotional Text if new feature shipped or season is shifting

## Monthly (2 hours, first Monday of month)

- [ ] Full ASO health-score audit:
  - [ ] Title score (keyword rank for primary)
  - [ ] Subtitle score
  - [ ] Description keyword density
  - [ ] Screenshot conversion rate
  - [ ] Icon impression rate
  - [ ] Review velocity (reviews/install)
  - [ ] Average rating trend
- [ ] Reset Promotional Text per `apple-metadata.md` seasonal variants
- [ ] Run a fresh competitor scan via iTunes Search API (re-run the bash commands from this audit)
- [ ] Identify any new entrants in the moto category
- [ ] Check NHTSA database additions — add new makes/models to bike catalogue
- [ ] Check for new Google Play / App Store policy updates
- [ ] Plan next month's A/B test
- [ ] Update `timeline.md` with next month's dates

## Quarterly (half day)

- [ ] Strategic review:
  - [ ] Are the 5 differentiator keywords actually delivering installs?
  - [ ] Has any competitor copied the AI Mechanic angle?
  - [ ] Is the localization investment paying off (per-locale conversion data)?
  - [ ] What % of installs come from search vs. browse vs. referral?
- [ ] Plan next quarter's tests (3-4 max)
- [ ] Plan next quarter's localization expansion
- [ ] Refresh screenshots if app UI has changed materially
- [ ] Update keyword list — add new gaps, remove dead ones
- [ ] Re-audit description for stale claims

---

## Tools to use (free/cheap)

| Tool | Cost | Purpose |
|---|---|---|
| App Store Connect | Free | Apple metrics, PPO tests, reviews |
| Google Play Console | Free | Google metrics, SLE tests, reviews |
| AppFigures | $9/mo | Keyword tracking + competitor monitoring |
| Sensor Tower (free tier) | Free | Spot-check rankings |
| AppTweak (trial) | Free 7d | Deeper keyword research bursts |
| RevenueCat | Free tier | Subscription metrics |
| Sentry / your crash tool | Free tier | Stability tracking |
| iTunes Search API | Free | Competitor data (re-run audit scripts) |

---

## Metrics dashboard (track these in a sheet)

| Metric | Frequency | Source | Target |
|---|---|---|---|
| Impressions | Weekly | App Store Connect | +10% MoM |
| Conversion rate (impression→install) | Weekly | App Store Connect | ≥4% (industry avg ~3%) |
| Installs | Weekly | Both stores | +15% MoM in season |
| Average rating | Weekly | Both stores | ≥4.5 |
| Review count | Weekly | Both stores | +20/wk in season |
| Pro subscription rate | Weekly | RevenueCat | ≥3% of new installs |
| Top 5 keyword ranks | Weekly | AppFigures | Top 50 → top 10 over 3 mo |
| Crash-free sessions | Daily | Sentry | ≥99.7% |
