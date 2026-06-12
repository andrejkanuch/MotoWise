---
status: complete
priority: p3
issue_id: "192"
tags: [code-review, docs, process]
dependencies: []
---

# Promote the instrumentation-fix doc into docs/solutions/ for discoverability

## Problem Statement
`docs/Onboarding-Funnel-Instrumentation-Fix.md` is the canonical record of four analytics gotchas (reset() orphaning, OAuth signup undercount, replay enablement, dev gating), but it lives at the docs/ root. learnings-researcher found `docs/solutions/` has no entries on analytics identity/replay, so future grep-first searches won't surface it.

## Proposed Solution
Move/copy it into `docs/solutions/integration-issues/` following the solutions naming/frontmatter convention so it's discoverable by the learnings-researcher workflow. Cross-link the web analogues (W2/W3/W4 in `docs/plans/2026-04-11-001-posthog-analytics-audit-plan.md`).

## Acceptance Criteria
- [ ] Doc is discoverable under docs/solutions/ with proper frontmatter.

## Technical Details
Affected: `docs/Onboarding-Funnel-Instrumentation-Fix.md`.

## Work Log
- 2026-06-09: Recommended during /ce-review of PR #78 (learnings-researcher).

## Resources
- PR #78
