---
status: complete
priority: p2
issue_id: "071"
tags: [code-review, web, maintainability]
---

# Hardcoded base URL "motovault.app" in 3 files

## Problem Statement

The base URL `https://motovault.app` is hardcoded in multiple files instead of using a single constant or environment variable.

**Files:**
- `apps/web/src/app/(marketing)/page.tsx` (organization schema)
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/robots.ts`

## Findings

- Kieran-typescript-reviewer flagged as an issue
- Should use `metadataBase` from root layout or an env var
- Makes staging/preview deployments show wrong URLs

## Proposed Solutions

1. **Use env var** (Recommended)
   - Add `NEXT_PUBLIC_BASE_URL` env var
   - Reference in sitemap, robots, and JSON-LD
   - **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Single source of truth for base URL
- [ ] Preview deployments use correct URL
