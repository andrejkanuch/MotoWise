---
title: "Stuck 'processing' diagnostics show infinite loading spinner"
category: ui-bugs
date: 2026-03-20
tags: [diagnostics, polling, timeout, mobile, react-query]
components: [apps/mobile/src/app/(tabs)/(diagnose)/[id].tsx, apps/mobile/src/app/(tabs)/(diagnose)/index.tsx]
---

## Problem

Tapping a recent diagnosis that has `status: 'processing'` in the database shows "Processing your diagnostic..." with a spinner forever. The screen polls every 3 seconds via `refetchInterval` but the status never changes because the backend AI processing already failed silently (e.g., mutation timeout, server crash mid-processing).

## Root Cause

The `submitDiagnostic` mutation creates a diagnostic record with `status: 'processing'`, then `await`s the AI analysis. If the mutation fails mid-flight (network timeout, server crash), the DB status stays `'processing'` permanently. The `[id].tsx` screen polls indefinitely with no timeout mechanism.

Additionally, the list screen (`index.tsx`) displayed these stuck records with misleading labels — title showed raw "processing" and severity badge defaulted to "Ok" even though no analysis occurred.

## Solution

**1. Time-based stuck detection on the detail screen** (`[id].tsx`):

```tsx
if (diagnostic.status === 'processing') {
  const createdMs = new Date(diagnostic.createdAt).getTime();
  const isStuck = Date.now() - createdMs > 2 * 60 * 1000;

  if (isStuck) {
    // Show failed state with "Try Again" button
  }
}
```

**2. Stop polling for stuck diagnostics**:

```tsx
refetchInterval: (query) => {
  const diag = query.state.data?.diagnosticById;
  if (diag?.status !== 'processing') return false;
  const age = Date.now() - new Date(diag.createdAt).getTime();
  return age < 2 * 60 * 1000 ? 3000 : false;
},
```

**3. Filter failed/stuck diagnostics from the list** (`index.tsx`):

```tsx
const diagnostics = (data?.myDiagnostics ?? []).filter((d) => {
  if (d.status === 'failed') return false;
  if (d.status === 'processing') {
    return Date.now() - new Date(d.createdAt).getTime() < 2 * 60 * 1000;
  }
  return true;
});
```

## Prevention

- When implementing polling-based UIs, always add a maximum polling duration or age-based cutoff.
- Backend fire-and-forget operations that update status should have a cleanup job for orphaned records stuck in intermediate states.
