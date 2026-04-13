---
title: "AllTrails Live UX Walkthrough — Design Research for Routes Discovery"
ticket: MOT-144
date: 2026-04-13
status: complete
blocks: [MOT-145, MOT-146, MOT-147, MOT-148]
---

# AllTrails Live UX Walkthrough

Research document for MOT-144. Analyzes AllTrails UX patterns across anonymous, free, and paid tiers to ground MotoVault's Routes Discovery design decisions.

> **Note:** Direct web scraping was blocked by Cloudflare (403). Analysis based on: ScreensDesign showcase, Sophia Hee paywall case study, AllTrails Help Center, AllTrails App Review (2025), and Nami paywall analysis.

---

## 1. Trail Detail Page Structure (Anonymous/Logged Out)

### Section Order (top → bottom):
1. **Hero Photo Carousel** — Full-width, user-submitted photos (sortable by season)
2. **Trail Title + Difficulty Badge** — "Hard", "Moderate", "Easy" color-coded pill
3. **Stats Bar** — Distance, elevation gain, estimated time, route type (out & back / loop)
4. **Star Rating + Review Count** — e.g., "4.7 (1,203 reviews)"
5. **Action Buttons** — "Directions", "Save", "Share", "Print" (Print gated behind Plus)
6. **Map Preview** — Interactive map with trail polyline overlay. Free users see full map with route line. **NOT blurred.** 3D flyover is Plus/Peak only.
7. **Elevation Profile** — Chart showing elevation changes along the route
8. **Trail Description** — Text description of the trail
9. **Weather / Conditions** — Forecast up to 4 days (free). Detailed conditions (Plus)
10. **Reviews Section** — Star breakdown + written reviews with photos
11. **Photos Section** — Community photos grid
12. **Nearby Trails** — 6-8 related trail cards in horizontal scroll
13. **Breadcrumbs + SEO Footer** — Country → State → Park → Trail

### Key MotoVault Implications:
- **Map is NOT blurred for free users** — contradicts PRD §8 assumption. AllTrails shows full interactive map to all users. Only 3D flyover is gated.
- **Print/PDF is the first paywall** — gentle gating on a secondary action
- **Save is FREE** — no auth wall on bookmarking (MotoVault should match this)

---

## 2. Explore / Homepage (alltrails.com/explore)

### Above the Fold:
- **Full-width search bar** with dynamic placeholder: "Find trails" / "Find cities" / "Find parks"
- **Map + List split view** — left panel shows trail cards, right panel shows map with pins
- **Geolocation prompt** — "Trails near [City]" based on IP/browser location

### Discovery Sections:
1. **Near You** — IP-geolocated, top trails by rating
2. **Popular Trails** — trending trails nationally
3. **Curated Collections** — "Best for dogs", "Waterfall hikes", "Easy family trails"
4. **Top Cities** — Grid of city cards linking to city-specific trail pages

### Filter System (Left Sidebar on Desktop):
- **Difficulty** — Easy / Moderate / Hard (multi-select chips)
- **Length** — Range slider (km/miles)
- **Elevation Gain** — Range slider
- **Route Type** — Out & back / Loop / Point to point
- **Features** — Dog friendly, Kid friendly, Wheelchair accessible, Waterfall, Views
- **Rating** — Minimum star rating filter
- **Activity** — Hiking, Running, Mountain biking, etc.

### Search Typeahead:
- **Categories:** Trails, Parks, Cities (grouped dropdown)
- **Behavior:** Debounced ~200ms, shows 5 results per category
- **Keyboard:** Arrow keys to navigate, Enter to select
- **Placeholder rotates** contextually based on current view

### MotoVault Implications:
- **Split map+list is the standard** — our /explore should consider this layout
- **Filter sidebar is essential** — matches our MOT-158 implementation
- **Typeahead categories** — we have Routes + Places, matching AllTrails' pattern
- **Geolocation first** — CF-IPCountry header approach is correct

---

## 3. Paywall Strategy & Tier Gating

### AllTrails Tier Structure (Nov 2025):

| Feature | Free | Plus ($35/yr) | Peak ($80/yr) |
|---------|------|---------------|----------------|
| Browse & search trails | Yes | Yes | Yes |
| Community reviews & photos | Yes | Yes | Yes |
| Basic navigation | Yes | Yes | Yes |
| Save trails & create lists | Yes | Yes | Yes |
| Custom routes (desktop) | Yes | Yes | Yes |
| **Offline maps** | No | Yes | Yes |
| **Wrong-turn alerts** | No | Yes | Yes |
| **Live activity sharing** | No | Yes | Yes |
| **3D trail previews** | No | Yes | Yes |
| **Trail conditions (weather)** | Basic | Full | Full |
| **Print/PDF map** | No | Yes | Yes |
| **Send to Garmin** | No | Yes | Yes |
| **Custom routes (mobile)** | No | No | Yes |
| **Smart routing (AI)** | No | No | Yes |
| **Community heatmaps** | No | No | Yes |
| **Outdoor Lens (AI ID)** | No | No | Yes |

### Paywall Trigger Points:
1. **Onboarding** — Soft paywall immediately after sign-up (skippable)
2. **Feature-gated** — Pop-up when clicking "Download for offline", "Print map", "3D flyover"
3. **Contextual prompts** — Gentle nudges near premium features (not blocking)

### Paywall UI Elements:
- Feature comparison table (Free vs Plus)
- 7-day free trial CTA (outperforms "your first week's on us")
- Clear cancellation policy displayed
- Social proof (user count, rating)
- Annual pricing emphasized over monthly

### MotoVault Implications:
- **Free tier is generous** — all trail info, map, reviews visible. Only offline/safety features gated.
- **Our Phase 1 "everything free" approach is correct** — matches AllTrails free tier closely
- **GPX download gating (Phase 3)** aligns with AllTrails' offline map gating pattern
- **Save route should be FREE** — AllTrails allows saving without Plus
- **Paywall should be soft** — contextual, skippable, not blocking core discovery

---

## 4. Mobile Experience Patterns

### Navigation:
- Bottom tab bar: Explore, Navigate, Community, Profile
- **Search in header** — expands to full-screen on tap
- **Map toggle** — switch between list view and map view

### Trail Detail (Mobile):
- Hero image takes ~40% of viewport
- Stats bar is horizontally scrollable
- Map is collapsible section (tap to expand)
- Reviews show 3 visible, "Show all" expands
- Sticky bottom bar with "Start Trail" + "Save" CTAs

### Filter (Mobile):
- Bottom sheet (not sidebar) — full-screen filter overlay
- "Apply" + "Clear all" buttons at bottom
- Chip-based selections for difficulty/features
- Range sliders for distance/elevation

### MotoVault Implications:
- **Mobile filters as bottom sheet** — confirmed for Phase 3 (MOT-157)
- **Sticky bottom CTA bar** — should implement on detail page
- **Collapsible map section** — good pattern for mobile detail page
- **3 visible reviews + "Show all"** — matches our review soft-wall approach (MOT-168)

---

## 5. Map & Tile Behavior

### Anonymous/Free Users:
- **Full interactive map** with trail polyline overlay (NOT blurred)
- Map uses custom AllTrails tile style (similar to OpenStreetMap)
- Satellite layer available as toggle
- Trail start/end markers clearly visible
- Other nearby trails shown as pins on map

### Plus/Peak Users:
- All free features plus:
- **3D flyover** — cinematic preview of trail terrain
- **Air quality overlay** — color-coded air quality map layer
- **Weather overlay** — precipitation and temperature map layer
- **Community heatmap** (Peak only) — trail popularity visualization

### MotoVault Implications:
- **Map should NOT be blurred** — show full interactive map to all users
- **Our Stadia Maps default is fine** — AllTrails uses custom tiles, any OSM-based provider works
- **Hero image ≠ map** — AllTrails uses photos for hero, map is a separate section below
- **Our hero image generator (MOT-160)** should produce OG images, not replace the map section

---

## 6. SEO & Structured Data Patterns

### URL Structure:
`/trail/{country}/{state}/{trail-slug}` — matches our `/route/{country}/{region}/{slug}`

### Breadcrumbs:
`Home > {Country} > {State/Region} > {Park} > {Trail Name}`

### JSON-LD:
- TouristAttraction schema with geo coordinates
- BreadcrumbList on all pages
- AggregateRating when sufficient reviews
- WebSite with SearchAction on homepage

### Meta Tags:
- `og:type: website`
- `og:image: trail hero photo` (not map)
- Canonical URL on every page
- Hreflang for international versions

### MotoVault Implications:
- **Our URL convention matches AllTrails** — validated
- **JSON-LD approach (MOT-163) is correct** — TouristAttraction + BreadcrumbList
- **OG image should be a photo or branded map**, not raw map tile
- **Breadcrumb should include park/area** if available (we use region)

---

## 7. PRD Contradictions & Gaps Found

| # | PRD Assumption | AllTrails Reality | Impact |
|---|----------------|-------------------|--------|
| 1 | Map blurred for anonymous users (§8) | Map is fully interactive for all users, only 3D flyover is gated | **HIGH** — our map strategy should NOT blur maps |
| 2 | Save requires authentication | Save is free, no auth wall | **MEDIUM** — consider allowing anonymous saves via local storage |
| 3 | Reviews fully visible | Reviews are fully visible for all users (no soft wall on AllTrails) | **MEDIUM** — our MOT-168 review soft-wall is more aggressive than AllTrails |
| 4 | Hero is map-based | Hero is a photo carousel, map is a separate section | **LOW** — our hero image generator is fine for OG, but detail page should eventually show photos |
| 5 | Desktop-first filter sidebar | AllTrails has both sidebar (desktop) and bottom sheet (mobile) | **NONE** — our approach matches (web sidebar Phase 1, mobile bottom sheet Phase 3) |
| 6 | No split view on explore | AllTrails uses map+list split view on /explore | **MEDIUM** — consider split view for Phase 2 |

---

## 8. Design Recommendations for MotoVault

### Immediate (Phase 1):
1. **Do NOT blur maps** — show full interactive map to all users
2. **Keep Save as free action** — require auth but don't gate behind paywall
3. **OG images should be branded route maps** — current hero image generator approach is correct
4. **Search typeahead with Routes + Places categories** — matches AllTrails pattern

### Phase 3:
1. **Soft paywall on GPX download** — matches AllTrails' offline map gating
2. **Review soft-wall at 3 visible** — more aggressive than AllTrails but defensible for conversion
3. **Mobile filter bottom sheet** — confirmed pattern from AllTrails
4. **Consider split map+list view** for /explore on desktop

### Future:
1. **Photo carousel on detail pages** — AllTrails' strongest visual element
2. **Elevation profile chart** — important for motorcycle route assessment (MOT-176)
3. **3D flyover equivalent** — premium twist score visualization?
4. **AI route recommendations** — AllTrails introduced in 2025, potential differentiator

---

## Sources

- [AllTrails Paywall Case Study — Sophia Hee](https://www.sophiahee.com/alltrails-paywall-case-study)
- [AllTrails: Hike, Bike & Run — ScreensDesign](https://screensdesign.com/showcase/alltrails-hike-bike-run)
- [AllTrails App Review: Free vs Plus vs Peak](https://sheexplorestheusa.com/2025/11/alltrails-app-review-free-vs-paid-is-it-worth-it/)
- [AllTrails Plans — Help Center](https://support.alltrails.com/hc/en-us/articles/37186483585556-AllTrails-Plans)
- [Best Mobile Paywall — AllTrails](https://www.namiml.com/paywalls/alltrails-hike-bike-run)
- [AllTrails 2025 Summer Update](https://www.alltrails.com/update/2025-summer)
