---
title: "Measurement System (Metric/Imperial) + Ride Feature Design Loop"
category: architecture
date: 2026-03-22
tags: [measurement-system, metric, imperial, ride-feature, design-loop, tanstack-query, zustand, formatting]
modules: [packages/types, packages/design-system, apps/mobile, apps/api]
---

## Problem

The ride feature had multiple unit-handling issues:
1. Units were stored per-motorcycle (`mileage_unit` on motorcycles table), but display units should be a global user preference
2. Hardcoded imperial conversions (`* 2.237`, `/ 1609.34`, `mph`) scattered across 7+ screen files
3. Each screen had its own local `formatDistance`, `formatSpeed`, `formatElevation` functions with duplicated conversion logic
4. No way for European users to see km/km/h — the app always showed miles/mph
5. TanStack Query cache collision: home screen used `useQuery` and rides dashboard used `useInfiniteQuery` with the **same query key**, causing `Cannot read property 'length' of undefined` crash

## Root Cause

No centralized measurement system preference existed. Each file hardcoded its own unit conversion. The `DistanceUnit` type (`'km' | 'mi'`) was per-motorcycle, not per-user. When the rides dashboard was added, using `queryKeys.rides.all` for both `useQuery` (home widget) and `useInfiniteQuery` (rides list) caused TanStack Query v5 to corrupt the cache because these query types store data in incompatible structures (`{ pages: [...] }` vs flat object).

## Solution

### 1. `MeasurementSystem` type in shared package

```typescript
// packages/types/src/constants/enums.ts
export const MeasurementSystem = {
  METRIC: 'metric',
  IMPERIAL: 'imperial',
} as const;
export type MeasurementSystem = (typeof MeasurementSystem)[keyof typeof MeasurementSystem];
```

### 2. Centralized formatters accepting `MeasurementSystem`

```typescript
// apps/mobile/src/utils/ride-formatters.ts
import type { MeasurementSystem } from '@motovault/types';

export function formatDistance(meters: number, system: MeasurementSystem = 'metric'): string {
  if (system === 'imperial') {
    const miles = meters / 1609.34;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
// Same pattern for formatSpeed, formatElevation, formatSpeedValue, speedUnitLabel, etc.
```

### 3. Zustand store with locale auto-detection

```typescript
// apps/mobile/src/stores/auth.store.ts
measurementSystem: detectMeasurementSystem(), // reads getLocales()[0].measurementSystem
setMeasurementSystem: (system) => set({ measurementSystem }),
// Persisted via partialize to AsyncStorage
```

### 4. Simple hook for components

```typescript
// apps/mobile/src/hooks/use-measurement-system.ts
export function useMeasurementSystem(): MeasurementSystem {
  return useAuthStore((s) => s.measurementSystem);
}
```

### 5. Fix TanStack Query cache collision

```typescript
// Home widget uses a DIFFERENT query key than the rides dashboard
const ridesQuery = useQuery({
  queryKey: queryKeys.rides.list('home'),  // NOT queryKeys.rides.all
  queryFn: () => gqlFetcher(MyRidesDocument, { first: 10 }),
});

// Rides dashboard uses useInfiniteQuery with its own key
const { data } = useInfiniteQuery<MyRidesQuery>({
  queryKey: queryKeys.rides.all,  // Only used by useInfiniteQuery
  // ...
});
```

## Prevention

- **Never use the same query key for `useQuery` and `useInfiniteQuery`** — TanStack Query v5 stores them in incompatible cache structures
- **All formatting functions live in `ride-formatters.ts`** — no local format functions in screen files
- **All colors live in `palette.ts`** — no hardcoded hex/rgba in components
- **Use generated GraphQL types** (`import { type MyRidesQuery } from '@motovault/graphql'`) — never `any` for GraphQL data
- **`MeasurementSystem`** is the display preference; `mileage_unit` on motorcycle is for odometer data entry only
- These rules are documented in `CLAUDE.md` under "GraphQL Type Safety"

## Key Files

- `packages/types/src/constants/enums.ts` — `MeasurementSystem` type
- `apps/mobile/src/utils/ride-formatters.ts` — all formatting functions
- `apps/mobile/src/hooks/use-measurement-system.ts` — hook
- `apps/mobile/src/stores/auth.store.ts` — persistence + auto-detection
- `packages/design-system/src/palette.ts` — all color tokens (night mode, surfaces, accents)
- `apps/mobile/src/utils/map-styles.ts` — shared MapStyle type + MAP_STYLES constant
