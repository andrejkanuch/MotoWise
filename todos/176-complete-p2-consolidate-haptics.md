---
status: complete
priority: p2
issue_id: "176"
tags: [code-review, mobile, duplication]
dependencies: []
---

# Inline haptics guard duplicated 10+ times — use utils/haptics.ts

## Problem Statement
Most v2 screens inline `if (process.env.EXPO_OS === 'ios') { Haptics.impactAsync(...) }` despite utils/haptics.ts providing triggerImpact() that handles the platform check.

## Fix
Replace all inline haptics guards with triggerImpact() from utils/haptics in: index.tsx, experience.tsx, goals.tsx, bike-setup.tsx, maintenance.tsx. Remove direct Haptics imports where no longer needed.
