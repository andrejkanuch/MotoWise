---
status: complete
priority: p3
issue_id: "181"
tags: [code-review, mobile, dead-code]
dependencies: []
---

# Dead state and config: learningFormats, unused ONBOARDING_SCREENS fields, getScreenIndex, empty useFocusEffect

## Fix
- Remove learningFormats/setLearningFormats from onboarding.store.ts
- Remove section/canSkip/key from ONBOARDING_SCREENS, remove OnboardingScreenKey type, remove getScreenIndex()
- Remove empty useFocusEffect in bike-setup.tsx:91
- Remove MODAL_ROUTE from routes.ts
