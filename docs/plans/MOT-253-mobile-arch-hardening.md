# Execution Plan — MOT-253 Mobile Architecture Review: Maintenance & Hardening

**Branch:** `kanuchandrej/mot-253-mobile-architecture-review-maintenance-hardening` (off `origin/main`)
**Version bump:** `apps/mobile` `3.10.1` → `3.10.2` (maintenance/hardening batch; runtimeVersion policy = appVersion)
**Source report:** `docs/Mobile-Architecture-Review-2026-06-15.md`
**Epic:** MOT-253 · 15 sub-tickets MOT-254 → MOT-268

## Principles
- Each ticket is already a self-contained spec (exact `file:line`, change, rationale, acceptance). This plan adds **sequencing, commit grouping, risk, and verification**.
- One commit per ticket (or tight group). Mark each Linear ticket **Done** immediately after its commit lands.
- Keep `pnpm precheck` (lint + typecheck + test) green per logical group. Conventions: generated GraphQL types (no `any`), Biome (ESLint scoped to i18n only), `as const` not enums, palette tokens (no hardcoded colors), `date-fns`, no magic strings.
- Verify zero live references before any delete. Verify behavior parity for refactors.

## Sequence (low-risk → high-risk; dependency-aware)

### Wave 1 — Build/config quick wins (no runtime logic) ✅ safest first
| Ticket | Change | Risk | Verify |
|--------|--------|------|--------|
| MOT-258 | Declare `expo-file-system` in `package.json` (phantom dep) | Low | `npx expo-doctor`, typecheck |
| MOT-260 | Sync `.env.example` to superset of `EXPO_PUBLIC_*` keys | Low | diff vs `.env`/`.env.production` keys only (no secrets) |
| MOT-261 | Add prune script for ~3 GB `build-*.{aab,ipa}` + `dist/` | Low | script dry-run lists only gitignored artifacts |
| MOT-256 | Delete dead code (feed-ride-card, route-map-view, rider-profile, config/routes, phantom quiz route) | Low–Med | grep zero live refs each; typecheck |

### Wave 2 — State/perf/reliability quick wins
| Ticket | Change | Risk | Verify |
|--------|--------|------|--------|
| MOT-254 | Remove global `structuralSharing: false` (`query-client.ts:41`) | Med (app-wide) | typecheck; spot-check lists/charts still update; scope per-query only if a query truly needs `false` |
| MOT-259 | Symmetric kudos optimistic snapshot/rollback via `getQueriesData`/`setQueriesData` | Low | unit reasoning; typecheck |
| MOT-255 | `readAsStringAsync` → `new File(uri).base64()`; remove LogBox suppression | Low | mirror `image-upload.ts:40` pattern; typecheck |

### Wave 3 — Duplication consolidation
| Ticket | Change | Risk | Verify |
|--------|--------|------|--------|
| MOT-257 | One haversine (delete 3 copies, add coord-shape overloads), one polyline decoder (import canonical in hook) | Med | unit parity tests for haversine; typecheck/test |

### Wave 4 — Reliability hardening
| Ticket | Change | Risk | Verify |
|--------|--------|------|--------|
| MOT-262 | ride-sync queue: respect non-empty queue, break drain on first transient failure, clear MMKV buffer on graceful end, `captureException` + surface dead-letter | **High** (silent data loss) | new ordering/re-entrancy tests (also MOT-265) |
| MOT-263 | One in-flight refresh promise in `gql-auth-session`; drop redundant `queryCache.onError` refresh; don't clear sync queue on forced sign-out with unsynced ride | High | typecheck; reason through race; tests where feasible |
| MOT-264 | 36 `console.*` → `logger`/`captureException`; add `no-console` lint rule | Med | lint rule catches new violations; typecheck |
| MOT-265 | Tests: `updateStoreFromCustomerInfo`, sync-queue ordering/re-entrancy, `formatCurrency`, `auth.store`; shared jest mock factories | Low | `pnpm --filter mobile test` |

### Wave 5 — Maintainability/perf (larger)
| Ticket | Change | Risk | Verify |
|--------|--------|------|--------|
| MOT-266 | `expo-image` for remote list/card images (cachePolicy + recyclingKey); strip `as any`/`as never` nav casts; type hrefs as `Href` | Med | typecheck with typedRoutes; visual parity |
| MOT-268 | `queryOptions()` factories in `query-keys.ts`; register 21 ad-hoc inline keys (incl. duplicated `['rides','heatmap']`) | Med | typecheck; consumers compile |
| MOT-267 | Pick ONE primitive system (editorial.tsx); delete `profile/shared/*` + local dupes; decompose worst monolith **first increment** | **L — partial** | typecheck; visual parity. Full decomposition is explicitly multi-PR; land a meaningful first slice + note remainder on ticket. |

## MOT-267 scope note
Ticket is explicitly **L / multi-PR / chip-away**. This branch lands the primitive consolidation + one screen decomposition increment, then leaves the ticket with a documented remainder (do not mark fully Done unless the first increment satisfies its stated acceptance; otherwise leave In Progress with a comment).

## Closeout
1. `pnpm precheck` green on the whole branch.
2. Bump already applied (3.10.2).
3. Global branch review doc: `docs/reviews/MOT-253-branch-review.md` (per-ticket status, risk, test evidence, follow-ups).
4. Mark each shipped ticket Done in Linear; mark epic MOT-253 Done when all children resolved.
5. Open PR with value-first description linking the epic.

## Not applicable from generic pipeline
- `test-browser` / `feature-video` target web/CLI surfaces; this is a native RN app. Substitute: `pnpm --filter mobile test` + (if simulator available) a smoke launch. Note in PR.
