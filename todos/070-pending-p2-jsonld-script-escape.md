---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, security, web, seo]
---

# JSON-LD needs </script> escape pattern

## Problem Statement

The `JsonLd` component uses `JSON.stringify(data)` directly in `dangerouslySetInnerHTML`. If any FAQ answer or description contains `</script>`, it could break out of the JSON-LD script tag, creating an XSS vector.

**File:** `apps/web/src/app/(marketing)/page.tsx`

## Findings

- Best-practices-researcher and security-sentinel both flagged this
- Standard mitigation: replace `</` with `<\\/` in the stringified JSON
- Current FAQ data doesn't contain `</script>` but future content might

## Proposed Solutions

1. **Add escape** (Recommended)
   - Change `JSON.stringify(data)` to `JSON.stringify(data).replace(/</g, '\\u003c')`
   - **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] JSON-LD output escapes `</script>` sequences
- [ ] Structured data still validates in Google Rich Results Test
