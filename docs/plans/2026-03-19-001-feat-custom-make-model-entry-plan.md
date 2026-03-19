---
title: "feat: Allow custom make/model entry for motorcycles not in NHTSA"
type: feat
status: active
date: 2026-03-19
---

# Allow Custom Make/Model Entry for Motorcycles Not in NHTSA

## Overview

Users cannot add motorcycles whose make or model isn't in the NHTSA vPIC database. This blocks users with Chinese brands, vintage bikes, custom builds, electric startups, or any non-US-registered manufacturer. The solution: add a "Use custom" fallback when NHTSA results don't match, in both the garage add-bike flow and the onboarding flow.

## Current State

| Screen | Custom Make | Custom Model |
|--------|------------|-------------|
| Onboarding `bike-make.tsx` | No | N/A |
| Onboarding `bike-model.tsx` | N/A | **Yes** (already implemented for `noApiResults`) |
| Garage `add-bike.tsx` | No | No |

**Key insight:** The onboarding model screen (`bike-model.tsx:317-368`) already has the pattern — when NHTSA returns no models, it shows a free-text `customModel` input. We need to extend this pattern to:
1. **Makes** — onboarding `bike-make.tsx` + garage `add-bike.tsx`
2. **Models** — garage `add-bike.tsx` (onboarding already done)

**Server-side:** The API already accepts any string for `make` and `model` — the Zod schema (`packages/types/src/validators/motorcycle.ts`) only validates `z.string().min(1).max(100)`. No API changes needed.

## Proposed Solution

Add a "Can't find your bike? Enter it manually" option that appears when search yields no results. Follow the existing `bike-model.tsx` pattern. Keep NHTSA as the primary source for autocomplete — custom entry is the fallback.

### UX Flow

**Makes (both onboarding + garage):**
1. User types in search — NHTSA results shown as before
2. If no results match, show: "Not in our database? Type your make manually" with a tappable action
3. Tapping switches to a free-text input mode
4. Custom make uses `makeId: 0` convention (already used in `bike-model.tsx:57`)
5. When a custom make is used, the model step immediately shows free-text input (since NHTSA won't have models for `makeId: 0`)

**Models (garage add-bike only, onboarding already done):**
1. Same pattern — if NHTSA returns no models for the selected make+year, show free-text input
2. Also show "Enter manually" option when search filter yields no results within existing models

## Acceptance Criteria

- [ ] **Garage add-bike:** User can type a custom make when no NHTSA results match their search
- [ ] **Garage add-bike:** User can type a custom model when no NHTSA models exist for their make+year, OR when search yields no results
- [ ] **Onboarding bike-make:** User can type a custom make (same as garage)
- [ ] **Onboarding bike-model:** Already works — verify no regression
- [ ] Custom make/model strings pass existing Zod validation (1-100 chars)
- [ ] Submit button works with custom values
- [ ] "Use custom" option only appears when search yields no results (not by default)
- [ ] Custom entries are visually distinct (e.g. italic label or different icon)
- [ ] All new UI strings added to all 12 locale files

## Implementation Plan

### Phase 1: Garage `add-bike.tsx`

**Custom Make:**
- Add `customMake` state (string)
- When `filteredMakes.length === 0 && makeSearch.length > 0`, show "Use '{makeSearch}' as custom make" button
- Tapping it sets `customMake = makeSearch` and clears `selectedMake`
- When `customMake` is set, skip the NHTSA models query (it won't return results for makeId 0)
- Show free-text model input immediately
- Update `isValid` check: `validYear && (!!selectedMake || customMake.trim()) && (!!selectedModel || customModel.trim())`
- Update `handleSubmit` to use `customMake || selectedMake.makeName` and `customModel || selectedModel.modelName`

**Custom Model:**
- Add `customModel` state (string)
- When `filteredModels.length === 0 && modelSearch.length > 0`, show "Use '{modelSearch}' as custom model" button
- Also show free-text model input when NHTSA returns empty models list (same as onboarding pattern)

### Phase 2: Onboarding `bike-make.tsx`

- Same pattern as garage: add "Use custom" fallback when `showNoResults` is true
- When custom make selected, store `makeId: 0` in onboarding store
- `bike-model.tsx` already handles `makeId: 0` gracefully — the NHTSA query is disabled when `makeId === 0`, and `noApiResults` triggers the free-text input

### Phase 3: Translations

- Add keys: `garage.useCustomMake`, `garage.useCustomModel`, `garage.customMakeHint`, `garage.customModelHint`
- Add keys: `onboarding.useCustomMake`
- Translate to all 12 locales

## Files to Modify

| File | Change |
|------|--------|
| `apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx` | Add custom make + custom model states and UI |
| `apps/mobile/src/app/(onboarding)/bike-make.tsx` | Add custom make fallback |
| `apps/mobile/src/i18n/locales/en.json` | Add translation keys |
| `apps/mobile/src/i18n/locales/{es,de,fr,it,pt-BR,ja,hi,th,id,tr,pl}.json` | Translate new keys |

## Edge Cases

- **Custom make → model step**: If user enters custom make, NHTSA models query returns nothing → free-text model input should show automatically
- **Switching back**: If user clears custom make and picks an NHTSA make, model selection should reset to NHTSA-powered dropdown
- **OEM schedule auto-population**: Will silently fail for custom makes — this is fine, already handled with try/catch
- **Motorcycle type detection**: `detectTypeFromModel()` in onboarding may not match custom model names — falls back to manual type selection (existing behavior)
