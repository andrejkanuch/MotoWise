# MotoVault — Rides Engagement PostHog Audit (2026-06-09)

> Narrow, deep follow-up to the full 20-dashboard audit (`docs/PostHog-Audit-2026-05-30.md`). Scope: the **ride-VIEWING** experience only — 3D flyover, altitude/speed charts, map styles, the My Rides tab, and the ride-detail screen. All counts are PostHog 90d **raw, including the developer's own device** — so 1–2-user events are dev-only/dead.
>
> **Governance (inherited, enforced here):** no tile ships for an event with **<15 unique users in 90d** unless captioned `blocked — instrument first`. `filterTestAccounts: true` on **every** tile.

---

## 1. Executive summary

We can see that riders **start, finish, and save rides** (`ride_started` 24u, `ride_completed` 8u, `rides_history_viewed` 24u, `heatmap_viewed` 11u) — the **recording and list-browsing layer is healthy**. But we currently "have no idea" what users do *inside* a saved ride because the entire **viewing/engagement layer is uninstrumented or dev-only**. The 3D flyover (2u), map-style picker (1u), and the altitude/speed charts (effectively 0u — `ride_chart_viewed`/`elevation_chart_viewed` have no real call sites) are all dead. The one screen-level event that does fire, `ride_viewed`, is **inflated ~32x/user** (194 events / 6 users) and carries **no owner-vs-visitor prop**, so even "how many ride views" is untrustworthy and unsegmentable.

The honest answer to "where do users spend time in rides" today is: **in the recording HUD and the My Rides list — those are the only places with real, healthy signal.** Everything past the card tap (flyover, charts, map styles, what gets tapped on ride-detail) is a measurement blind spot, not necessarily a usage desert. Two of the five questions are flatly **unanswerable** today (charts, time-in-tab), two are **dev-only/low-volume** (flyover, map styles), and the fifth (what gets tapped on ride-detail) is **mostly invisible**. Crucially, much of this is cheap to fix: several events are **already defined in the registry but never wired** (`elevation_chart_viewed`, `ride_chart_viewed`, `overview_viewed`, `rides_tab_scroll_depth`, `rides_overview_refreshed`, `record_badge_*`), and the best-instrumented feature (the flyover) just lacks real traffic plus one broken exit path. The plan below builds the ~3 READY tiles now and unblocks the rest in a single mobile release.

---

## 2. Direct answers to the five questions

| # | Question | Answerable today? | Number (if yes) | Blocker (if no) |
|---|----------|-------------------|-----------------|-----------------|
| **1** | Do users open & watch the 3D flyover, and finish or bail? | **No (dev-only)** | started 32ev/**2u**, completed 4ev/**2u** | (a) Reach: 3D FAB buried in low-traffic ride-detail modal; (b) `ride_flyover_exited` **never fires** in prod — wired only to FAB/`Go back` `onPress`, but users dismiss via iOS **swipe-down** which calls `router.back()` and never invokes the JS handler. So bail-rate / watch-duration / %-watched are uncaptured even for the 2 dev users. Entry-tap on the FAB itself is also untracked. |
| **2** | Do users view the altitude & speed graphs, which type, and interact? | **No (blind)** | — | Both charts render with **zero `trackEvent` calls** (`ride-elevation-chart.tsx`, `ride-speed-chart.tsx`, `ride-charts-empty.tsx` = 0 calls). `ride_chart_viewed` (1ev/1u, stale) & `elevation_chart_viewed` (0) are **defined-but-unwired**. Scrub interaction (gifted-charts `pointerConfig`) emits nothing. Charts are owner-only by construction (waypoints gated on `isOwnerViewer`). |
| **3** | Multiple map style versions — which do users prefer? | **No (dev-only + silent default)** | `ride_map_style_changed` 29ev/**1u** | Only **1 of ~5 style surfaces** is instrumented (ride-detail `MapPickerSheet`); `ride-summary` and `create-trip` `cycleMapStyle` fire nothing. The **default style is never logged**, so the silent majority who keep dark/light emit nothing → preference unmeasurable. Flyover style is hardcoded (`satellite-streets-v12`) with no picker. |
| **4** | Where do users spend time in rides / inside My Rides? | **Partial** | `rides_history_viewed` **24u** (tab opens), `rides_history_filtered` 75ev/**3u** (sort+period, dev-only) | No time-on-screen / `trackScreen` anywhere; ride-detail is a single scrolling sheet with no snap-index tracking. `rides_tab_scroll_depth`, `overview_viewed`, `rides_overview_refreshed`, `record_badge_*` all **defined-but-unwired**. We know the tab *opens*, nothing about dwell or scroll depth. |
| **5** | After a ride, what do users tap on ride-detail? | **Mostly No** | `ride_viewed` 194ev/**6u** (inflated, no viewer) proves it opens; only `ride_deleted` + (rare) `lean_angle_tooltip_opened` fire from the screen | Share FAB, Layers FAB (open), 3D FAB tap, charts = no tap events. Card tap-through from My Rides is unattributed (no `source` prop). No owner-vs-visitor split anywhere. |

**Cross-cutting blind spot — owner vs visitor.** `rideBundle.viewer` (`'owner' | 'public'`) is computed at `ride-detail.tsx:94/97` and exposed as `isOwnerViewer` (`:103`) but is attached to **none** of the fired events. Public/shared-link views and owner re-opens are merged everywhere. Charts only mount for owners (waypoints gated at `:104`), so without the viewer prop even chart-visibility rates are uninterpretable.

---

## 3. Instrumentation gap remediation plan (prioritized)

Reuse defined-but-unwired registry events wherever possible (noted). All new props should include `viewer` so every tile can be sliced owner vs public.

| P | Event | File:line | Change | Unblocks |
|---|-------|-----------|--------|----------|
| **1** | `ride_viewed` (**B1 re-check**) | `apps/mobile/src/app/(modals)/ride-detail.tsx:121-127` | **B1 is only HALF fixed.** Dep array is `[rideLoaded, rideId]` (confirmed, `:120` biome-ignore) — this killed *intra-mount* refetch refires but there is **no per-mount latch**, so modal remount/refocus still gives ~32x/6u. Add `const viewedRef = useRef(false)` and gate the effect (`if (... && !viewedRef.current) { viewedRef.current = true; trackEvent(...) }`). Add props `viewer: rideBundle?.viewer`, `has_route`, `has_elevation_chart`, `has_speed_chart`. | Q5 + de-inflates the denominator for every other rate; adds owner/visitor split |
| **2** | `ride_flyover_exited` (**already defined+wired, never fires**) | `apps/mobile/src/app/(modals)/ride-flyover.tsx:~219` (new effect) + `:382-394` body | Register a `navigation.addListener('beforeRemove', ...)` so swipe-down/hardware-back dismissals fire the existing exit logic (today only FAB `:693` / `Go back` `:481` `onPress` reach it). Emit `progress_pct`, `watch_duration_s` (from `startTimeRef :211`), `completed`. Guard against double-fire with completion. | **Q1** — converts finish-vs-bail from unanswerable → answerable |
| **3** | `elevation_chart_viewed` (**defined-but-unwired**, `analytics.ts:277`) | `apps/mobile/src/components/ride/ride-elevation-chart.tsx:~130` (pass `rideId` from `ride-detail.tsx:954`) | `useEffect` gated on `chartData.length>0`, latched with a `hasFiredRef`, fire once per mount. Props `ride_id`, `viewer`, `waypoint_count`, `elevation_gain_m`. | **Q2** — do users see the altitude graph |
| **4** | `ride_chart_viewed` (**defined-but-unwired**, `analytics.ts:263`) | `apps/mobile/src/components/ride/ride-speed-chart.tsx:~123` (pass `rideId` from `ride-detail.tsx:1006`) | Same `hasFiredRef` pattern; add discriminator `chart_type: 'speed'` (use `'elevation'` too if you want one event to cover both). Props `ride_id`, `viewer`, `chart_type`, `max_speed_mps`. | **Q2** — which graph types get viewed |
| **5** | `ride_map_style_changed` — log **default + open** | `ride-detail.tsx:558` (Layers FAB open) + extend `ride_viewed` with `default_style` | Real users keep the default and emit nothing. Log `default_style: getDefaultMapStyle(isDark)` on `ride_viewed`, and add a lightweight open/`map_picker_opened` track at the FAB so "kept default" ≠ "never opened". Add `surface` + `is_pro_style` to the existing change event. | **Q3** — makes the silent-default majority countable |
| **6** | `ride_map_style_changed` — other surfaces | `ride-summary.tsx:326` (`handleCycleMapStyle`), `create-trip.tsx:553` (`cycleMapStyle`) | Wire `trackEvent` before `setMapStyle` with `from_style`/`to_style` + `surface: 'ride_summary' \| 'create_trip'`. ride-summary is hit on every `ride_completed` (8u) — far higher traffic than ride-detail. | **Q3** — captures preference on the high-traffic summary surface |
| **7** | `rides_tab_scroll_depth` (**defined-but-unwired**, `analytics.ts:270`) | `apps/mobile/src/app/(tabs)/(profile)/rides.tsx:~988` (FlatList) | Add `onViewableItemsChanged`; on blur/unmount emit `max_index_reached`, `total_rides`, `pages_loaded`, `reached_end`. | **Q4** — how far down the list users browse |
| **8** | `overview_viewed` (**defined-but-unwired**, `analytics.ts:269`) | `rides.tsx:~221` (RideOverview query success) | Fire once (ref-guarded) when streak/records/7-day block renders. Props `has_streak`, `record_count`, `total_rides`. | **Q4** — is the summary card actually seen vs the raw list |
| **9** | `ride_viewed` source attribution + `record_badge_viewed`/`_tapped` (**defined-but-unwired**, `analytics.ts:272-273`) | `rides.tsx:314` (card press) + `:988` (viewability) | Pass `source: 'my_rides_tab'`, `list_index`, `has_record` at the tap site; fire `record_badge_viewed` when a card with `recordTypes` becomes viewable, `record_badge_tapped` when such a card is tapped (no separate badge Pressable exists). | Q5 tap-through + PB engagement |
| **10** | `rides_overview_refreshed` (**defined-but-unwired**, `analytics.ts:271`) | `rides.tsx:991` (RefreshControl `onRefresh`) | Wrap `refetch` to also `trackEvent({ total_rides })`. | **Q4** — pull-to-refresh re-engagement |
| **11** | `rides_history_filtered` (**B2 re-check**) | `rides.tsx:711` (sort) + `:926` (period) | **B2 is FIXED in code** — both call sites now fire outside the `setState` updater (sort site has the explicit comment at `:708-710`). The 75ev/3u ground truth is pre-fix + dev usage; expect it to halve and stay low-user. **No code change needed**; insights MUST `breakdown by filter_type` to separate sort vs period. | Validation only |
| **12** | `lean_angle_tooltip_opened` double-count fix | `ride-detail.tsx:856-857` | Currently fires on the **toggle** (open *and* close). Fire only on open: `setShowLeanTooltip((p) => { if (!p) trackEvent(...); return !p; })`. Near-zero volume + owner-only + rare lean data — low priority. | Q5 hygiene |
| **13** | Chart **scrub** interaction | `ride-elevation-chart.tsx:~204` / `ride-speed-chart.tsx:~197` (`pointerLabelComponent`) | Optional: fire once-per-gesture (ref-guarded) on first pointer activation with `interaction: 'scrub'` to distinguish passive view from active inspection. | **Q2** — do riders actually scrub the graphs |

---

## 4. Existing dashboard 680821 ("Rides Deep Dive") — tile-by-tile verdict

| Tile | Events | Verdict | Reason |
|------|--------|---------|--------|
| HUD Layout A vs B | `ride_ended` / `hud_layout_final` | **KEEP** | Recording HUD, real signal (`ride_hud_layout_switched` 11u). Not a viewing tile but healthy. |
| Upgrade CTA Conversion (Rides) | `ride_upgrade_cta_shown/tapped` | **DROP** | Already flagged in 2026-05-30 audit: ~1 user, fake 100%. Violates <15u rule. |
| **Ride Feature Engagement** | `ride_chart_viewed`, `ride_name_edited`, `ride_map_style_changed`, `ride_bike_changed`, `ride_shared` | **DROP (rebuild later)** | **The only viewing-engagement tile and it is built entirely on dead events**: chart_viewed 1u, name_edited 1u, map_style 1u, shared 4u. Every component is <15u. Replace with the new Rides Engagement dashboard tiles once instrumented. |
| Rides Started (Weekly) | `ride_started` | **KEEP** | Healthy, 24u. |
| Ride Abandonment Rate | `ride_abandoned` / `ride_started` (A/B) | **KEEP** | Recording funnel; healthy denominator. |
| Rides per User (Weekly) | `ride_completed` avg_count_per_actor | **KEEP** | 8u — borderline but `ride_completed` is a real conversion event; acceptable as a north-star, caption the low-n. |
| Ride Pause Rate | `ride_paused` / `ride_ended` (A/B) | **KEEP** | Recording behavior, real. |
| **Rides History Browsing** | `rides_history_viewed`, `rides_history_filtered`, `ride_viewed` | **FIX** | `rides_history_viewed` healthy (24u); but split out `rides_history_filtered` (3u, dev-only — caption `blocked` or break down by `filter_type`) and `ride_viewed` (inflated 32x — do not show until B1 latch ships). |
| Ride Duration Distribution | `ride_ended` median/p90/p99 | **KEEP** | Healthy, recording-side. |
| Ride Completion Funnel | `ride_started → ride_ended → ride_completed` | **KEEP** | Core funnel, all healthy events. |

**Net:** keep 7 recording/funnel tiles, **FIX** Rides History Browsing (drop/caption the inflated+dev sub-series), **DROP** Upgrade CTA and Ride Feature Engagement (both built on <15u events). Viewing-engagement reporting moves to the new dashboard below.

---

## 5. New "Rides Engagement" dashboard spec

`filterTestAccounts: true` on every tile. Tiles split into **READY now** (real ≥ governance-relevant signal exists today) and **BLOCKED** (needs the §3 instrumentation to ship first).

### READY now (build immediately)

1. **My Rides tab opens (weekly)** — Trends — `rides_history_viewed` — weekly active users (unique), `filterTestAccounts:true`. 24u, healthy. The honest "rides browsing" north-star.
2. **Ride completion funnel** — Funnel — `ride_started → ride_completed` — unique-user funnel, 14d window, `filterTestAccounts:true`. Anchors the denominator for all viewing rates.
3. **Roads-I've-ridden (heatmap) reach** — Trends — `heatmap_viewed` — weekly unique users, `filterTestAccounts:true`. 11u — caption "low-n, ≥ governance floor on a 90d basis (verify)"; keep as a secondary engagement signal, not a headline.

> Note: `ride_viewed`, `ride_map_style_changed`, all flyover/chart events are deliberately **NOT** in the READY set — each is either <15u or inflated. Building them now would reproduce the dead-tile mistake of dashboard 680821.

### BLOCKED (build after the next mobile release ships §3 instrumentation)

4. **Ride views — owner vs visitor (de-inflated)** — Trends — `ride_viewed` — total + unique, breakdown by `viewer`. **BLOCKED:** §3 P1 (useRef latch + `viewer` prop). Until then the count is 32x-inflated and unsegmentable.
5. **Flyover finish-vs-bail funnel** — Funnel — `ride_flyover_started → ride_flyover_completed` with `ride_flyover_exited` as the drop reason. **BLOCKED:** §3 P2 (`exited` via `beforeRemove`) **and** real reach (2u today). Also caption with `watch_duration_s` median once data accrues.
6. **Chart visibility by type** — Trends — `elevation_chart_viewed`, `ride_chart_viewed` — unique users, breakdown by `chart_type`, sliced `viewer='owner'`. **BLOCKED:** §3 P3+P4 (wire the two defined-but-unwired chart events).
7. **Chart scrub interaction rate** — Trends/Formula — `(chart scrub events) / (chart_viewed)`. **BLOCKED:** §3 P13 (scrub event) + P3/P4.
8. **Map style preference (incl. default)** — Trends — `ride_map_style_changed` + `ride_viewed.default_style` — breakdown by `to_style`/`default_style`, by `surface`. **BLOCKED:** §3 P5+P6 (log default + open + summary/create-trip surfaces). Single-surface dev-only today.
9. **My Rides scroll depth** — Trends — `rides_tab_scroll_depth` — median/p90 of `max_index_reached`, plus `reached_end` rate. **BLOCKED:** §3 P7.
10. **Overview card seen rate** — Formula — `overview_viewed / rides_history_viewed`. **BLOCKED:** §3 P8.
11. **Card tap-through from My Rides** — Funnel — `rides_history_viewed → ride_viewed (source='my_rides_tab')`. **BLOCKED:** §3 P9 (source attribution) + P1.
12. **PB badge engagement** — Trends — `record_badge_viewed`, `record_badge_tapped` — view→tap rate. **BLOCKED:** §3 P9.

---

## 6. Sequenced rollout

**Now — build in PostHog (no app release needed):**
- Stand up the **Rides Engagement** dashboard with tiles **1–3** (READY) only.
- Apply the **680821 fixes**: DROP Upgrade CTA + Ride Feature Engagement; FIX Rides History Browsing (remove/caption the inflated `ride_viewed` series and dev-only `rides_history_filtered`, or break the latter down by `filter_type`).
- Add `blocked — instrument first` placeholder captions (text tiles) for tiles 4–12 so the dashboard documents the plan.

**Next mobile build — instrument (priority order from §3):**
- **P1** `ride_viewed` useRef latch + `viewer`/`has_*`/`default_style` props (fixes B1 inflation, the single highest-leverage change — every rate depends on it).
- **P2** `ride_flyover_exited` via `beforeRemove` (the one change that makes Q1 answerable).
- **P3 + P4** wire the defined-but-unwired chart events (`elevation_chart_viewed`, `ride_chart_viewed`+`chart_type`).
- **P5–P10** map-style default/open + extra surfaces, scroll depth, overview, refresh, card source attribution, PB badges.
- **P12–P13** lean-tooltip double-count fix + chart scrub (low priority).
- **B2** needs **no code change** — already fixed; just verify post-fix.

**After data accrues (~2–4 weeks post-release) — re-validate:**
- Confirm `ride_viewed` collapses from ~32x/6u toward ~1x/mount and that `viewer` splits populate.
- Confirm `rides_history_filtered` halves and stays low — decide keep-vs-drop against the 15u floor.
- Check whether flyover/chart/map-style events clear the **15-unique-user / 90d** governance floor. If they stay <15u after honest (non-dev) traffic, the conclusion is a **reach/discovery problem** (e.g. the 3D FAB is too buried) — not a measurement problem — and the product response is surfacing, not more instrumentation.
- Promote BLOCKED tiles to live only once their underlying event clears the floor; keep the `blocked` caption otherwise.

---

## 7. Implementation Log — 2026-06-09 (instrumentation shipped)

All changes are **JS-only** (no native modules touched) → shippable via **EAS Update / OTA**. Mobile typecheck ✓ · Biome ✓ · 121 ride tests ✓.

**Registry** (`apps/mobile/src/lib/analytics.ts`)
- Added one new event: `RIDE_MAP_PICKER_OPENED: 'ride_map_picker_opened'`. Everything else reused events already defined in the registry.

**`ride-detail.tsx`**
- **P1** `ride_viewed` — added a `useRef` per-mount latch (kills the ~32×/user inflation that the narrowed dep array alone didn't fix). New props: `viewer` (owner/public), `source` (from the My Rides tab param), `has_route`, `default_style`.
- **P5** Map-picker open — fires `ride_map_picker_opened` (with `current_style`) at the Layers FAB, so "opened but kept default" ≠ "never opened".
- **P6** `ride_map_style_changed` now carries `surface: 'ride_detail'`.
- **P12** Lean-angle tooltip — now fires only on **open** and **outside** the `setState` updater (was firing on open+close and risked the B2 StrictMode double-fire).
- Passes `rideId` + `viewer` into both chart components.

**`ride-elevation-chart.tsx` / `ride-speed-chart.tsx`** (previously **zero** analytics)
- **P3/P4** Fire `elevation_chart_viewed` / `ride_chart_viewed` once per mount when the graph actually renders, with `viewer`, `chart_type` (`elevation`/`speed`), `waypoint_count`, `interaction: 'view'`.
- **P13** First scrub fires the same event with `interaction: 'scrub'` (latched once) → passive-view vs active-inspection split.

**`ride-flyover.tsx` (3D map)**
- **P2** Refactored exit into an idempotent `emitFlyoverExit()` and registered a `navigation.addListener('beforeRemove')`, so `ride_flyover_exited` now fires on **swipe-down / hardware-back** dismissals (previously only button presses, so it never fired in prod). Guarded against double-fire and against firing on the completion/never-started paths. Keeps `progress_pct` + `watch_duration_s`.

**`rides.tsx` (My Rides tab)**
- **P8** `overview_viewed` once the overview block populates (`has_streak`, `record_count`).
- **P7** `rides_tab_scroll_depth` on tab blur via `useFocusEffect` + `onViewableItemsChanged` (`max_index_reached`, `total_rides`, `pages_loaded`, `reached_end`).
- **P9** `ride_viewed` source attribution (`source: 'my_rides_tab'`, `listIndex` passed as route params); `record_badge_viewed` when a PB card scrolls into view; `record_badge_tapped` when such a card is tapped.
- **P10** `rides_overview_refreshed` on pull-to-refresh.

**`ride-summary.tsx` / `create-trip.tsx`**
- **P6** Wired `ride_map_style_changed` into the cycle handlers with `from_style`/`to_style` + `surface: 'ride_summary'` / `'create_trip'` (computed outside the updater to avoid the B2 double-fire). ride-summary is hit on every `ride_completed` — the highest-traffic place to read map-style preference.

**Not changed (deliberate):** B2 `rides_history_filtered` — already fixed in code; validation-only. `has_elevation_chart`/`has_speed_chart` on `ride_viewed` were dropped from P1 — waypoints load *after* `ride_viewed` fires, so those flags would be unreliable; the chart-view events cover chart visibility instead.

**Next:** ship OTA, let data accrue ~2–4 weeks, then build the dashboard (READY tiles now per §5, but apply the review caveat — `heatmap_viewed` 11u and the `ride_completed` 8u funnel step are below the 15-user floor and should be captioned low-n, not headline). Confirm `ride_viewed` collapses toward ~1×/mount and the `viewer` split populates.
