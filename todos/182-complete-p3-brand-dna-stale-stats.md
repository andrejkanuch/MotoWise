---
status: complete
priority: p3
issue_id: "182"
tags: [code-review, mobile, data-integrity]
dependencies: []
---

# brand-dna.ts duplicates fleet stats already fetched live

## Fix
Remove riders/models/rank from BRAND_DNA entries. Keep only type/tagline/serviceInterval. Extract duplicate normalization into single normalizeMakeName() helper.
