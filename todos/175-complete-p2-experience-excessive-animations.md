---
status: complete
priority: p2
issue_id: "175"
tags: [code-review, mobile, performance, animation]
dependencies: []
---

# Experience screen runs 25+ concurrent infinite animations

## Problem Statement
`experience.tsx` — 14 TachBars + 5 Sparks + PulsingGlow + dead RoadLines dashOffset = 27 animation drivers. Too many for mid-range Android.

## Fix
1. Remove dead dashOffset animation in RoadLines (animated but never applied to any prop)
2. Reduce TachBars from 14 to 7
3. Consider removing Spark particles (decorative, 5 instances)
