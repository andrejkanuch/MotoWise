---
title: "feat: Share Activity — Visual ride cards with platform-specific sharing"
type: feat
status: active
date: 2026-05-25
deepened: 2026-05-25
---

# Share Activity — Visual Ride Cards with Platform-Specific Sharing

## Enhancement Summary

**Deepened on:** 2026-05-25
**Agents used:** TypeScript reviewer, Architecture strategist, Performance oracle, Security sentinel, Frontend races reviewer, Pattern recognition specialist, Spec flow analyzer, Best practices researcher, Framework docs researcher

### Critical Blockers (must resolve before implementation)

1. **`rideNumber` does not exist in API** — `Ride` GraphQL type has no `rideNumber` field. Either add a DB column + migration + resolver, or compute client-side by counting rides older than this one.
2. **`elevationPeakM` does not exist in API** — Must derive from max altitude in waypoints data. Waypoints only fetched for owner viewers.
3. **Map snapshot generation unspecified** — Pre-capture from the existing MapboxGL MapView on ride-detail via `mapRef.current.takeSnap()` after `onDidFinishLoadingMap`. Cache to file system with key `share-map-{rideId}`.
4. **`NSPhotoLibraryAddUsageDescription` missing** from app.config.ts — will crash on iOS when saving to Photos. Must add before shipping.
5. **`react-native-share` needed** (not just built-in `Share` API) — built-in `Share` cannot share images. Also needed for Instagram Stories pasteboard image handling. Facebook App ID required since Jan 2023.
6. **Fallback cards when route/elevation data missing** — Rides with no polyline cannot render Map Hero or Route Print. Define: hide from carousel (dynamic card count + dot count) or show placeholder.

### Key Architecture Changes (from agent reviews)

1. **Use MapPickerSheet overlay pattern** (absolute-positioned Animated.View + scrim) instead of `<Modal>`. Already battle-tested in ride-detail. Avoids Android Modal issues and gives full Reanimated animation control.
2. **Use `react-native-share`** library for all platform-specific sharing (Instagram Stories, WhatsApp). Install alongside `react-native-view-shot` and `expo-media-library`.
3. **Use palette tokens** (they ARE hex already). Add missing share card colors to `palette.ts` — do NOT hardcode hex values in components.
4. **Rename PR → PB** throughout: `pbSpotlight` not `prSpotlight`, `pbType` not `prType`. Matches existing `pb-toast.tsx` and `PB_TOAST_SEEN` convention.
5. **Bare SVG `<Path>` for charts** — do NOT use gifted-charts in share cards. Pre-compute SVG path strings from waypoint data. Saves 150-200ms per card.
6. **State machine for capture pipeline** — IDLE → CAPTURING → HANDING_OFF → IDLE. Prevents double-taps, racing captures, and zombie state.
7. **Lazy render: active card only + prefetch next** — never hold >2 full-res PNGs in memory. Cache to `FileSystem.cacheDirectory` (not MMKV).
8. **Revise 80ms sheet open target** to 300ms (realistic with animation) or use `animationType="none"` + custom Reanimated SlideInUp.

### New Dependencies to Install

```bash
cd apps/mobile
npx expo install react-native-view-shot expo-media-library
pnpm add react-native-share
```

Config plugins to add to `app.config.ts`:
- `expo-media-library` with `photosPermission` and `savePhotosPermission` strings
- `react-native-share` with `LSApplicationQueriesSchemes` for `instagram-stories`, `instagram`, `whatsapp`
- Add `NSPhotoLibraryAddUsageDescription` to `ios.infoPlist`

## Overview

Upgrade the existing text-only ride sharing (Phase 0.5 in `share-ride.ts`) to a Strava-style visual share flow. Users tap the share button on Ride Detail, a bottom sheet slides up with a swipeable carousel of 5 beautifully designed card variants, and they pick a destination (Instagram Story, WhatsApp, iMessage, Save Image, Copy Link, or system share sheet).

This is Phase 1.5 as noted in the existing `share-ride.ts` comment: *"Phase 1.5 will add: react-native-view-shot image capture, multi-card sheet, IG Story / WhatsApp deep links."*

## Problem Statement / Motivation

Current sharing is plain text only — no visual card, no map, no stats. Riders want to show off their rides visually on social media. A beautiful share card with map, stats, and brand presence:
1. Drives organic growth via social proof (each share = free marketing)
2. Increases user satisfaction and pride after completing a ride
3. Strengthens brand awareness with "MOTOVAULT" watermark on every card

## Proposed Solution

### Architecture

```
ride-detail.tsx
  └── handleShare → opens ShareActivitySheet (modal)
        ├── Card Carousel (5 variants, horizontal ScrollView with snap)
        │   ├── MapHeroCard
        │   ├── EditorialDarkCard
        │   ├── PrSpotlightCard (auto-selected when isPB)
        │   ├── RoutePrintCard
        │   └── ElevationStoryCard
        ├── Page Dots
        └── Destination Grid (5×2)
              ├── Instagram Story → URL scheme handoff
              ├── Instagram Messages → system share filtered
              ├── WhatsApp → system share filtered
              ├── Message → system share with image
              ├── MotoVault DM → stub (toast)
              ├── Save Image → CameraRoll
              ├── Copy Link → Clipboard + toast
              └── More → UIActivityViewController
```

### Data Flow

```
RideDetailPayload (from GetRideQuery)
  → transform to RideShareData (local type)
    → passed to each CardVariant component
      → react-native-view-shot captures at 1080×1920
        → PNG file URI → destination handler
```

## Technical Considerations

### New Dependencies
- **react-native-view-shot** — image capture (requires Expo dev client rebuild, NOT Expo Go compatible)
- **expo-media-library** — save to Photos (already likely in project, verify)
- No new native modules beyond these two

### Critical Gotchas (from docs/solutions/)

1. **oklch colors invisible in view-shot** — React Native's inline style engine does NOT support oklch(). All colors in captured card views MUST use hex/rgb palette values, never oklch tokens. This will silently produce blank/invisible elements otherwise. (Source: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`)

2. **Gesture conflicts in bottom sheets** — Carousel swipe inside a BottomSheet will conflict with sheet drag-to-dismiss. Use `activatePointersOnLongPress: true` or explicit gesture handler priority. (Source: `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`)

3. **Haptics in ONE place only** — Fire haptics in either the store action OR the UI handler, never both (causes double vibration). (Source: `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`)

4. **Image aspect ratios** — Generate master at 9:16 (1080×1920) for Stories. Center-crop to 4:5 (1080×1350) for feed posts. Compose key content in center frame so crop doesn't lose anything. (Source: `docs/solutions/integration-issues/gemini-autodraft-social-worker.md`)

5. **React 19 Strict Mode** — Pre-selection logic (default card variant when isPB) must be in `useEffect`, not render body.

### Performance (deepened by Performance Oracle)

**Rendering strategy — Hybrid lazy/eager:**
1. **Sheet opens (<300ms):** Mount 5 lightweight preview card components at 222×396. No view-shot capture. No MapboxGL or gifted-charts imports in the sheet component tree.
2. **Eagerly render active card (index 0):** After Modal mounts, `useEffect` triggers `captureRef` for card 0 only. Write PNG to `FileSystem.cacheDirectory`. Show shimmer on destination buttons until ready.
3. **Lazy render on carousel swipe:** When user swipes to card N, trigger capture if not cached. Prefetch card N+1 in background.
4. **On destination tap:** Active card's PNG is already on disk. Pass file URI to handler. If not ready (race), show brief spinner.

**Critical performance rules:**
- **Never hold >2 full-res PNGs in memory** — each 1080×1920 RGBA = ~8.3MB. Five = ~41MB, dangerously close to jetsam on 4GB devices.
- **Bare SVG `<Path>` for charts** — do NOT use `react-native-gifted-charts` in share cards. Pre-compute path `d` strings from downsampled waypoints. A bare `react-native-svg` Path with 60 points: <30ms. A gifted-charts LineChart: 150-250ms.
- **Pre-capture map snapshot from existing MapView** — add `useEffect` in ride-detail.tsx that calls `mapRef.current.takeSnap()` after `onDidFinishLoadingMap`. Cache to `share-map-{rideId}` in file system. Sheet reads cached image instead of mounting a new MapView.
- **Replace shadows with gradient overlays** in card designs — shadows are O(pixels × radius) vs constant-time gradients.
- **Render offscreen for 1 frame before capture** — mount at `position: 'absolute', right: -1100` (NOT `opacity: 0` — causes blank captures on some devices). Use `collapsable={false}` on Android.
- **PixelRatio for exact dimensions:**
  ```typescript
  const scale = PixelRatio.get();
  const CARD_W = 1080 / scale; // e.g. 360 on 3x device
  const CARD_H = 1920 / scale;
  ```

**Cache strategy:**
- **Location:** `FileSystem.cacheDirectory` (expo-file-system), NOT MMKV. MMKV stores in memory-mapped files — multi-hundred-KB PNGs bloat the mapped region.
- **Key format:** `share-card-{rideId}-{variant}-{ride.updatedAt}.png` — auto-invalidates when ride data changes.
- **Eviction:** Delete all share cards for a ride when ride is deleted (hook into `clearRideData`). Sweep on app launch: evict cards older than 30 days. Max 50 rides × 5 variants = 250 images cap.
- **Cleanup after share:** Delete temp files in `finally` block of share handler.

### Privacy (deepened by Security Sentinel)
- No GPS coordinates logged to analytics events
- Share cards show map snapshot (rasterized image, no raw coords) and aggregate stats only
- `react-native-view-shot` captures do NOT contain EXIF GPS tags (rasterized from UI, not camera)
- Never log Mapbox static image URLs to analytics (they encode bounding box + API token)
- Consider creating a `PublicRide` GraphQL type that omits `userId` and `motorcycleId` from the public ride response
- Share card components must accept ONLY formatted display strings as props — never raw ride objects or user session data
- Clear pasteboard after returning from Instagram (3-5s delay via `setTimeout` with cleanup ref)
- Add `instagram-stories` and `whatsapp` to `LSApplicationQueriesSchemes` in app.config.ts

## Implementation Phases

### Phase 1: Card Renderer + 5 Variants (PR1)

**New files:**
- `apps/mobile/src/components/share/share-card-types.ts` — `RideShareData` type, `CardVariant` enum, transform helper
- `apps/mobile/src/components/share/cards/map-hero-card.tsx` — Map Hero variant
- `apps/mobile/src/components/share/cards/editorial-dark-card.tsx` — Editorial Dark variant
- `apps/mobile/src/components/share/cards/pr-spotlight-card.tsx` — PR Spotlight variant
- `apps/mobile/src/components/share/cards/route-print-card.tsx` — Route Print variant (cream)
- `apps/mobile/src/components/share/cards/elevation-story-card.tsx` — Elevation Story variant
- `apps/mobile/src/components/share/cards/shared-card-elements.tsx` — Shared elements: wordmark, stat footer, route silhouette SVG
- `apps/mobile/src/components/share/render-share-card.ts` — `renderShareCard()` function using view-shot

**Type definition (refined by TypeScript + pattern reviews):**
```typescript
// share-card-types.ts

export const CARD_VARIANTS = {
  mapHero: 'mapHero',
  editorialDark: 'editorialDark',
  pbSpotlight: 'pbSpotlight',       // PB not PR — matches pb-toast.tsx convention
  routePrint: 'routePrint',
  elevationStory: 'elevationStory',
} as const;

export type CardVariant = (typeof CARD_VARIANTS)[keyof typeof CARD_VARIANTS];

// Use Object.values(CARD_VARIANTS) for carousel iteration — don't maintain a separate array

export type PbCategory = 'topSpeed' | 'longestRide' | 'mostElevation';

/** [longitude, latitude] — GeoJSON order, matching Mapbox convention */
type LngLat = [longitude: number, latitude: number];

// Discriminated union eliminates impossible states (isPB:true + pbType:null)
type PbInfo =
  | { isPB: false; pbType: null; prevPbValue: null }
  | { isPB: true; pbType: PbCategory; prevPbValue: number | null };

export type RideSharePayload = {
  rideId: string;
  rideName: string;
  rideNumber: number | null;      // BLOCKER: not in API yet — compute client-side or add field
  /** ISO 8601 date string, e.g. "2026-05-25T14:30:00Z" */
  date: string;
  distanceM: number;
  durationS: number;
  elevationGainM: number | null;
  elevationPeakM: number | null;  // BLOCKER: derive from max(waypoints.altitude)
  /** Altitude in meters, sampled at equal distance intervals along the route */
  elevationProfile: number[];
  maxSpeedMps: number | null;
  routeCoordinates: LngLat[];
  mapSnapshotUri: string | null;
  bikeName: string | null;
  measurementSystem: MeasurementSystem;
} & PbInfo;

// Transform function: single source of truth for all conversions
export function transformRideToSharePayload(
  ride: RideDetailPayload,
  waypoints: WaypointData[],
  personalRecords: RideRecord[],
  opts: { measurementSystem: MeasurementSystem; bikeName: string | null },
): RideSharePayload { /* ... */ }

// Destination handler types — structured errors, exhaustive map
export type ShareDestination =
  | 'instagramStory' | 'instagramMessages' | 'whatsapp'
  | 'message' | 'motovaultDm' | 'saveImage' | 'copyLink' | 'systemShare';

export type ShareResult =
  | { success: true }
  | { success: false; reason: 'unavailable' | 'cancelled' | 'denied' | 'error'; message?: string };

export type DestinationHandler = (imageUri: string, deepLink: string) => Promise<ShareResult>;

// Exhaustive handler registry — TypeScript errors if a destination is missing
export const DESTINATION_HANDLERS: Record<ShareDestination, DestinationHandler> = { /* ... */ };
```

**Card variant visual spec (from design prompt):**

| # | Variant | Background | Key Elements |
|---|---------|-----------|--------------|
| 1 | Map Hero | Full-bleed map snapshot + dark gradient bottom 60% | Wordmark top-left, PB copper pill top-right, eyebrow date, title (Plus Jakarta + Instrument Serif italic), 3-col stats footer |
| 2 | Editorial Dark | `palette.neutral950` (#0c0b09) | Wordmark + date header, centered "Ride no. 014" overline, huge serif italic title, route silhouette, 3-col stats footer |
| 3 | PR Spotlight | Dark + copper radial glow top | "PERSONAL RECORD" copper pill, massive hero number (e.g. "137 km/h"), serif italic "Top speed", mono diff "+18 km/h · prev. 119 km/h", ride name footer |
| 4 | Route Print | Cream `#f1ebdd` | Wordmark + date, route drawn large in copper, eyebrow + title + inline mono stats |
| 5 | Elevation Story | Dark | Wordmark + "ELEV PROFILE" label, elevation chart hero with peak marker + altitude callout, title, 3-col stats (Gain · Peak · Distance) |

**Colors (hex only — no oklch for view-shot!):**
- Copper: `#c8772c` (var --copper in prototype), copper-2: `#d9883a`, copper-soft: `#e89d5a`
- Route: `#c8772c`, route-bright: `#e25822`
- Emerald: `#2bb673`, danger: `#d04a3c`
- Dark sheet bg: `#14110d`, card dark bg: `#0e0c0a`
- Cream (Route Print): `#f1ebdd`, dark text on cream: `#1a1612`
- Text light: `#f2efe9`, text muted: `rgba(255,255,255,0.5-0.72)`
- PR spotlight bg: `radial-gradient(ellipse at top, rgba(200,119,44,0.4) 0%, transparent 55%), #0b0907`
- Map gradient: `linear-gradient(180deg, transparent 0%, rgba(8,6,4,0.78) 70%, rgba(8,6,4,0.92) 100%)` over bottom 64%

**Typography in cards (exact from prototype):**
- Display/body: Plus Jakarta Sans 400/500/600/700/800 (load via expo-font or Google Fonts)
- Italic accents: Instrument Serif regular+italic (load via expo-font)
- Data labels/numerics: Geist Mono 400/500/600/700 (load via expo-font, fallback: `process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace'`)
- Wordmark: Geist Mono 8.5px weight 700, letter-spacing 0.22em, uppercase
- Card title: Plus Jakarta Sans 20px weight 700, letter-spacing -0.022em
- Stat label: Geist Mono 7.5px weight 600, letter-spacing 0.16em, uppercase
- Stat value: Plus Jakarta Sans 17px weight 700, letter-spacing -0.022em, tabular-nums
- Stat unit: 10px weight 500, muted color
- Eyebrow: Geist Mono 8.5px weight 600, letter-spacing 0.18em, uppercase
- PR big number: Plus Jakarta Sans 96px weight 800, letter-spacing -0.045em, tabular-nums
- PR unit: 24px weight 600, copper-soft color

**Card dimensions (from prototype):**
- On-screen preview: 222×396px (9:16 ratio), border-radius 20px
- Card gap in carousel: 14px
- Export: 1080×1920px (scale factor ≈4.86x handled by view-shot)
- Card shadow: `0 18px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)`
- Content padding: 14px from edges
- Stats grid: 3 columns, 4px gap, 12px padding-top with 1px top border rgba(255,255,255,0.2)

**Wordmark SVG (bike glyph):**
```
M 2 11 h 2 l 1.5-5 L 7 9 l 1.5-3 L 10 11 h 2
(14×14 viewBox, stroke="#fff" stroke-width="2" stroke-linecap="round")
```
14×14px mark with copper background (#c8772c), border-radius 4px

**Route silhouette SVG:**
```
M 290 240 C 320 290, 332 360, 320 410 C 305 470, 250 510, 195 510
C 130 510, 80 480, 70 410 C 60 340, 80 270, 130 235 C 175 200, 240 200, 290 240 Z
```
With start marker (emerald #2bb673 filled circle) and end marker (danger #d04a3c ring)

**Share sheet dimensions:**
- Sheet: top at 134px from screen top (≈75% height), border-radius 28px top
- Handle: 38×4px, border-radius 99px, rgba(255,255,255,0.18), margin 7px auto 0
- Header: grid 3-col (1fr auto 1fr), padding 14px 20px 12px
- Close button: 15px weight 500, rgba(255,255,255,0.85)
- Title: 16px weight 700, #f2efe9, centered
- Carousel wrap height: 416px, cards start 12px from top
- Dots: 6×6px, gap 6px, active: 18px wide + rgba(255,255,255,0.92), inactive: rgba(255,255,255,0.25)
- "Share to" label: 14px weight 700, padding 4px 22px 12px
- Icon grid: 5 columns, column-gap 4px, row-gap 18px, padding 0 12px 26px
- Icon circles: 50×50px, border-radius 999px
- Neutral icon bg: rgba(255,255,255,0.10)
- Icon labels: 11px weight 500, rgba(255,255,255,0.82), max-width 64px

**Scrim behind sheet:** rgba(8,6,4,0.62), backdrop-filter blur(2px)

**Pulse glow on share FAB:**
```css
animation: pulse-glow 2.2s ease-in-out infinite;
0%,100%: box-shadow: 0 0 0 4px rgba(200,119,44,0.22), 0 0 24px rgba(200,119,44,0.55); scale(1)
50%: box-shadow: 0 0 0 10px rgba(200,119,44,0.14), 0 0 38px rgba(200,119,44,0.85); scale(1.06)
```

**Toast:**
- Position: centered bottom 64px
- Padding: 12px 18px, border-radius 14px
- Background: rgba(255,255,255,0.95), text: #14110d
- Font: Plus Jakarta Sans 14px weight 600
- Check bubble: 22×22px copper circle with white check icon
- Shadow: 0 12px 32px rgba(0,0,0,0.4)

### Phase 2: Share Sheet UI (PR2)

**New files:**
- `apps/mobile/src/components/share/share-activity-sheet.tsx` — Main sheet component
- `apps/mobile/src/components/share/share-destination-grid.tsx` — 5×2 grid of destination icons
- `apps/mobile/src/components/share/share-card-carousel.tsx` — Horizontal scroll carousel with snap + dots

**Sheet behavior (revised by Architecture Strategist):**
- Use **MapPickerSheet overlay pattern** (absolute-positioned `Animated.View` with `Pressable` scrim) — NOT `<Modal>` or `@gorhom/bottom-sheet`. Already battle-tested in `map-picker-sheet.tsx` on the same screen. Avoids Android Modal issues (status bar flicker, back-handler conflicts, inability to stack). Gives full Reanimated animation control.
- Animate in with `SlideInUp.duration(300)` from reanimated — realistic replacement for the 80ms target.
- Background: `palette.surfaceDark` (already hex `#141210`)
- Scrim: `rgba(8,6,4,0.62)` with `backdropFilter: blur(2px)` — scrim is a `Pressable` that dismisses on tap
- Top corner radius: 28px via borderTopLeftRadius/borderTopRightRadius
- Drag handle: 38×4px rounded bar. Dismiss gesture ONLY on handle bar + header area, NOT carousel region (prevents gesture conflict). PanResponder dead zone: only activate when `dy > 30 AND dx < 15`.

**Carousel (revised per Architecture + Framework Docs):**
- Native `<ScrollView horizontal>` with `snapToOffsets` (NOT `snapToInterval` — more reliable across screen sizes)
- Precompute offsets: `const offsets = cardIndices.map(i => i * (CARD_WIDTH + CARD_GAP))`
- Card width: 222pt fixed (matches prototype). Side padding: `(SCREEN_WIDTH - 222) / 2` to center first/last card with peek.
- `decelerationRate="fast"`, `snapToAlignment="start"`
- Page dots: dynamic count (cards may be hidden if no route data). Active: 18px wide + `rgba(255,255,255,0.92)`. Inactive: 6×6px + `rgba(255,255,255,0.25)`.
- Track active index via `onMomentumScrollEnd` + scroll offset calculation
- `React.memo` on each card preview with stable data references

**Destination grid (from prototype spec):**
- 5 columns, 2 rows (matching prototype `grid-template-columns: repeat(5, 1fr)`)
- Row 1: Instagram Story, Instagram Messages, WhatsApp, Message, MotoVault DM
- Row 2: Save Image, Copy Link, More
- Icon circles: 50×50px, border-radius 999
- Neutral icon bg: `rgba(255,255,255,0.10)` for Save/Copy/More
- Brand logos: custom SVG components for Instagram gradient, WhatsApp green, Messages green gradient (simplified outline icons for trademark compliance)
- Labels: 11px weight 500, `rgba(255,255,255,0.82)`, max-width 64px
- All destinations disabled (dimmed to 0.5 opacity) while `shareState !== IDLE`

**Integration:**
- Modify `ride-detail.tsx` handleShare to open ShareActivitySheet instead of calling `shareRide()` directly
- Pass `RideShareData` derived from `ride` (RideDetailPayload) + `waypoints` + personal records

### Phase 3: Destination Handlers + State Machine (PR3)

**New files:**
- `apps/mobile/src/components/share/share-destinations.ts` — All destination handler functions
- `apps/mobile/src/components/share/use-share-pipeline.ts` — State machine hook

**State machine (critical — from Races Review):**
```typescript
// use-share-pipeline.ts
const SHARE_STATE = { idle: 'idle', capturing: 'capturing', handingOff: 'handingOff' } as const;
type ShareState = (typeof SHARE_STATE)[keyof typeof SHARE_STATE];

// All destination taps refused when state !== 'idle'
// finally block ALWAYS returns to 'idle' (even on error)
// Visual: dim destination grid + show spinner when busy
```

**State matrix to cover:**

| State | User action | Behavior |
|---|---|---|
| IDLE + fonts loading | Tap destination | Refuse, show shimmer |
| IDLE + fonts ready | Tap destination | Begin capture → CAPTURING |
| CAPTURING | Tap another destination | Refuse (debounce) |
| CAPTURING | Dismiss sheet | Cancel capture, cleanup, → IDLE |
| HANDING_OFF | Tap another destination | Refuse |
| HANDING_OFF | App not installed | Return to IDLE, clipboard untouched |
| HANDING_OFF | Permission denied | Show Settings alert, → IDLE |
| Toast visible | Dismiss sheet | Cancel toast timer (useRef cleanup) |

**Handlers (revised — uses `react-native-share`):**

| Destination | Implementation |
|---|---|
| Instagram Story | **CHECK `Linking.canOpenURL('instagram-stories://')` BEFORE setting pasteboard.** Then `Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, backgroundImage: imageUri, appId: EXPO_PUBLIC_META_APP_ID, attributionURL: deepLink })`. If not installed → App Store link. Clear pasteboard after 3-5s. |
| Instagram Messages | `Share.shareSingle({ social: Share.Social.INSTAGRAM, url: imageUri })` |
| WhatsApp | `Share.shareSingle({ social: Share.Social.WHATSAPP, url: imageUri, message: deepLink })`. On Android API 30+: set `useInternalStorage: true`. |
| Message | `Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' })` — routes to Messages on iOS |
| MotoVault DM | Stub: show toast "Coming soon" with `Haptics.notificationAsync` |
| Save Image | Check `MediaLibrary.getPermissionsAsync()` → if denied + !canAskAgain → Settings redirect alert. Otherwise `requestPermissionsAsync()` → `saveToLibraryAsync(imageUri)` → toast. |
| Copy Link | `Clipboard.setStringAsync(deepLink)` + "Link copied" toast (2s auto-dismiss with ref cleanup) |
| More | `Sharing.shareAsync(imageUri, { mimeType: 'image/png' })` — full system share sheet. Note: on Android, RN's built-in `Share.share` does NOT support `url` for images — use `expo-sharing`. |

**Deep link format:** `https://motovault.app/r/${rideId}` (already configured in app.config.ts intent filters)

**Alert pattern (before external app handoff):**
```typescript
// IMPORTANT: check canOpenURL BEFORE showing alert and BEFORE touching pasteboard
const canOpen = await Linking.canOpenURL('instagram-stories://share');
if (!canOpen) {
  Alert.alert('Instagram not installed', 'Install Instagram to share stories.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'App Store', onPress: () => Linking.openURL('https://apps.apple.com/app/instagram/id389801252') },
  ]);
  return; // Pasteboard untouched
}
Alert.alert(
  'Open in "Instagram"?',
  '"MotoVault" will share your ride card to Instagram.',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open', isPreferred: true, onPress: () => handleInstagramStory(imageUri) },
  ]
);
```

**Font readiness gating (from Races Review):**
```typescript
// Per-card readiness — do NOT capture until fonts + images are loaded
const readyToCapture = fontsLoaded && mapImageLoaded;
// Wait 1 requestAnimationFrame tick after ready for layout engine to settle
```

**Toast timer cleanup (from Races Review):**
```typescript
// Every setTimeout MUST have a cancel path via useRef
// Cancel in: sheet dismiss, component unmount, new toast overriding previous
const toastTimerRef = useRef<{ cancel: () => void } | null>(null);
useEffect(() => () => toastTimerRef.current?.cancel(), []);
```

**PB auto-selection guard (from Races Review):**
```typescript
// Only auto-select on initial mount, never override user's swipe
const hasAutoSelected = useRef(false);
useEffect(() => {
  if (hasAutoSelected.current) return;
  if (isPB && pbType === 'topSpeed') {
    scrollViewRef.current?.scrollTo({ x: pbSpotlightIndex * cardWidth, animated: false });
    hasAutoSelected.current = true;
  }
}, [isPB, pbType]);
```

### Phase 4: Polish + Acceptance (PR4)

**Tasks:**
- [ ] Auto-select PB Spotlight card when `isPB && pbType === 'topSpeed'` (via `useEffect` with `hasAutoSelected` ref guard — not render body per React 19 rule, never override user's swipe)
- [ ] Pulse-glow animation on share FAB — use `useSharedValue` initialized once (not reset on re-render from TanStack Query refetch). `withRepeat(withTiming(1.06, { duration: 1100 }), -1, true)`. Opt-out after first interaction.
- [ ] VoiceOver: `accessibilityRole="adjustable"` on carousel with increment/decrement handlers (swipe-left/right in VoiceOver navigates elements, not scroll). Each card: `accessibilityLabel="Map Hero card, 29 kilometers, 33 minutes"`. Each destination: `accessibilityLabel="Share to Instagram Story"`.
- [ ] Analytics events: `SHARE_SHEET_OPENED`, `SHARE_CARD_SWIPED { variant }`, `SHARE_CARD_RENDERED { variant, renderMs }`, `SHARE_DESTINATION_TAPPED { destination, variant }`, `SHARE_COMPLETED { destination, variant }` — NO GPS coordinates, NO imageUri, NO rideId in event properties (privacy)
- [ ] i18n: Add share-related strings to all 13 locale files. Card strings to translate: stat labels, "Share Ride", "Close", "Share to", destination names, "Link copied", "Image saved", "Coming soon". Brand strings NOT translated: "MOTOVAULT", "PB". Date formatting: use user's locale (not hardcoded en-US).
- [ ] Toast component — adapt PbToast pattern (FadeInUp entering, FadeOutDown exiting, 2s auto-dismiss with ref cleanup, haptic on iOS). Toast renders INSIDE sheet component (not behind it). Light bg: `rgba(255,255,255,0.95)`, dark text: `#14110d`, copper check bubble.
- [ ] Add missing share card colors to `packages/design-system/src/palette.ts` as named tokens (e.g., `shareCopper`, `shareCopperSoft`, `shareCream`, `shareSheetBg`, etc.)
- [ ] Test all 5 cards render correctly at 1080×1920 (save to Photos, open, verify)
- [ ] Verify Instagram Story handoff on physical device (requires Facebook App ID)
- [ ] Verify WhatsApp handoff on physical device
- [ ] Verify Android share paths (Instagram Intent, WhatsApp content URI)
- [ ] Test edge cases: no route polyline, no elevation data, very short ride (0.1km), very long name (80 chars), permission denied for Photos

### Edge Cases (from Spec Flow Analysis)

| Scenario | Behavior |
|---|---|
| Ride with no `routePolyline` | Hide Map Hero + Route Print from carousel. Show 3 cards. Dynamic dot count. |
| Ride with no elevation data | Hide Elevation Story from carousel. Show 4 (or 2 if also no route). |
| Very short ride (0.1km, 1min) | Show all available cards — stats will be small but accurate. No minimum threshold. |
| Very long ride name (>40 chars) | `numberOfLines={2}` with ellipsis on card title. Test at export resolution. |
| Multiple PBs in one ride | Show the first PR from `personalRecords` array. Auto-select only for `topSpeed`. |
| Non-owner (public viewer) | Hide share FAB entirely — public viewers cannot share others' rides. |
| Instagram/WhatsApp not installed | `canOpenURL` check → App Store redirect alert. Pasteboard untouched. |
| Permission denied (Photos) | Show "Open Settings" alert with `Linking.openSettings()`. Button stays enabled for retry. |
| Offline | Card render succeeds (local). External handoff may fail — show error toast. |
| RTL languages | Carousel direction unchanged (horizontal scroll is natural in RTL). Card text aligns per locale. |
| iPad | Card preview stays at 222px fixed width. Generous peek of next/prev cards. |
| React 19 Strict Mode double-mount | Capture refs must point to currently mounted view. `hasAutoSelected` ref prevents double scroll. |

## Acceptance Criteria

### Functional
- [ ] Tapping share opens the sheet in ≤80ms
- [ ] All 5 cards render correctly at 1080×1920 PNG
- [ ] Carousel snaps; dots track active card
- [ ] PR card auto-selected when `isPB && prType === 'topSpeed'`
- [ ] Instagram Story handoff opens Instagram with card as background
- [ ] WhatsApp handoff opens chat picker with image
- [ ] Save image writes to Photos and shows toast
- [ ] Copy link writes deep link and shows toast
- [ ] Sheet dismisses on swipe-down + "Close" tap

### Non-Functional
- [ ] Image render ≤300ms on iPhone 12
- [ ] VoiceOver: each card and destination announced by name
- [ ] No GPS coordinates in analytics events
- [ ] All colors use hex palette values (not oklch) in card views

## Dependencies & Risks (deepened by all 9 agents)

| Risk | Severity | Mitigation |
|---|---|---|
| `react-native-view-shot` requires dev client rebuild | High | Install and test compatibility with Expo 54 BEFORE writing card components. Run `eas build` early. |
| `NSPhotoLibraryAddUsageDescription` missing | Critical | Add to `app.config.ts` under `ios.infoPlist` immediately. App will crash without it. |
| `react-native-share` needed for image sharing | High | Install alongside view-shot. Add config plugin for `LSApplicationQueriesSchemes`. Requires dev client rebuild. |
| Facebook App ID required for Instagram Stories | High | Obtain from Meta Developer Console. Set as `EXPO_PUBLIC_META_APP_ID` env var. |
| `rideNumber` not in API | Medium | Compute client-side: `myRides` count where `startedAt < thisRide.startedAt`. Or add API field later. |
| `elevationPeakM` not in API | Medium | Derive from `Math.max(...waypoints.map(w => w.altitude))`. Handle null gracefully. |
| Fonts not loaded when capture fires | High | Gate capture behind `fontsLoaded === true`. Use expo-font config plugin for build-time embedding (eliminates async race). |
| Memory pressure: 5 PNGs at 8.3MB each | High | Never hold >2 in memory. Cache to `FileSystem.cacheDirectory`. Lazy render: active + prefetch next. |
| Gesture conflict: carousel swipe vs sheet dismiss | Medium | Use MapPickerSheet overlay (not Modal). PanResponder dead zone: only on handle/header, not carousel. |
| Android share paths differ from iOS | Medium | `react-native-share` handles platform abstraction. Test Instagram Intent + WhatsApp content URI on Android. |
| Stale cached PNGs after ride rename | Low | Include `ride.updatedAt` in cache key. Auto-invalidates on mutation. |
| Pasteboard clobbered before Instagram check | Medium | Always `canOpenURL` BEFORE setting pasteboard. Clear pasteboard after 3-5s on return. |
| VoiceOver carousel inaccessible | Medium | Use `accessibilityRole="adjustable"` with increment/decrement. Standard swipe navigates elements, not scroll. |
| Card text overflow with long names | Low | `numberOfLines={2}` with ellipsis. Test at 1080×1920 export resolution. |
| Double-tap on destination fires duplicate captures | High | State machine: IDLE → CAPTURING → HANDING_OFF → IDLE. All taps refused when not IDLE. |
| Zero-distance rides produce embarrassing cards | Low | Don't share 0m rides — hide share FAB when `distanceM < 100` (matches zero-distance fix). |

## Revised PR Breakdown (from Architecture Review)

**PR0: Dependencies + Config (prerequisite)**
- Install `react-native-view-shot`, `expo-media-library`, `react-native-share`
- Add config plugins to `app.config.ts` (media-library permissions, LSApplicationQueriesSchemes, NSPhotoLibraryAddUsageDescription)
- Add share card colors to `palette.ts` as named tokens
- Run `eas build` to create new dev client
- Verify view-shot captures a basic View at 1080×1920

**PR1: Sheet UI + Integration (integration point first)**
- `share-activity-sheet.tsx` (overlay, scrim, header, handle, dismiss gesture)
- `share-card-carousel.tsx` (ScrollView + snapToOffsets + dots)
- `share-destination-grid.tsx` (5×2 icon grid with brand SVGs)
- Wire into `ride-detail.tsx` (replace `shareRide()` call with sheet open)
- Placeholder card content (colored rectangles with variant label)

**PR2: Card Renderer + 5 Variants (parallel with PR3)**
- `share-card-types.ts` (RideSharePayload type, CardVariant, transform function)
- `cards/card-elements.tsx` (wordmark, stat footer, route silhouette SVG)
- 5 card variant files (map-hero, editorial-dark, pb-spotlight, route-print, elevation-story)
- `render-share-card.ts` (captureRef wrapper with font readiness gate)
- `use-share-pipeline.ts` (state machine: IDLE/CAPTURING/HANDING_OFF)
- Pre-capture map snapshot from existing MapView

**PR3: Destination Handlers (parallel with PR2)**
- `share-destinations.ts` (all handler functions using react-native-share)
- Instagram Story (with canOpenURL check + pasteboard cleanup)
- WhatsApp, Messages, Save Image, Copy Link, More
- Permission flow for Photos (deny → Settings redirect)
- Toast component (inside sheet, FadeInUp, 2s auto-dismiss with ref cleanup)

**PR4: Polish + Acceptance**
- PB auto-selection with hasAutoSelected guard
- Pulse-glow FAB animation
- VoiceOver accessibility (adjustable carousel, destination labels)
- Analytics events (all 5 new events + properties)
- i18n strings across 13 locale files
- Edge case handling (no route, no elevation, long names, zero-distance guard)
- Manual testing on physical devices (Instagram, WhatsApp, Photos)

## Existing Code Integration Points

| File | Change |
|---|---|
| `apps/mobile/src/app/(modals)/ride-detail.tsx:203-216` | Replace `shareRide()` call with `setShowShareSheet(true)` |
| `apps/mobile/src/components/share/share-ride.ts` | Keep as fallback for "More" destination |
| `apps/mobile/src/components/ride/pb-toast.tsx` | Reference for toast pattern |
| `apps/mobile/src/components/trip-share-sheet.tsx` | Reference for sheet Modal pattern |
| `apps/mobile/src/components/home/article-carousel.tsx` | Reference for ScrollView snap carousel |
| `apps/mobile/src/theme/editorial.ts` | `useEditorialTheme()` for consistent theming |
| `packages/design-system/src/palette.ts` | All card colors from here (hex only) |
| `apps/mobile/app.config.ts` | Already has deep linking for `/r/` routes |

## Sources & References

### Internal
- Existing share: `apps/mobile/src/components/share/share-ride.ts` (Phase 0.5, text-only)
- Trip share sheet pattern: `apps/mobile/src/components/trip-share-sheet.tsx`
- Article carousel: `apps/mobile/src/components/home/article-carousel.tsx`
- PB toast: `apps/mobile/src/components/ride/pb-toast.tsx`
- Ride detail screen: `apps/mobile/src/app/(modals)/ride-detail.tsx`
- oklch bug: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`
- Gesture conflicts: `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`
- Image aspect ratios: `docs/solutions/integration-issues/gemini-autodraft-social-worker.md`

### External
- react-native-view-shot: https://github.com/gre/react-native-view-shot
- Instagram Story sharing URL scheme: https://developers.facebook.com/docs/instagram/sharing-to-stories
- expo-media-library: https://docs.expo.dev/versions/latest/sdk/media-library/
