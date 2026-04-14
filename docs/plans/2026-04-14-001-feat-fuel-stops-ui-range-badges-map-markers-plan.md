---
title: "feat: Fuel stops UI — range badges, map markers, discovery cards"
type: feat
status: active
date: 2026-04-14
---

## Enhancement Summary

**Deepened on:** 2026-04-14
**Sections enhanced:** 6
**Research agents used:** repo-research-analyst, learnings-researcher, best-practices-researcher (Mapbox), framework-docs-researcher (TanStack Query), performance-oracle, architecture-strategist, code-simplicity-reviewer, spec-flow-analyzer

### Key Improvements
1. Use `ShapeSource` + `SymbolLayer` instead of `PointAnnotation` for fuel markers (better performance, supports clustering)
2. Merge `usePrimaryBikeId` and `useBikeFuelData` into a single `usePrimaryBikeFuelData` hook
3. Use `useMeasurementSystem()` for km/mi display consistency (from institutional learnings)
4. Add `fuelStops` namespace to `queryKeys.ts` for cache consistency

### Critical Learnings Applied
- **GraphQL contract drift** (docs/solutions): Always run `pnpm generate` after adding .graphql files; use `String!` not `ID!` for Supabase UUIDs in operations
- **Measurement system** (docs/solutions): Use `formatDistance` from `ride-formatters.ts` — never create local formatters
- **TanStack Query key collision** (docs/solutions): Use distinct query keys for route detail vs route list fuel data
- **Supabase client security** (docs/solutions): Fuel stops API is `@Public()` — verify it uses `SUPABASE_USER` (RLS), not admin client

---

# Fuel Stops UI — Range Badges, Map Markers, Discovery Cards

## Overview

Surface the existing fuel stops API (`fuelStopsNearRoute`) as visible UI across three mobile screens: route detail, trip planning map, and route discovery cards. The API already fetches fuel stations from OpenStreetMap (Overpass API) and computes personalized range summaries based on the user's bike tank size and fuel efficiency from fuel logs.

## Problem Statement

The fuel stops API exists but has zero frontend integration. Riders planning trips can't see:
- Whether they need to refuel on a route
- Where fuel stations are along the route
- At a glance which routes are within their bike's range

This is a practical, differentiating feature that competitors (Calimoto, REVER, Scenic) don't offer with personalized per-bike fuel range.

## Proposed Solution

### Phase 1: Route Detail — Fuel Range Badge + Map Markers

**Add a "Fuel Range Badge" to the route detail bottom sheet stats grid** (`apps/mobile/src/app/(modals)/route-detail.tsx:386-414`).

The existing stats grid already shows Distance, Elevation, Surface, Rating via the `StatBadge` component (line 500). Add fuel range as a tappable variant:

```
┌──────────────┐
│ Fuel Range   │
│ ⛽ No refuel │  ← green
└──────────────┘
```

Color logic:
- `stopsRequired === 0` → green (`palette.success500`) — "No refuel"
- `stopsRequired === 1` → yellow (`palette.warning500`) — "1 fuel stop"
- `stopsRequired >= 2` → red (`palette.danger500`) — "{n} fuel stops"

**Tapping the badge toggles fuel station markers on the map.**

#### Research Insights — Map Markers

**Use `ShapeSource` + `SymbolLayer` instead of `PointAnnotation`** for fuel markers. From @rnmapbox/maps best practices:

- `PointAnnotation` renders as React Native views — creates a native bridge per marker, poor performance with 20+ markers
- `ShapeSource` + `SymbolLayer` renders entirely on the GL thread — handles hundreds of markers without bridging overhead
- Supports built-in clustering via `cluster={true}` on `ShapeSource`
- Custom icons via `iconImage` referencing a loaded image resource

```tsx
// Preferred pattern: GeoJSON + SymbolLayer (not PointAnnotation)
const fuelStopsGeoJSON = useMemo(() => ({
  type: 'FeatureCollection' as const,
  features: (fuelStops ?? []).map(stop => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [stop.lng, stop.lat] },
    properties: { name: stop.name, osmId: stop.osmId },
  })),
}), [fuelStops]);

<MapboxGL.ShapeSource
  id="fuel-stops"
  shape={fuelStopsGeoJSON}
  cluster={true}
  clusterRadius={40}
>
  <MapboxGL.SymbolLayer
    id="fuel-stops-icons"
    style={{
      iconImage: 'fuel-pin', // loaded via MapboxGL.Images
      iconSize: 0.8,
      iconAllowOverlap: true,
      textField: ['get', 'name'],
      textSize: 11,
      textOffset: [0, 1.5],
      textColor: palette.neutral300,
      textOptional: true,
    }}
  />
</MapboxGL.ShapeSource>
```

**Load fuel pin icon** via `MapboxGL.Images`:
```tsx
<MapboxGL.Images images={{ 'fuel-pin': require('../../assets/fuel-pin.png') }} />
```

#### Files to create/modify

| File | Action | Description |
|------|--------|-------------|
| `apps/mobile/src/graphql/queries/fuel-stops-near-route.graphql` | **Create** | New GraphQL query |
| `apps/mobile/src/app/(modals)/route-detail.tsx` | **Modify** | Add fuel badge + ShapeSource markers + toggle |
| `apps/mobile/src/utils/fuel-range.ts` | **Create** | Shared computation + badge helpers |
| `apps/mobile/src/hooks/use-primary-bike-fuel-data.ts` | **Create** | Combined primary bike + fuel data hook |
| `apps/mobile/src/lib/query-keys.ts` | **Modify** | Add `fuelStops` namespace |
| `apps/mobile/assets/fuel-pin.png` | **Create** | 48x48 fuel pump icon (2x/3x variants) |
| `packages/graphql/src/generated/*` | **Regenerate** | Run `pnpm generate` |

#### GraphQL query

```graphql
# apps/mobile/src/graphql/queries/fuel-stops-near-route.graphql
query FuelStopsNearRoute($routeId: ID!, $bikeId: ID) {
  fuelStopsNearRoute(routeId: $routeId, bikeId: $bikeId) {
    fuelStops {
      osmId
      name
      lat
      lng
    }
    rangeSummary {
      effectiveRangeKm
      stopsRequired
      summary
    }
  }
}
```

#### Research Insights — TanStack Query Pattern

Use **dependent queries** with the `enabled` option. The fuel stops query depends on `routeId` being available. Fetch lazily (only when badge is visible in viewport):

```tsx
const { data: fuelData, isLoading: fuelLoading } = useQuery({
  queryKey: queryKeys.fuelStops.nearRoute(routeId, primaryBikeId),
  queryFn: () => gqlFetcher(FuelStopsNearRouteDocument, {
    routeId,
    bikeId: primaryBikeId,
  }),
  enabled: !!routeId,
  staleTime: 5 * 60 * 1000,  // 5 min — Overpass cached 24h server-side
  gcTime: 30 * 60 * 1000,    // Keep in cache 30 min after unmount
});
```

**Query keys** — add to `apps/mobile/src/lib/query-keys.ts`:
```typescript
fuelStops: {
  nearRoute: (routeId: string, bikeId?: string) =>
    ['fuelStops', 'nearRoute', routeId, bikeId] as const,
},
```

#### Combined Primary Bike + Fuel Data Hook

**Simplification** (from code simplicity review): merge `usePrimaryBikeId` and `useBikeFuelData` into one hook. The garage query is already cached — just extract what we need:

```tsx
// apps/mobile/src/hooks/use-primary-bike-fuel-data.ts
export function usePrimaryBikeFuelData() {
  const { data } = useQuery({
    queryKey: queryKeys.garage.list,
    queryFn: () => gqlFetcher(MyGarageDocument),
  });
  const bikes = data?.myGarage ?? [];
  const primary = bikes.find(b => b.isPrimary) ?? bikes[0];
  return {
    bikeId: primary?.id,
    // Tank/efficiency from metadata if available, else defaults
    tankLiters: primary?.metadata?.tankCapacityLiters ?? DEFAULT_TANK_LITERS,
    kmPerLiter: DEFAULT_KM_PER_LITER, // Server computes from fuel logs
  };
}
```

### Phase 2: Discovery Cards — "Can I Make It?" Indicator

**Add a small fuel icon + text to route cards on the discover feed.**

**Approach: Client-side estimate** (avoids N+1 queries). Since `distanceM` is already in the discover query, compute the estimate from the route distance + primary bike data:

```tsx
const stopsRequired = computeFuelStops(
  route.distanceM / 1000,
  bikeFuelData.tankLiters,
  bikeFuelData.kmPerLiter,
);
```

#### Research Insights — Performance

- **No API call per card** — pure math on already-fetched data
- **`usePrimaryBikeFuelData` caches via TanStack Query** — one fetch shared across all cards
- **`computeFuelStops` is a pure function** — no re-render concern
- **Wrap route card in `memo()`** — already done in existing `route-card.tsx`

#### Research Insights — Measurement System

From institutional learnings (`docs/solutions/architecture/measurement-system-and-ride-feature-design.md`):

- **Use `useMeasurementSystem()` hook** for metric/imperial display
- **Use `formatDistance()` from `ride-formatters.ts`** for range display — never create local formatters
- Badge labels should adapt: "240 km range" vs "149 mi range"

#### Files to modify

| File | Action | Description |
|------|--------|-------------|
| `apps/mobile/src/components/discover/route-card.tsx` | **Modify** | Add fuel indicator chip |
| `apps/mobile/src/utils/fuel-range.ts` | Already created in Phase 1 | Shared computation |

#### Discovery card indicator

```
┌──────────────────────────────────────────┐
│ Stelvio Pass                    ⛽ 0     │
│ 24.5 km · 1,808m ↑ · Paved    No refuel │
│ ★ 4.8 (127)                              │
└──────────────────────────────────────────┘
```

Small chip following existing badge pattern from `route-card.tsx`:
- `paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderCurve: 'continuous'`
- Icon (Fuel from lucide-react-native, 12px) + Text (fontSize 11, fontWeight 700) with `gap: 3`
- Color from `fuelBadgeColor(stopsRequired)`

### Phase 3: Shared Fuel Range Utility

```typescript
// apps/mobile/src/utils/fuel-range.ts
import { palette } from '@motovault/design-system';

const RANGE_SAFETY_FACTOR = 0.8;
export const DEFAULT_TANK_LITERS = 15;
export const DEFAULT_KM_PER_LITER = 18;

export function computeFuelStops(
  routeDistanceKm: number,
  tankLiters = DEFAULT_TANK_LITERS,
  kmPerLiter = DEFAULT_KM_PER_LITER,
): number {
  const effectiveRange = tankLiters * kmPerLiter * RANGE_SAFETY_FACTOR;
  if (effectiveRange <= 0) return 0;
  return Math.max(0, Math.ceil(routeDistanceKm / effectiveRange) - 1);
}

export function fuelBadgeColor(stopsRequired: number): string {
  if (stopsRequired === 0) return palette.success500;
  if (stopsRequired === 1) return palette.warning500;
  return palette.danger500;
}

export function fuelBadgeLabel(stopsRequired: number): string {
  if (stopsRequired === 0) return 'No refuel';
  if (stopsRequired === 1) return '1 fuel stop';
  return `${stopsRequired} fuel stops`;
}
```

## Technical Considerations

### Performance
- **Route detail**: Single GraphQL query with 24h server-side Redis cache for Overpass data. Negligible latency after first request.
- **Discovery cards**: Pure client-side math (no API call). Bike fuel data fetched once and cached via TanStack Query.
- **Map markers**: Use `ShapeSource` + `SymbolLayer` (GL-thread rendering), NOT `PointAnnotation` (RN bridge per marker). Supports clustering for dense areas. Handles 50+ markers without perf issues.
- **Query cache**: Use distinct keys — `queryKeys.fuelStops.nearRoute(routeId, bikeId)` — to avoid collision with route detail/list queries.

### Edge Cases
- **No bike in garage**: Use defaults (15L tank, 18 km/L). Show "Est." prefix on badge.
- **No fuel logs**: Server `getBikeFuelData` falls back to 18 km/L default.
- **Overpass API down**: Returns empty fuel stops array. Badge still shows range estimate (computed independently from route distance + bike data).
- **Very long routes** (1000+ km): Badge text caps at "5+ fuel stops" to avoid overflow.
- **Zero-distance routes**: `computeFuelStops` returns 0 — "No refuel" badge.
- **Unauthenticated users**: Fuel stops API is `@Public()`. Defaults used when no bikeId provided.
- **Metric/Imperial**: Use `useMeasurementSystem()` + `formatDistance()` from `ride-formatters.ts`.

### Accessibility
- Badge colors paired with text labels (not color-only communication)
- Fuel markers include `textField` for station name (visible on map)
- Badge is `Pressable` with `accessibilityRole="button"` and `accessibilityLabel="Toggle fuel stations. {summary}"`
- Map markers accessible via `SymbolLayer` built-in accessibility

### State Management
- `showFuelStops` toggle is local screen state (`useState`) — no Zustand needed
- Fuel data query uses TanStack Query with `staleTime: 5min`
- Primary bike fuel data reuses existing garage query cache — no extra fetch

## Acceptance Criteria

### Phase 1: Route Detail
- [ ] New `.graphql` query `FuelStopsNearRoute` created and codegen'd
- [ ] `fuelStops` namespace added to `queryKeys.ts`
- [ ] Fuel Range Badge appears in route detail stats grid with correct color
- [ ] Tapping badge toggles fuel station markers on the map via `ShapeSource` + `SymbolLayer`
- [ ] Markers show station name via `textField`
- [ ] Works without a bike (defaults shown with "Est." prefix)
- [ ] Loading state while fuel data fetches (skeleton or dim badge)
- [ ] Respects measurement system (km/mi)

### Phase 2: Discovery Cards
- [ ] Small fuel indicator chip on each route card
- [ ] Uses client-side estimate (no extra API call)
- [ ] Consistent colors with route detail badge
- [ ] Works for unauthenticated users (defaults)
- [ ] Card wrapped in `memo()` — no perf regression

### Phase 3: Shared Utility
- [ ] `fuel-range.ts` utility with `computeFuelStops`, `fuelBadgeColor`, `fuelBadgeLabel`
- [ ] Both route detail and discovery cards use shared utility
- [ ] `usePrimaryBikeFuelData` hook extracted and reusable
- [ ] Constants exported: `DEFAULT_TANK_LITERS`, `DEFAULT_KM_PER_LITER`

## Dependencies & Risks

- **Overpass API rate limiting**: Already handled server-side (1 req/sec, 24h Redis cache). Low risk.
- **MapboxGL marker performance**: Mitigated by using `ShapeSource`+`SymbolLayer` (GL thread) + clustering. Low risk.
- **Fuel logs accuracy**: Defaults apply when no logs. Badge indicates "Est." for transparency.
- **GraphQL contract drift**: Run `pnpm generate` after adding .graphql file. Pre-commit hook auto-runs codegen when .graphql files staged.

## Sources & References

### Internal
- Fuel stops API: `apps/api/src/modules/fuel-stops/fuel-stops.service.ts`
- Fuel stops resolver: `apps/api/src/modules/fuel-stops/fuel-stops.resolver.ts`
- Route detail screen: `apps/mobile/src/app/(modals)/route-detail.tsx`
- Route card component: `apps/mobile/src/components/discover/route-card.tsx`
- Primary bike pattern: `apps/mobile/src/components/home/use-home-data.ts:259`
- Discover routes query: `apps/mobile/src/graphql/queries/discover-routes.graphql`
- Query keys: `apps/mobile/src/lib/query-keys.ts`
- Ride formatters: `apps/mobile/src/utils/ride-formatters.ts`
- Map styles: `apps/mobile/src/utils/map-styles.ts`
- GraphQL schema: `apps/api/schema.graphql:491-508` (FuelRangeResult, FuelStop types)

### Institutional Learnings
- GraphQL contract drift: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- Measurement system: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
- Supabase client security: `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`
- Redis caching patterns: `docs/solutions/runtime-errors/redis-backed-infra-and-backend-hardening.md`
