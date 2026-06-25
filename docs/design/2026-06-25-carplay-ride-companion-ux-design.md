---
date: 2026-06-25
topic: carplay-ride-companion-ux-design
origin: docs/brainstorms/2026-06-22-carplay-ride-companion-requirements.md
---

# CarPlay Ride Companion — UX/UI Design Spec

Synthesis of a multi-agent design pass (CarPlay platform/HIG, information architecture + safety, iOS visual design, interaction + feedback, accessibility + critic). Implements the requirements in `docs/brainstorms/2026-06-22-carplay-ride-companion-requirements.md` (R1–R21, F1–F3, AE1–AE7). Apple CarPlay Driving Task entitlement is **granted** (Case-ID 20710293).

## 0. The two-design-problems split (read first)

This feature has two design surfaces with opposite rules:

- **CarPlay surface — template-locked, system-rendered.** You supply strings, SF Symbols, and limited tint to `CPInformationTemplate` / `CPListTemplate` / `CPAlertTemplate` / `CPTabBarTemplate`. The **vehicle** owns font, size, layout, light/dark theme, focus chrome, and contrast. No custom fonts, colors, gauges, sparklines, or map line. MotoVault brand styling does **not** apply here.
- **On-phone companion — freeform iOS.** Full MotoVault design system applies (copper, warm dark surfaces, Plus Jakarta Sans / Instrument Serif / Geist Mono, reanimated motion, haptics).

Brand expression on CarPlay is limited to content quality and the app tile/icon — never chrome. This split is non-negotiable; reviewers must not file "doesn't look like MotoVault" against the CarPlay surface.

---

## 1. Canonical state model

The phone engine (`apps/mobile/src/stores/ride.store.ts`, `ride-location.ts`) defines two orthogonal axes — the design mirrors them rather than inventing a flat enum:

- `RideStatus = 'idle' | 'recording' | 'paused' | 'ended'` — intentional axis.
- `RecordingSubState = 'moving' | 'stopped'` — automatic (GPS) axis.

Auto-pause = `recording` + `stopped` (deterministic: speed `<0.5 m/s`, sustained `60s`, within a `5m` anchor). Manual pause = `paused`. **These are different and the rider must tell them apart.** GPS-acquiring (`recording` before first lock) is a real, separate display state (R7).

| Engine state | Indicator label | SF Symbol | Tint (tertiary only) |
|---|---|---|---|
| `idle` | `READY` (auto) / `NOT RECORDING` (manual) | `circle.dashed` | neutral |
| `recording`, no GPS lock | `ACQUIRING GPS` | `location.slash` / `location.circle` | neutral/amber |
| `recording` + `moving` | `RECORDING` | `record.circle.fill` | green/copper |
| `recording` + `stopped` | `AUTO-PAUSED` | `pause.circle.fill` | amber |
| `paused` (manual) | `PAUSED` | `pause.circle.fill` (solid) | amber |
| `ended` | `SAVED` (transient) | `checkmark.circle` | teal |

**The label text + symbol are the source of truth; color is reinforcement, never the sole signal** (accessibility blocker — see §7). This vocabulary is identical across the CarPlay tile, the phone banner, the status sheet, and the cue legend so the rider learns it once.

---

## 2. CarPlay surface spec

### 2.1 Template mapping (all Driving-Task-legal)

| Surface | Template | Notes |
|---|---|---|
| Root container | `CPTabBarTemplate` (2 tabs: **Ride** · **Bike**) | Tab bar is free against the depth budget; each tab is its own depth-0 root. |
| Live-ride panel (hero) | `CPInformationTemplate` (`.leading`), **mutated in place** across all states | No push, no depth cost, refreshes for R5. |
| Stop confirm | `CPAlertTemplate` (modal — no push depth) | Two-step guard (R17). |
| Bike status | `CPListTemplate`, rebuilt on `templateWillAppear` | Load-on-entry (R20). |
| Idle / no-ride | Same `CPInformationTemplate` instance, re-themed | Never a new template. |

Depth never exceeds 2 even on iOS 26.3 (tab bar free; stop-confirm is a modal alert, not a push). Practical budget to design against: **CPInformationTemplate = 4 rows + ≤3 action buttons** (hard cap ~10 items / 3 actions; query `CPListTemplate.maximumItemCount` at runtime — can be as low as 12 per head unit).

### 2.2 Live-ride panel — fitting R6's element set into ONE template

R6's "promote state + primary metric, relegate the rest" is the only layout that fits the row budget **and** survives large Dynamic Type. Resolution:

- **Title (glance hero):** recording **state + distance** fused — `● RECORDING · 42.3 km`. Leading SF Symbol carries state; distance is the primary metric (chosen over time because a frozen distance is the clearest "something's wrong" signal and is least duplicative of the bike cluster's trip A/B).
- **Rows (≤3):** `Moving` / value · `Climb` / value · `Mode` / value (mode demoted from glance to reference row).
- **Actions (≤2, contextual):** never all three controls at once — `[Pause] [Stop]` while recording, `[Resume] [Stop]` while paused, `[Start Ride]` when idle-manual, none when idle-auto (prevents duplicate-start, R15).

Climb is the explicit demotion candidate if a given head unit renders fewer rows.

### 2.3 Per-state wireframes

```
RECORDING
┌──────────────────────────────────────────────┐ CPInformationTemplate (.leading)
│  ● RECORDING · 42.3 km          title = hero  │
│  Moving                              1:12:40  │
│  Climb                                +640 m  │
│  Mode                              Automatic  │
│        [ ⏸ Pause ]        [ ■ Stop ]          │  actions (Pause first = ≤1 step, R18)
└──────────────────────────────────────────────┘

AUTO-PAUSED (F2/AE3)            moving-time FROZEN = the trust signal
┌──────────────────────────────────────────────┐
│  ❚❚ AUTO-PAUSED · 42.3 km                      │
│  Moving                              1:12:40  │  frozen
│  Climb                                +640 m  │
│  Mode                              Automatic  │
│        [ ▶ Resume ]      [ ■ Stop ]           │
└──────────────────────────────────────────────┘

ACQUIRING GPS (R7/AE6)         dashes, NEVER 0.0
┌──────────────────────────────────────────────┐
│  ◌ ACQUIRING GPS · — km                        │
│  Moving                                —:—    │
│  Climb                                  — m   │
│  Mode                              Automatic  │
│        [ ■ Stop ]                             │
└──────────────────────────────────────────────┘

IDLE — manual (R8/AE6)
┌──────────────────────────────────────────────┐
│  NOT RECORDING · MODE: MANUAL                  │
│  Last ride                      88 km · 2:05  │  reference, not live
│  Mode                                Manual   │
│        [ ▶ Start Ride ]                       │
└──────────────────────────────────────────────┘
(IDLE — auto: title "READY · auto-start", no action button)

STOP CONFIRM (R17/AE4) — CPAlertTemplate modal, default focus = safe
┌──────────────────────────────────────────────┐
│  End this ride?                               │
│  42.3 km · 1:12:40 will be saved.             │  frames stop as a SAVE
│   [ Keep Recording ]   [ End Ride ]           │  default=Keep; End=destructive role
└──────────────────────────────────────────────┘

BIKE STATUS (R19/R20) — CPListTemplate, tab 2
┌──────────────────────────────────────────────┐
│  Africa Twin · status          updated 14:32  │
│  🔧 Next service        Oil & filter · 1,200 km│
│  ⏱ Mileage              48,210 km             │
│  ⚠ Open recalls          0                     │  checkmark.shield when 0
│  ⛽ Last fuel            41.2 L · 320 km ago   │
│  (moving: single row "Stop to refresh status") │  explicit motion behavior (R20)
└──────────────────────────────────────────────┘
```

### 2.4 SF Symbols (system-rendered, no custom glyphs)

recording `record.circle.fill` · auto-paused/paused `pause.circle.fill` · acquiring `location.slash` → locked `location.fill` · start/resume `play.fill` · pause `pause.fill` · stop `stop.fill` (alert `stop.circle.fill`) · service `wrench.and.screwdriver.fill` · mileage `gauge.with.dots.needle.50percent` · recalls `exclamationmark.triangle.fill` (0 → `checkmark.shield`) · fuel `fuelpump.fill`.

### 2.5 Controls & reachability

- **Pause/resume = persistent action buttons, focus-order first** (≤1 rotary step + select; satisfies R18). Not a submenu.
- **Stop = two-step select→confirm** (the platform-correct R17 equivalent; hold-to-confirm is unreliable on a rotary). First press opens the modal; destructive action is not default focus; auto-collapse after ~5s. There is **no destructive-discard control on the head unit at all** — ending always saves, so a bumped toggle cannot lose a ride.
- **Mode is read-only** on the head unit (changed in the phone app, R21).

---

## 3. Non-visual confirmation (R9) — the keystone, designed honestly

Silent auto-start only works if the rider perceives the confirmation, and the rider's audio is the nav app over a helmet intercom with the phone stowed. Channels and their real failure modes:

- **Audio earcon over the shared audio session (DEFAULT).** The one channel the rider is provably attending to. Play via `AVAudioSession` `.duckOthers` so it ducks nav voice ~0.4–0.8s rather than fighting it. Risk: routing may go to phone speaker instead of intercom — **must be validated on the bike.**
- **Haptic (phone + Apple Watch fallback).** Phone haptic in a tank bag is largely unfelt; a paired **Watch tap** penetrates and is the preferred haptic fallback. Fire in parallel when available.
- **Passive on-tile state + "last event" line (backstop).** Not a moment-of-truth cue, but guarantees a rider who toggles over later always sees the truth — the safety net if audio routing fails silently.

Use **distinct, asymmetric earcons** so state is decodable by ear: rising two-tone = start/GPS-lock/resume; single descending = pause; long descending = stop; single low tick = stop-confirm warning (deliberately unlike a selection sound).

**Cue on GPS lock, not on intent.** The engine sets `recording` before first fix; cueing at intent would confirm a ride logging dashes. Fire the start cue on first valid fix (R9 lists "GPS lock acquired"). If lock takes >~20–30s, fire one "still acquiring" tick so silence isn't read as failure.

**Cue timing table:**

| Event | Audio (default) | Watch (fallback) | Tile (passive) |
|---|---|---|---|
| GPS lock acquired (= start) | rising two-tone | tap | `RECORDING ●` + "Started HH:MM" |
| Auto-pause (60s edge — NOT every light) | single descending | double tap | `AUTO-PAUSED ❚❚` |
| Auto-resume | single rising | tap | `RECORDING ●` |
| Manual pause/resume | descending / rising | double / single | `PAUSED` / `RECORDING` |
| Stop confirmed | long descending | long tap | `SAVED ✓` |

**Default ships both audio + haptic on** (redundant channels cover each other's failure; also the accessibility-correct answer). R9 is "done" only when validated on the actual Africa Twin + intercom — not "emitted in code."

---

## 4. State consistency & race handling (R16)

**The CarPlay process holds zero ride truth.** It renders a snapshot pushed from the phone and emits *intents* (`RequestStart/Pause/Resume/Stop` with an `intentId` + `expectedStatus`). The **phone engine is the single writer**; head-unit intents funnel through the same reducer as auto-pause, serialized on one thread. Optimistic "…ing" labels are allowed for responsiveness but always reconcile against the next snapshot.

Race precedence (deterministic):

| Collision | Winner | Why |
|---|---|---|
| Head-unit STOP vs auto-pause firing | **STOP** | Explicit guarded destructive intent beats a non-destructive sub-state change. |
| Head-unit RESUME vs auto-pause firing | **RESUME** | Rider overrides the idle detector. |
| Manual PAUSE while already auto-paused | converge to manual `paused` (sticky) | Manual outranks automatic so a later auto-resume can't silently un-pause. |
| Auto-resume while manual `paused` | **manual paused wins** (auto-resume suppressed) | Don't un-pause a deliberately paused ride. |
| Two STOPs / two STARTs | **idempotent** by `intentId` + status guard | Prevents double-end / duplicate ride (R15). |
| Stale intent (`expectedStatus` ≠ current) | **reject + resync tile** | Closes the read-modify-write race on a laggy snapshot. |

"Never silently lost": a head-unit STOP rides the engine's existing durable path (sequenced MMKV sync queue, in-order drain, dead-lettering). A head-unit disconnect mid-ride leaves the phone recording untouched; reconnect re-adopts state (same path as phone-first/AE5). CarPlay adds **no new loss path** — losing a ride requires the engine itself to fail, same risk profile as a phone-only ride today.

---

## 5. On-phone companion spec (MotoVault design system)

Lives under Profile → Settings → **CarPlay Companion**, plus a contextual entry from the Garage bike detail. New routes: `src/app/(modals)/carplay/index.tsx`, `.../cues.tsx`, `.../onboarding.tsx`; global `src/components/carplay/active-ride-banner.tsx`. Reuses `useEditorialTheme()` tokens + `tint()`; zero new hex. `theme.warm` = exhaust-copper.

### Screen 1 — Hub (start-mode + active bike)
- **Start-mode radio cards** (reuse `settings.tsx` radio-card pattern): Automatic (RECOMMENDED pill, with an inset keep-guard card showing "500 m / 2 min" + Adjust), Manual, Phone-first. Each card leads with the *consequence* ("Nothing logs until you say go"), not just a label — R14/R15 depend on the rider predicting behavior.
- **Active-bike selector:** full-width rows, copper ring on the active bike's photo (mirrors `bike-switcher.tsx`), GeistMono data sub-row (mileage · next service). Single-bike edge: locked-active with "Your only bike — rides log here."
- **Live status strip** (only when connected): copper pulse dot + GeistMono `AFRICA TWIN CONNECTED · RECORDING`.
- Footer nav rows → Confirmation cues, How it works.

### Screen 2 — Confirmation cues (R9)
- **Two independent channel toggles** (the only legitimate toggle use — additive, not exclusive): Audio tone, Haptic. `NativeToggle` tinted copper. Toggling a channel **on** previews it immediately (tone plays / `Haptics.notificationAsync(Success)` fires) — the setting is its own preview.
- **Caution row** (copper-tinted, only when both off): "With both off, auto-start is silent. You won't know a ride began until you glance at the tile."
- **Tone character** radio cards: Mechanical (default — rugged brand voice) / Chime / Voice; dimmed when audio off.
- **Test this cue** button plays the real sequence start ▸ pause ▸ resume with paired haptics.
- **Legend** maps each state to its sound, using the canonical state glyphs.
- **Honesty notes:** "If the nav voice talks over it, switch on Both"; silent-switch detection → "tone may be muted, haptic still works."
- Default: **Both on, Mechanical.**

### Screen 3 — Onboarding (3-card pager; auto on first connect, re-openable)
Editorial register (Instrument Serif headlines, generous air, one idea per card):
1. **ON THE BIKE SCREEN** — "Your ride, on the *cluster*." With a faithful scaled mock of the real CarPlay tile (best trust-builder), copper pulse-ring on the `● RECORDING` dot.
2. **RIDES ALONGSIDE YOUR NAVIGATION** — "Keep your *directions*." Two mini-tiles (nav stays / MotoVault glance) communicate R10/R11 visually.
3. **HOW IT STARTS** — "Pick your *start*." Inline 3-mode mini-picker so onboarding ends in a committed choice; CTA **Start riding** (`Haptics.impactAsync(Heavy)`). No-bike edge → "Add your bike first."

### Screen 4 — Connected / active-ride on the phone
The phone is a **confirmation surface, not a control mirror** (honors A2 single-write-authority; avoids pocket-taps and racing commands).
- **Persistent banner** above the tab bar: leading state glyph + GeistMono state word + distance · moving-time (tabular-nums), subline "controls on your head unit." Three-state variants (recording = copper pulse; auto-paused = amber, no pulse; acquiring = info-blue, dashes).
- **Tap-through status sheet** (`fullScreenModal`): Instrument Serif hero state, two metric tiles (distance + moving time = R6 primary pair), secondary climb + GPS row. The **only** control is a guarded **hold-to-confirm Stop** (copper/danger outline, ~900ms fill sweep, progressive Light haptic ticks at 33/66/100%, Success on complete). No pause on the phone (riding-moment action belongs on the toggle).
- Edge states: armed-auto ("Ready · auto-start armed"), manual ("start from the head unit"), phone-first handoff (gains "via CarPlay"), GPS-lost (freeze + last-known, not zero), disconnect (degrades to the normal phone-HUD banner).

### Type/motion conventions (phone)
GeistMono uppercase eyebrows (`letterSpacing ≈ size×0.2`), Instrument Serif italic for hero numerals/headlines, system-sans 600 for UI; `borderCurve:'continuous'`; `FadeInUp.delay(i*60)` staggers; haptics Light(select)/Heavy(start-stop commit)/Success(saved), gated on `EXPO_OS === 'ios'`; `fullScreenModal` not formSheet.

---

## 6. Accessibility & i18n (computed, not estimated)

### Color / contrast (phone) — real WCAG ratios on `cardDark #1E1C19`
- `signature500 #D4622E` text = **4.52:1** — passes AA normal by 0.02, a cliff. **Rule:** copper text below large size → use `signature400 #E8723A` (5.58:1); `signature500` only for large numerals (≥24px) and fills/borders.
- `signature600` text on dark = **3.46:1 — FAIL.** Fills/borders only.
- **white-on-copper button = 3.65:1 — FAIL.** Copper-filled controls use **dark ink labels** (black-on-copper = 5.26:1), not white.
- Recording green (7.46) / amber (7.92) / danger (4.52) healthy — but still pair with icon + label.

### Color-not-alone (both surfaces, BLOCKER)
Each of recording / auto-paused / GPS-acquiring must be distinguishable by **SF Symbol + text** — verifiable in grayscale. Fails otherwise for color-blind riders, daytime glare, and the vehicle's contrast themes.

### CarPlay theming
The **vehicle** owns light/dark (often tied to ambient/headlights), not the phone. Never hard-code a foreground assuming a background. Do **not** reproduce MotoVault night mode on the head unit — it inherits the vehicle's night theme.

### Dynamic Type
Design the CarPlay panel at the **largest** supported text size first (worst case = truncation). Truncation order explicit: state + distance never truncate; climb drops first. Numbers must not wrap.

### Units & i18n
- Units follow the **existing app preference** (same setting as `ride-hud.tsx`), not locale/CarPlay guess. Symbol always shown — bare "1050" is ambiguous (ft vs m differ ~3.3×).
- Locale-aware separators via `Intl.NumberFormat` ("12,4 km" de-DE).
- **Size CarPlay rows against German** (25–35% longer: "Aufzeichnung läuft", "Höhenmeter") + icon-led rows so a truncated label still reads from the glyph. Value leads, label secondary.
- RTL out of scope v1 (EU + Americas markets).

---

## 7. Anti-slop guardrails (enforced)

1. **(Blocker) State never color-only** — symbol + word on both surfaces; grayscale-distinguishable. (R4/AE3)
2. **(Blocker) R9 validated on the bike, dual-channel** — acceptance = *perceived on the Africa Twin under ducked nav audio*, not "emitted in code." (R9/AE2)
3. **(Blocker) CarPlay is template-expressible** — every element maps to `CPInformationTemplate` rows + SF Symbols + tint; no custom fonts/gauges/map; vehicle owns theme. (R2/R10)
4. **(Blocker) Copper text token rule** — `signature400` for small copper text; dark ink on copper buttons. (§6)
5. **(High) Glance hierarchy capped** — state + distance prominent; ≤2 secondary; controls in actions, not uniform rows; truncation order defined. (R6)
6. **(High) Units follow app preference, symbol always shown; size rows against German + largest Dynamic Type.**
7. **(Medium) Placeholders not zeros pre-lock; idle shows dashes + start affordance (manual).** (R7/R8/AE6)
8. **(Medium) Destructive stop guarded + announced** (two-step on CarPlay, hold-to-confirm on phone; VoiceOver states the guard). (R17/AE4)
9. **(Medium) No looping/ambient motion** on live surfaces; one sub-300ms state-change transition allowed (doubles as R9 visual backstop).
10. **(Medium) Bike status never silently stale** — visible "stop to refresh" or speed-gate. (R20)

---

## 8. Open items for planning (ce-plan)

1. **R9 audio routing on the real Africa Twin + helmet intercom** — does the ducked earcon reach the intercom or the phone speaker? Falsify on the bike; passive on-tile state is the net.
2. **Effective `CPInformationTemplate` row count + `CPListTemplate.maximumItemCount` on the Africa Twin TFT** — query at runtime; caps the panel.
3. **R6 primary-metric confirmation** — recommended state + distance (refine after bike testing).
4. **Two-step confirm vs hold-to-confirm for Stop on the actual head-unit toggle** (CarPlay); phone uses hold-to-confirm.
5. **Apple Watch fallback prevalence** — how many target riders pair a Watch (weights the haptic fallback).
6. **Keep-guard (R13) values** — the 500 m / 2 min in the mock is a placeholder; confirm and tie to AE7.

## 9. Build notes / files

- CarPlay surface needs native integration in the managed Expo app — `react-native-carplay` (ships an Expo config plugin) vs a custom plugin is a planning decision; add `com.apple.developer.carplay-driving-task` to `apps/mobile/app.config.ts` `ios.entitlements`.
- Extract shared primitives to `src/components/carplay/`: `state-indicator.tsx` (the canonical three-state glyph), `active-ride-banner.tsx`, `ride-status-sheet.tsx`, `start-mode-card.tsx`; lift `SectionLabel` + the pulse-ring from `settings.tsx` / `start-ride.tsx`.
- The CarPlay process is a command + projection head only — zero ride truth (§4).
- All copy through `t()` with `carplay.*` keys.
