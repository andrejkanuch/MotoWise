---
title: "feat: Show purchase price in expense dashboard with tooltip"
type: feat
status: active
date: 2026-03-25
---

# feat: Show Purchase Price in Expense Dashboard

## Overview

Display the motorcycle's purchase price in the expense dashboard so users can see their total cost of ownership. Add a tooltip informing users they can set/edit the purchase price in the bike edit screen.

## Proposed Solution

**No backend changes needed** — the expense dashboard screen already receives `motorcycleId` as a route param and the `MyMotorcycles` query already returns `purchasePrice`. We just need to:

1. Read the bike's `purchasePrice` from the existing motorcycles query cache
2. Add a "Total Cost" row in the expense dashboard hero section (purchase price + all-time expenses)
3. If no purchase price set, show a tappable tooltip/banner linking to edit-bike

## Implementation

### expense-dashboard.tsx changes

1. Read bike data from the existing `MyMotorcycles` query (already cached from the garage tab)
2. If `bike.purchasePrice` is set:
   - Show a "Total Cost of Ownership" metric: `purchasePrice + allTimeTotal`
   - Show the purchase price as a separate line item labeled "Bike Purchase"
3. If `bike.purchasePrice` is NOT set:
   - Show a subtle info banner: "Add your bike's purchase price in Edit Bike to see total cost of ownership"
   - Make it tappable → navigates to edit-bike screen

### summary-cards.tsx changes

Add a 4th pill "TOTAL" showing `purchasePrice + allTimeTotal` when purchase price is available.

## Acceptance Criteria

- [ ] Expense dashboard shows "Total Cost" pill when purchase price is set
- [ ] Info banner appears when purchase price is NOT set, linking to edit-bike
- [ ] Total Cost = purchase price + all-time expenses
- [ ] Tapping info banner navigates to edit-bike screen
