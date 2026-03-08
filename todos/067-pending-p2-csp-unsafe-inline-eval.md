---
status: pending
priority: p2
issue_id: "067"
tags: [code-review, security, web, csp]
---

# CSP uses unsafe-inline and unsafe-eval

## Problem Statement

The Content Security Policy in `next.config.ts` includes `'unsafe-inline'` for script-src and `'unsafe-eval'` for script-src. This weakens XSS protection significantly.

**File:** `apps/web/next.config.ts`

## Findings

- Security-sentinel flagged as medium severity
- `unsafe-eval` may be needed for dev mode but should be conditional
- Nonce-based CSP is the recommended approach for Next.js 16
- JSON-LD scripts need nonce or hash-based allowlisting

## Proposed Solutions

1. **Nonce-based CSP** (Recommended)
   - Use Next.js 16's built-in nonce support via `headers()`
   - Remove `unsafe-inline` and `unsafe-eval` from production
   - Keep `unsafe-eval` only in development via environment check
   - **Effort:** Medium | **Risk:** Medium (may break inline styles)

2. **Hash-based CSP**
   - Compute SHA-256 hashes for known inline scripts (JSON-LD)
   - More restrictive but harder to maintain
   - **Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] No `unsafe-inline` or `unsafe-eval` in production CSP
- [ ] JSON-LD scripts still render correctly
- [ ] Dev mode still works (eval for hot reload)
