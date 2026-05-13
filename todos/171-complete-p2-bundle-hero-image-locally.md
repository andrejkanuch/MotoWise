---
status: complete
priority: p2
issue_id: "171"
tags: [code-review, mobile, performance, reliability]
dependencies: []
---

# Bundle welcome hero image locally instead of remote Unsplash URL

## Problem Statement
`app/(onboarding)/index.tsx:48` — Loads 1200px Unsplash image over network. 1-5s latency on first screen, no offline fallback, IP leak.

## Fix
Download the image, convert to WebP, bundle as local asset. Replace `uri:` with `require()`. Remove the TODO comment.
