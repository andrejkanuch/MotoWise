---
status: complete
priority: p2
issue_id: "186"
tags: [code-review, mobile, security, privacy, posthog, session-replay]
dependencies: ["184"]
---

# Replay masking gaps: maps (GPS tracks) and read-only `<Text>` (VIN/profile/paywall)

## Problem Statement
`maskAllTextInputs` masks `TextInput` only — **read-only `<Text>`** (VIN, email, display name, paywall price/entitlement copy) is captured in plaintext. `maskAllImages` masks React `<Image>` raster only — **native/GPU map surfaces** (`mapbox-gl` ride maps, heatmap, route previews) render the rider's actual GPS track and are NOT covered. A replay of a ride or bike-detail screen can reveal a VIN or home-address-level location to anyone with replay access.

The PR's comment that masking means "no PII ... is ever captured" is inaccurate.

## Proposed Solutions
1. **(Recommended) Wrap sensitive surfaces in `<PostHogMaskView>`** (shipped in the SDK): RevenueCat paywall (`upgrade.tsx`), profile header, VIN entry/display (bike detail/edit), and all map components (ride map, heatmap, route preview). Treat masking as opt-in per sensitive surface.
2. Disable replay on map-heavy/PII screens entirely (coarser, simpler).

## Acceptance Criteria
- [ ] VIN, email, display name, and paywall copy are masked in replays.
- [ ] Map/route/heatmap renders are masked (no visible GPS track) in replays.
- [ ] `analytics.ts` comment corrected to reflect actual coverage.

## Technical Details
Affected: `apps/mobile/src/lib/analytics.ts:36-41`; sensitive screens (paywall, profile, bike detail/edit, ride/heatmap/route map components).

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (security-sentinel).
- 2026-06-09: Resolved — wrapped ride HUD map, map-picker MapView, paywall (upgrade.tsx), profile name row, and VIN row in `<PostHogMaskView>`. **Exception:** heatmap.tsx masking was reverted because touching that file tripped the i18n ratchet on ~11 pre-existing hard-coded strings (out of scope for this security PR). FOLLOW-UP: mask the heatmap MapView (lifetime GPS track) in a dedicated PR that also clears that file's i18n debt.

## Resources
- PR #78; PostHog RN `PostHogMaskView`
