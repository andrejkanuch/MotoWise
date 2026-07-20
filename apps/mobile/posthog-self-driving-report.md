# PostHog Self-driving Setup Report

**Project:** MotoVault (PostHog project 155556)
**Date:** 2026-07-18
**Inbox:** https://eu.posthog.com/project/155556/inbox

## Summary

PostHog Self-driving was configured for MotoVault. Error tracking, session replay, conversations, GitHub Issues, and Linear responders were already enabled or activated today. A 3-scout troop (general + product-analytics + feature-flags) was tuned and one custom scout (`paywall-conversion`) was created. Findings will start appearing in the [Self-driving inbox](https://eu.posthog.com/project/155556/inbox) within ~30 minutes of the first coordinator tick.

---

## AI data processing

**Approved.** Organization-level AI data processing consent was granted before this setup ran (enforced by the wizard gate).

---

## GitHub

**Already connected** (integration id: 61824, display name: `andrejkanuch`, connected 2026-04-11). No action required.

---

## Products enabled

| Product | Status | Notes |
|---|---|---|
| Session Replay | **enabled, inert on mobile** | Server-side toggle is on; recordings from the web app (motovault.app) are actively captured. Mobile (Expo/RN) SDK must configure replay separately — recordings will flow once the SDK is wired. |
| Error Tracking | **enabled, inert on mobile** | Server-side toggle is on; Next.js web errors are being captured (confirmed: active issues). Mobile exception capture needs SDK configuration. |
| Support (Conversations) | **could not confirm** | `products-enable` tool unavailable in this MCP version; could not call the API to enable it. Existing `conversations/ticket` responder row confirmed enabled — tickets will route to the inbox once an inbound channel (email / Slack / inbox) is connected. |

> **Mobile SDK note:** This is an Expo/React Native project. The server-side product flips are inert for the mobile client until session recording and exception capture are explicitly configured in the PostHog RN SDK init. The web app (Next.js, same PostHog project) is already capturing both.

---

## Signal sources

| Source product | Source type | Action | Notes |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | **On by default** | Scout findings reach the inbox without a config row — confirmed by PostHog API. |
| `error_tracking` | `issue_created` | **Already enabled** | id: 019f75e8-58f3 |
| `error_tracking` | `issue_reopened` | **Already enabled** | id: 019f75e8-5bea |
| `error_tracking` | `issue_spiking` | **Already enabled** | id: 019f75e8-6115 |
| `session_replay` | `session_analysis_cluster` | **Already enabled** | id: 019f75e8-63e1 |
| `conversations` | `ticket` | **Already enabled** | id: 019f75e8-67b3 |
| `github` | `issue` | **Enabled this run** | id: 019f7646-97bf |
| `linear` | `issue` | **Enabled this run (dormant)** | id: 019f7646-9cee — responder row active but warehouse source is failing (see follow-ups) |
| `llm_analytics` | — | **Skipped** | Internal-only, not a user-facing responder |
| `logs` | — | **Skipped** | Not a v1 responder |

---

## Connected tools

| Tool | Status | Notes |
|---|---|---|
| **GitHub Issues** | **Verified connected** | Warehouse source id: `019d7cdb-ce54`, repository: `andrejkanuch/MotoWise`, `issues` schema syncing (1 row, last synced 2026-07-18). `pull_requests` schema failing ("Invalid GitHub credentials") — only `issues` is consumed by Self-driving; PRs can be re-enabled in the UI once credentials are refreshed. |
| **Linear** | **Selected but sync failing (dormant)** | Warehouse source id: `019d7cdd-16dc` exists with 182 previously-synced issues, but all schemas are currently failing with "The Linear app is not configured on this PostHog instance." Responder row enabled — issues will reach the inbox automatically once the sync error is resolved. See follow-ups. |
| **Zendesk** | Not used | Skipped (not selected). |
| **pganalyze** | Not used | Skipped (not selected). |
| **Jira** | Not used | Skipped (not selected). |

---

## Scout troop

**4 active scouts** (general + 2 specialists + 1 custom). 23 disabled.

### Enabled

| Scout | Reason enabled |
|---|---|
| `signals-scout-general` | Always on — cross-product correlations and surfaces no specialist covers. Was already enabled when the troop was materialized. |
| `signals-scout-product-analytics` | MotoVault's core is product events (expenses, maintenance logs, ride tracking, trip planning). Funnel/retention regressions on these flows are the highest-value signal. |
| `signals-scout-feature-flags` | Feature flags are actively used for receipt-scan quota gating, A/B experiments, and onboarding flows. Flag evaluation cliffs or ghost flags would silently break feature access. |
| `signals-scout-paywall-conversion` | **Custom scout** (see below). Watches RevenueCat paywall-to-subscription conversion and billing health — not covered by any built-in specialist. |

### Disabled (selected reasons)

| Scout | Reason disabled |
|---|---|
| `signals-scout-error-tracking` | **Covered by native source** — error_tracking responders already feed the inbox directly. Not a re-enable follow-up. |
| `signals-scout-session-replay` | **Covered by native source** — session_replay responder already feeds the inbox. Not a re-enable follow-up. |
| `signals-scout-revenue-analytics` | Paywall conversion covered by custom scout. Revenue analytics scout (watches Stripe sync / PostHog revenue tables) can be enabled in PostHog if a Stripe warehouse source is added. |
| `signals-scout-surveys` | 1 survey exists but it ended 2026-06-14. Enable in PostHog if active surveys resume. |
| `signals-scout-experiments` | No active A/B experiments detected. Enable if experiments are running. |
| `signals-scout-web-analytics` | Web traffic covered by motovault.app Next.js app — enable if web traffic anomaly detection is wanted. |
| `signals-scout-ai-observability` | Claude AI is used in the API for diagnostics but no `$ai_*` events detected in the project. Enable once LLM analytics events are instrumented. |
| All others | Not in top-used surfaces for this project. Enable individually in PostHog → Inbox settings if needed. |

---

## Custom scouts

### Created: `signals-scout-paywall-conversion`

**What it watches:** Whether users who see the MotoVault subscription paywall go on to purchase (subscription or lifetime IAP). It also watches for entitlement-grant gaps that signal a RevenueCat billing webhook failure.

**Discriminator:** Files a report when the 7-day paywall-to-purchase conversion rate drops >30% below its scratchpad baseline, when purchases go silent while impressions continue, or when paywall impressions black out entirely. Closes out cheaply when traffic is below 10 impressions or the rate is within 15% of baseline.

**Why no built-in scout covers it:** `signals-scout-revenue-analytics` was not in the ≤2 specialist slots (product-analytics and feature-flags ranked higher for this project's usage profile). The general scout catches broad anomalies but not the specific paywall-impression → purchase funnel shape. This custom scout fills the gap.

**Noise escape hatch:** To switch to dry-run mode, set `emit: false` on config id `019f764b-0d64` in PostHog → Inbox settings.

### Considered and ruled out

| Candidate | Filter that ruled it out |
|---|---|
| Receipt scan pipeline health | **Proposed, declined by user.** Surface is watchable (extraction failure rate, quota depletion events); discriminator was clear. Can be revisited once the feature ships and event volume grows. |

---

## Follow-ups

- [ ] **Linear sync error** — Linear warehouse source (id: `019d7cdd-16dc`) is failing with "The Linear app is not configured on this PostHog instance. Please contact PostHog support" to restore the OAuth integration. Once fixed, the already-enabled responder (`linear/issue`) will begin routing Linear issues to the inbox with no further setup.
- [ ] **GitHub credentials warning** — GitHub warehouse source `pull_requests` schema has "Invalid GitHub credentials. Please reconnect your account." The `issues` schema (consumed by Self-driving) is still syncing fine, but reconnecting the GitHub integration in [PostHog integrations settings](https://eu.posthog.com/project/155556/settings/environment-integrations) will also restore PR sync.
- [ ] **Support / Conversations inbound channel** — The `conversations/ticket` responder is enabled, but tickets only arrive once an inbound channel (email, Slack, or inbox) is connected. Configure one in PostHog → Settings → Conversations.
- [ ] **Enable Support product via UI** — `products-enable` was unavailable in this MCP version. Verify Session Replay, Error Tracking, and Conversations are ON in [PostHog project settings](https://eu.posthog.com/project/155556/settings/environment-replay) if findings don't appear.
- [ ] **Mobile SDK — session replay** — The Expo/RN PostHog SDK needs explicit replay configuration for mobile sessions to be captured. Server-side toggle is on but inert until SDK is wired.
- [ ] **Mobile SDK — exception capture** — Same as above for error tracking on mobile. Web exceptions are captured via the Next.js app; mobile exceptions need SDK `capture_exceptions: true`.
- [ ] **Sentry scope error** — Sentry warehouse source (`project_service_hooks` schema) is failing with "missing required scopes." Update the Sentry token if you want full schema coverage.
- [ ] **Re-enable `signals-scout-surveys`** — If active surveys resume, enable this scout in PostHog → Inbox settings.
- [ ] **Re-enable `signals-scout-experiments`** — Enable when A/B experiments are actively running.
- [ ] **Receipt scan pipeline scout** — Declined this run; revisit once `feat/receipt-scan` ships and event volume is established. The surface (extraction failure rate, quota depletion) is ready for a custom scout.

---

## What happens next

The scout coordinator picks up fresh configs within ~30 minutes. The first scans for all 4 enabled scouts will fire on the next tick. Findings cluster into reports in your [Self-driving inbox](https://eu.posthog.com/project/155556/inbox) — immediately-actionable ones can start coding tasks directly from the inbox.
