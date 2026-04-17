---
status: pending
priority: p3
issue_id: "147"
tags: [code-review, performance, mapbox]
dependencies: []
---

# Heatmap renders each segment twice (glow + line) → overdraw on low-end Android

## Problem Statement

`heatmap.tsx` stacks a glow `LineLayer` plus a line `LineLayer`, so every segment is rasterised twice. At 500 rides × ~200 points that's 100k segments × 2 = 200k line draws per frame. iPhone 13 handles it (~8ms/frame); low-end Android stalls 30–50ms at 300+ rides, visibly stuttering pan/zoom.

## Findings

- **Performance Reviewer:** `apps/mobile/src/components/map/heatmap.tsx:228-247` — two stacked LineLayers over the same features

## Proposed Solutions

### Option A: Single LineLayer with blur/gradient (Recommended)
Replace glow+line with one `LineLayer` using `lineBlur: 3` and a `line-gradient` expression. Visually similar, ~half the fragment work.
- Effort: Small

### Option B: Mapbox heatmap-layer (density raster)
One draw call regardless of feature count. Arguably more "Strava-style" — density by area, not per-line. Requires converting LineStrings to sampled points.
- Effort: Medium

## Technical Details

- **Affected files:** `apps/mobile/src/components/map/heatmap.tsx`

## Acceptance Criteria

- [ ] Single LineLayer (Option A) or HeatmapLayer (Option B) path in use
- [ ] Frame time on a Pixel 6a at 500 rides drops below 16ms
- [ ] Visual regression reviewed on iOS + Android

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |
