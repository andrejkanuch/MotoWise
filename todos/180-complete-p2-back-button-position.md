---
status: complete
priority: p2
issue_id: "180"
tags: [code-review, mobile, ui-consistency]
dependencies: []
---

# Back button position inconsistency — 4px difference

## Problem Statement
goals.tsx uses top: insets.top + 40, while experience.tsx and maintenance.tsx use insets.top + 44. Visual jump during navigation.

## Fix
Standardize to insets.top + 44 across all screens. Consider extracting an OnboardingBackButton shared component.
