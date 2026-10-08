---
name: MotoVault Mobile — Bike Hub
description: Dark, warm instrument-panel UI for a rider's bike — copper for action, mono for every number, serif for the bike's name.
colors:
  copper: "#D4622E"
  copper-text: "#E07A48"
  copper-ink: "#1A1410"
  ground: "#141210"
  card: "#1E1C19"
  raised: "#2A2724"
  option: "#26231F"
  track: "#4A4640"
  text: "#F3EEE6"
  text-soft: "#E6E0D6"
  dim: "#B5ADA2"
  muted: "#9C958A"
  late: "#FF7A6B"
  soon: "#F0A050"
  medium: "#7DA9F0"
  low: "#A39B8F"
  ok: "#5FC8A0"
  not-ready-dot: "#FF5A4A"
  tag-crit-bg: "#3A1A16"
  tag-high-bg: "#3A2412"
  tag-med-bg: "#172538"
  tag-low-bg: "#2A2824"
  status-not-ready: "#2A1512"
  status-check: "#241D15"
  status-ready: "#152019"
  row-critical: "#241715"
  chip-on: "#2A2017"
  hairline: "rgba(255,255,255,0.06)"
  hairline-strong: "rgba(255,255,255,0.08)"
  field-border: "rgba(255,255,255,0.1)"
  dashed: "rgba(255,255,255,0.18)"
  photo-chip: "rgba(20,18,16,0.78)"
  tab-bar: "rgba(20,18,16,0.96)"
typography:
  numeral-display:
    fontFamily: "Geist Mono"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: "46px"
    letterSpacing: "-0.88px"
  figure:
    fontFamily: "Geist Mono"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: "34px"
    letterSpacing: "-0.64px"
  serif-page:
    fontFamily: "Instrument Serif"
    fontSize: "30px"
    fontWeight: 400
  serif-sheet:
    fontFamily: "Instrument Serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: "30px"
  serif-status:
    fontFamily: "Instrument Serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "26px"
  serif-name:
    fontFamily: "Instrument Serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "24px"
  keypad:
    fontFamily: "Geist Mono"
    fontSize: "24px"
    fontWeight: 500
  stat-value:
    fontFamily: "Geist Mono"
    fontSize: "17px"
    fontWeight: 500
  button:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "15px"
    fontWeight: 700
  button-sheet:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "16px"
    fontWeight: 700
  title:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "18px"
  body:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  body-sm:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "19px"
  sub:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
  action-text:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "14px"
    fontWeight: 600
  segment-label:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  odometer-chip:
    fontFamily: "Geist Mono"
    fontSize: "13px"
    fontWeight: 500
  eyebrow:
    fontFamily: "Geist Mono"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.08em"
  eyebrow-sm:
    fontFamily: "Geist Mono"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "13px"
    letterSpacing: "0.08em"
  tag:
    fontFamily: "Geist Mono"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: "12px"
    letterSpacing: "0.06em"
rounded:
  tag: "5px"
  photo-chip: "7px"
  segment: "10px"
  chip: "10px"
  tile: "10px"
  button: "14px"
  card: "16px"
  sheet: "24px"
  pill: "26px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  row-inset: "14px"
  gutter: "16px"
  xl: "20px"
  xxl: "24px"
components:
  action-pill:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px 0 16px"
    height: "52px"
  action-pill-icon:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    rounded: "{rounded.pill}"
    size: "52px"
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    typography: "{typography.button-sheet}"
    rounded: "{rounded.button}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    height: "48px"
  segment-pill:
    textColor: "{colors.dim}"
    typography: "{typography.segment-label}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "36px"
  segment-pill-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.segment-label}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "36px"
  odometer-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.odometer-chip}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "36px"
  hub-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
  list-row:
    textColor: "{colors.text}"
    typography: "{typography.title}"
    padding: "12px 12px 12px 14px"
  icon-tile:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.tile}"
    size: "36px"
  tag-crit:
    backgroundColor: "{colors.tag-crit-bg}"
    textColor: "{colors.late}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  tag-high:
    backgroundColor: "{colors.tag-high-bg}"
    textColor: "{colors.soon}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  tag-med:
    backgroundColor: "{colors.tag-med-bg}"
    textColor: "{colors.medium}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  tag-low:
    backgroundColor: "{colors.tag-low-bg}"
    textColor: "{colors.low}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  ride-status-ready:
    backgroundColor: "{colors.status-ready}"
    textColor: "{colors.text}"
    typography: "{typography.serif-status}"
    rounded: "{rounded.card}"
    padding: "14px 14px 14px 16px"
  ride-status-check:
    backgroundColor: "{colors.status-check}"
    textColor: "{colors.text}"
    typography: "{typography.serif-status}"
    rounded: "{rounded.card}"
    padding: "14px 14px 14px 16px"
  ride-status-not-ready:
    backgroundColor: "{colors.status-not-ready}"
    textColor: "{colors.text}"
    typography: "{typography.serif-status}"
    rounded: "{rounded.card}"
    padding: "14px 14px 14px 16px"
  undo-snackbar:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
    height: "48px"
  log-option-row:
    backgroundColor: "{colors.option}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "14px 16px"
  keypad-key:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.keypad}"
    rounded: "{rounded.button}"
    height: "56px"
  field-quick-note:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "36px"
  sheet:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sheet}"
---

# Design System: MotoVault Mobile — Bike Hub

<!-- Scope: this records the INCUMBENT bike-hub world as shipped in code (apps/mobile/src/components/bike-hub, phase 1 of the bike-detail redesign, 3.22.0). It is the direction for the whole mobile app. Sources of truth, in order: components/bike-hub/ui/tokens.ts → packages/design-system/src/palette.ts → the ui/, sheets/, overview/, notes/ components. Intent lives in docs/design/app-screens/05-garage/02-bike-detail/redesign/DESIGN-SPEC.md; where code and spec disagree, this file records the code value and names the divergence. -->

## Overview

**Creative North Star: "The Instrument Cluster"**

The bike hub reads like the dash of a well-made motorcycle at dusk: a warm near-black ground, a few lit readouts, and one copper control you reach for. Numbers are set in a monospace like gauge digits; the bike's name and the one-line ride verdict are set in a soft editorial serif, the only place the UI raises its voice. Everything else is quiet, warm-tinted sans on dark graphite. Information is ranked, not decorated: ride status first, then what needs attention, then what is next, then money, then notes and papers.

Density is confident rather than sparse. Cards hold several rows separated by hairlines, every row has a title plus a two-line sub-line, and money figures always carry their basis line. Colour is semantic and rationed: red-coral and amber mean late and soon, green means ready, blue means medium priority, and copper means "press here". Depth comes from tonal steps of warm graphite and 6–8 % white hairlines, not shadows; the floating action pill is the one lifted object.

The hub is dark in both system colour schemes; there is no light hub yet. It replaces the legacy "editorial" layer (`theme/editorial.ts`): the Service, Costs and Bike segments still wrap the old `MaintenanceSection`, `ExpensesSection`, `DocumentsSection` and `BikeDetailsCard`, pinned dark through `EditorialSchemeProvider` so they sit on the same ground. Those sections are off-system (system font with `fontWeight`, editorial ink/warm tokens, blue `primary500` actions, a serif-italic section title) and are slated for replacement in phases 2–5; do not copy them.

**Key Characteristics:**
- Dark-only, warm-tinted surfaces: ground → card → raised, each a few lightness points apart.
- Three typefaces with fixed jobs: Geist Mono for every number, tag and eyebrow; Plus Jakarta Sans for UI; Instrument Serif for the bike name, sheet titles, the ride-status verdict and the Notes page title.
- Copper is action-only: one filled copper control per screen region, dark ink on it.
- Status colour always has words beside it; priority is a tag, lateness is a due line.
- Continuous (squircle) corners on every rounded surface; 16 px cards, 14 px buttons, 26 px pill.
- Haptics on iOS for every press; Material tabs and ripple on Android.

## Colors

A warm-graphite night palette with one hot copper accent and a small, strictly semantic status set; every value lives in `palette` (the `hub*` block) and is aliased in `hub` in `ui/tokens.ts`.

### Primary
- **Exhaust Copper** (`palette.signature500`): the fill of the one primary action: the floating Log / action pill, sheet Save buttons, the Notes composer "Add" button, the Overview quick-note button, the Android segment indicator and the odometer entry caret. Never status, never decoration.
- **Heated Copper** (`palette.hubCopperText`): copper as *text* on dark: section-header actions ("Full costs"), "Retry", snackbar "Undo", highlighted odometer chips. Lighter than the fill so it passes contrast on card and raised surfaces. At 50 % alpha it is the border of a selected chip.
- **Copper Ink** (`palette.hubInk`): text and icons on copper. White on copper fails contrast; this near-black brown is mandatory.

### Secondary (status)
- **Warning-Light Coral** (`palette.hubLate`): past due, CRIT tag text, the Service badge count, inline save errors and destructive text actions. At 40 % alpha it borders an overdue Critical row; at 35 % it borders the "Not ready" card.
- **Amber Lamp** (`palette.hubSoon`): due soon (within 30 days or 2,000 km / 1,200 mi), HIGH / SAFETY / DOC tag text, "Couldn't refresh", odometer warnings, the Expense log-option icon, and (in the Costs card) a year-over-year increase.
- **Ready Green** (`palette.hubOk`): "Ready to ride" dot and border, the "Work already done" icon, a year-over-year decrease.
- **Gauge Blue** (`palette.hubMedium`): MED tag text only.
- **Not-Ready Signal** (`palette.hubNotReadyDot`): the dot on the "Not ready" card; brighter than Coral so a 10 px dot still reads.

### Tertiary (tinted fills)
- **Tag fills**: CRIT `tag-crit-bg`, HIGH `tag-high-bg`, MED `tag-med-bg`, LOW `tag-low-bg`: deep, low-chroma versions of their text colours.
- **Status card fills**: `status-not-ready`, `status-check`, `status-ready`: the ride-status card takes the tint of its verdict; "Nothing tracked yet" uses the plain card.
- **Critical row** (`palette.hubRowCritical`): the only row that gets a tinted background, an overdue Critical task (used from phase 2).
- **Selected chip** (`palette.hubChipOn`): selected chips in sheets.

### Neutral
- **Workshop Black** (`palette.surfaceDark`): the ground of the hub, header and segment bar; also the inset fill of quick-note fields and odometer chips sitting on a card.
- **Warm Graphite** (`palette.cardDark`): cards, the odometer header chip and every hub form sheet's background.
- **Raised Graphite** (`palette.hubRaised`): the selected segment pill, secondary buttons, keypad keys, neutral icon tiles, the undo snackbar.
- **Option Graphite** (`palette.hubOption`): rows of the Log sheet.
- **Track Grey** (`palette.hubTrack`): the Android sheet grabber, the "other" share of the category bar, off switches.
- **Bone** (`palette.hubText`): primary text and icons.
- **Soft Bone** (`palette.hubTextSoft`): note body text, a step down so long text does not glare.
- **Dust** (`palette.hubDim`): secondary text: sub-lines, ride-status reasons, unselected segment labels, Cancel.
- **Stone** (`palette.hubMuted`): eyebrows, meta, chevrons, placeholders, the grey half of a due line (holds 4.5:1 on raised).
- **Low Grey** (`palette.hubLow`): LOW tag text.
- **Hairlines**: `hairline` (`whiteAlpha06`) for card borders and row dividers; `hairline-strong` (`whiteAlpha08`) for chips, the snackbar, search and quick-note fields; `field-border` (`whiteAlpha10`, exposed as `hub.ripple`) for the Notes composer and odometer chips and as the Android ripple colour; `dashed` (`whiteAlpha18`) for the dashed "Add a photo" border.
- **Overlays**: `photo-chip` (ground at 78 %) behind chips on the bike photo and the uploading scrim; `tab-bar` (ground at 96 %).

### Named Rules
**The Copper Is a Button Rule.** Copper means "press this". It never marks status, never highlights a chart bar and never decorates a heading. If it is copper and not tappable, it is a bug.

**The Words Beside the Colour Rule.** No colour carries meaning alone: every status dot sits beside the verdict, every tag has its label, every category bar segment has an accessibility label.

**The No-Literals Rule.** Components read `hub.*` from `ui/tokens.ts`; tints are derived with `withAlpha(palette.x, a)`. A hex or `rgba()` literal in a hub component fails review.

## Typography

**Display Font:** Instrument Serif (registered as `InstrumentSerif-Regular`, system serif until loaded)
**Body Font:** Plus Jakarta Sans (registered as `HubSans-Regular / -Medium / -SemiBold / -Bold`)
**Label/Mono Font:** Geist Mono (registered as `HubMono-Regular / -Medium`)

**Character:** A workshop pairing: a geometric, slightly warm sans that stays out of the way, a gauge-like mono that makes every number and tag feel measured, and one soft serif that gives the bike's name and the ride verdict a human, crafted voice.

The hub families are registered under hub-only keys in `app/_layout.tsx` (lead decision D6): one family per weight, never combined with `fontWeight`. The ~130 older usages of `PlusJakartaSans*` / `GeistMono*` elsewhere in the app point at names that are never loaded and render in the system font.

### Hierarchy
- **Numeral display** (Mono Medium, 44/46, −0.88 tracking): the odometer entry in the Odometer sheet. One per screen.
- **Figure** (Mono Medium, 32/34, −0.64 tracking; 28/30 in the empty state): the year's cost total in the Costs card. Shrinks to fit, never truncates.
- **Serif titles** (Instrument Serif 400): Notes page title 30; sheet titles 26/30 (Log, Odometer); Note sheet title 24; ride-status verdict 24/26; bike name in the header 22/24, scaling to 17 when the header collapses.
- **Keypad numerals** (Mono Medium 24) on 56 px keys.
- **Stat value** (Mono Medium 17; the Costs card overrides to 16).
- **Title** (Sans SemiBold 15/18): row titles, two lines max. Log-sheet option titles are 16.
- **Body** (Sans 15/21, Soft Bone): note text. **Body small** (Sans 14/19): note previews, ride-status error, empty-state and "see all" lines.
- **Sub-line** (Sans 13/16, Dust): row sub-lines and due lines, wrapping to two lines (`HUB_ROW_SUB_LINES`) before ellipsizing. Detail lines in cards use 13/17.
- **Button** (Sans Bold 15 on the pill and composer, 16 on sheet Save, 13 on the 36 px quick-note button). Text actions: Sans SemiBold 13–15 in Heated Copper (13 in section headers, 14 in cards and sheets, 15 on full-screen states).
- **Segment label** (Sans SemiBold 13 on iOS pills, 14 on Android tabs).
- **Caption** (Sans 12, Stone or Coral): hints, odometer notices, inline save errors, note meta. Stat basis lines drop to Sans 11.
- **Eyebrow** (Mono 11, uppercase, 0.08 em, Stone): section headers ("NEEDS ATTENTION · 3") and sheet field labels. **Eyebrow small** (Mono 10/13, uppercase, 0.08 em): the header's "2022 · HONDA" and stat eyebrows.
- **Tag** (Mono Medium 10/12, 0.06 em): CRIT / HIGH / MED / LOW / SAFETY / DOC. Badge and photo-chip text use Mono 11.

### Named Rules
**The Every-Number-Is-Mono Rule.** Odometer, money, counts, dates in stamps, tags and eyebrows are Geist Mono. A number in sans is a bug (the one sanctioned exception is the Top-category stat, which is a word plus a percentage).

**The Three-Serif-Moments Rule.** Instrument Serif is for the bike's name, sheet and page titles, and the ride-status verdict. Never a section heading: section headers are mono eyebrows.

**The Chrome Cap Rule.** Text inside fixed-size chrome (header, odometer chip, segment labels, action pill, sheet titles, keypad, sheet bodies) sets `maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}` (1.3). Body content (rows, cards, notes) is uncapped and must reflow; the hub is verified at AX5.

## Layout

A single column on a 16 px gutter. The hub is a persistent header (back · serif name over mono eyebrow · odometer chip, 12 px side padding, 48 px row collapsing to 44 px on scroll) over a segment bar (Overview · Service · Costs · Bike), then one scroll per segment. On iOS the segment bar is a horizontally scrollable row of 36 px pills with a 6 px gap and 16 px side padding; on Android it is four equal-width 48 dp Material tabs with a 2 dp copper indicator that slides in 200 ms.

Overview stacks its blocks with a 12 px gap and 12 px top padding: photo band (150 px; 120 px dashed empty state) → ride-status card → Needs attention (max three rows, then "N more") or the set-up list → Next up → Costs → Notes → Papers & bike rows. A block that renders nothing is removed from the list so it leaves no orphan gap. Within a block, the section header sits 8 px above its card.

The spacing rhythm is 2 / 4 / 6 / 8 / 12 / 14 / 16 with occasional 20 / 24; 8, 12, 16 and 6 dominate. These values are literal in components; the hub does not use the shared `spacing` scale in `@motovault/design-system` and has no spacing token object of its own.

The bottom is owned by geometry, not guesses: the floating tab bar's real height is measured (`useTabBarStore`, fallback `HUB_TAB_BAR_HEIGHT` 65); the action pill floats `HUB_PILL_GAP` (16) above it at the right edge; segment content gets `HUB_PILL_CLEARANCE` (16 + 52 + 76 = 144) of extra bottom padding so the last row's chevron scrolls clear of the pill. Safe-area insets are always applied; the header pads by the top inset.

Form sheets (Log, Odometer, Note) are native `formSheet`s on Warm Graphite with 24 px corners; Log and Odometer fit to content, the Note sheet is full height. Sheet content sits on 16 px padding with 10 px between Log options. Under large text every sheet scrolls (`SheetScroll`) so Save is always reachable.

## Elevation & Depth

Depth is tonal, not shadowed. Surfaces step up in lightness from Workshop Black (ground) to Warm Graphite (card) to Raised Graphite (selected, secondary, keys), and every card edge is a 1 px white hairline at 6 %. Tinted fills (status cards, tag fills, the critical row) add meaning, not height. The uploading scrim over the photo is ground at 78 %.

### Shadow Vocabulary
- **Floating pill** (`shadowColor: palette.black`, offset 0/8, opacity 0.45, radius 12; Android `elevation: 6`): the action pill only, because it floats over scrolling content. Matches the mock's `0 8px 24px rgba(0,0,0,0.45)`.

### Named Rules
**The One Lifted Object Rule.** Only the floating action pill casts a shadow. Cards, rows, sheets and the snackbar are flat; separate them with tone and hairlines.

## Shapes

Every rounded surface uses `borderCurve: 'continuous'`, so corners are squircles rather than circular arcs; that is the hub's signature silhouette. The radius scale is small and role-bound (`HUB_RADIUS`): 5 px tags, 7 px photo chips, 10 px segment pills / chips / icon tiles / quick-note fields, 14 px buttons, keypad keys, the snackbar and composer fields, 16 px cards and the photo band, 24 px form sheets, 26 px for the 52 px action pill (a full capsule). True circles (the 10 px status dot, the 18 px badge, the 24 px photo-remove button) use half-height radii.

Borders are 1 px and almost always a white hairline; the only coloured borders are the status-card tint, a failed field (Coral) and a selected chip (copper at 50 %). The empty photo state is the one dashed border. Icons are lucide line icons at 14–22 px, stroke 1.8–2.5, never filled.

## Components

### Buttons
Tactile and few: one copper fill per region, everything else tonal or text.
- **Action pill (signature):** copper capsule, 52 px tall, 26 px radius, Copper Ink 20 px icon (stroke 2.5) plus Sans Bold 15 label, 16 px left / 20 px right padding. Labelled "Log" on Overview (opens the Log chooser); icon-only 52 px circle on other segments. Floating pill shadow. Press: scale 0.98 + light impact haptic.
- **Primary (sheet Save):** copper, 52 px, 14 px radius, Sans Bold 16 in Copper Ink. Disabled 40 % opacity; pressed 85 %.
- **Secondary:** Raised Graphite, 48 px, 14 px radius, Sans SemiBold 15 in Bone ("Done" under the date picker).
- **Small primary:** 36 px copper, 10 px radius, plus-icon + Sans Bold 13 (Overview quick note). The Notes composer "Add" is a 48 px copper button.
- **Text actions:** Heated Copper Sans SemiBold, no fill, touch target grown to 44/48 with hit slop; pressed 60 % opacity. Destructive actions are Coral text only.
- Heights come from `HUB_HEIGHT` (52 / 48 / 36); anything shorter than `HUB_TOUCH_TARGET` (44 pt iOS / 48 dp Android) gets hit slop up to it.

### Chips
- **Odometer chip (header):** 36 px, Warm Graphite with hairline-strong border, 10 px radius, gauge icon + Mono Medium 13 value and unit ("23,716 km"); reads "Set odometer" when unset. The only odometer on the page.
- **Quick-add chips (Odometer sheet):** 40 px, Workshop Black with `field-border`, 11 px radius, Mono 13; highlighted chip = copper text and 50 % copper border.
- **Photo chips:** ground at 78 %, 7 px radius, Mono 11 Bone ("PRIMARY", "38 rides").
- **Segment pills:** 36 px, min width 72, 10 px radius; selected = Raised Graphite fill + Bone label, unselected = transparent + Dust label. The Service pill carries an 18 px Coral-on-CRIT badge with the overdue Critical/High count.

### Cards / Containers
- **Corner Style:** continuous 16 px.
- **Background:** Warm Graphite; ride-status cards use their verdict tint.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1 px hairline (6 %); status cards use the verdict colour at 30–35 %.
- **Internal Padding:** 14–16 px (16 for the Costs card, 14/16 for the status card); multi-row cards pad per row instead.
- A pressable card is one Pressable (scale 0.98, light haptic); it never nests another pressable.

### Inputs / Fields
- **Quick note (Overview):** 36 px, Workshop Black inset on the card, 10 px radius, hairline-strong border, Sans 14 Bone, Stone placeholder.
- **Notes composer / search:** 48 px (composer) or 40 px (search), Warm Graphite, 14 / 11 px radius, `field-border` / hairline-strong border, Sans 15 / 14.
- **Note sheet body:** Sans 16/23 in a 14 px-radius field.
- **Error:** the border turns Coral and a 12 px Coral caption appears under the field, announced politely. Draft text is never cleared on failure.
- **Odometer keypad:** the app's own pad on both platforms, 3×4 grid of 56 px Raised Graphite keys (14 px radius, 8 px gap), Mono Medium 24 numerals, selection haptic per key; bottom row = date · 0 · delete (long-press clears).

### Navigation
- **Header:** 44 px back target with a 22 px chevron (pressed 60 %), centred serif name over a mono eyebrow, odometer chip right. On scroll the name scales 22 → 17, the eyebrow fades by 60 % of the collapse and the row shrinks 48 → 44 (transforms and opacity only; scroll-driven, 150 ms sync).
- **Segment bar:** iOS pills with a selection haptic; Android Material tabs with ripple and sliding indicator. `tablist` / `tab` roles; the badge count is part of the Service tab's label.
- Back is origin-aware ("Back to Garage / Home / Profile"); the native edge-swipe back stays enabled.

### List Rows
The content of every hub list: optional 36 px icon tile (10 px radius, tinted fill, 18 px icon) · title (Sans SemiBold 15/18, two lines) over a sub-line (Sans 13/16 Dust or a due line, two lines) · trailing tag or Stone chevron. 12 px vertical padding, 14 px left / 12 px right, 12 px gap, hairline divider except on the last row. Pressed 70 % opacity + light haptic.

### Priority Tag and Due Line (signature pair)
- **Tag:** Mono Medium 10 on its tinted fill, 5 px radius, 3 × 6 px padding; a fixed 44 px column in task lists. CRIT / HIGH / MED / LOW for priority; SAFETY / DOC on attention rows (amber, or CRIT colours when severe or expired).
- **Due line:** leads with the nearer limit, coloured Coral (past), Amber (soon) or Dust (plain), then " · " and the other limit in Stone ("201 days late · 3,933 km to target"). The second part turns Coral when it has passed too. Always in the bike's own unit, never converted.

### Ride-Status Card
Status dot (10 px) · serif verdict 24/26 ("Ready to ride", "Check before riding", "Not ready", "Nothing tracked yet") over a 13/17 Dust reason line · chevron to the top attention row. Fill and border take the verdict tint. While tasks or documents are loading it renders an empty placeholder at 60 % opacity; on error, a Dust line with a copper Retry.

### Stat
Eyebrow small (shrinks to 85 % then wraps, never truncates) · Mono Medium value (shrinks to fit) · one-line Sans 11 basis ("9 months"). A stat is never pressable on its own; its card is.

### Undo Snackbar
Raised Graphite, 48 px min height, 14 px radius, hairline-strong border; Sans Medium 14 message, Sans Bold 14 copper "Undo" (and an optional second action). Enters FadeInUp 250 ms, exits FadeOutDown 200 ms; `alert` role with a polite live region. Five-second window owned by `useDeferredDelete`. Deletes of tasks, notes and expenses use it instead of a dialog.

### Refresh-Failed Line
"Couldn't refresh · Retry" in Sans 13/18: Amber message, copper Retry, wrapping onto a second line at large sizes. The block keeps its last data. One announcement per 2-second window across all blocks.

### Motion
Reanimated v4 only, all under 300 ms: Overview blocks enter FadeInUp 200 ms with a 15 ms stagger; segment indicator 200 ms; header collapse 150 ms; note-row swipe snap 180 ms; photo fade 180–200 ms. Reduce Motion is left to Reanimated's default (`ReduceMotion.System`).

## Do's and Don'ts

### Do:
- **Do** take every colour from `hub` in `components/bike-hub/ui/tokens.ts` (backed by `palette.hub*`), and derive tints with `withAlpha`.
- **Do** set `borderCurve: 'continuous'` beside every `borderRadius`, and use `HUB_RADIUS` (card 16, button 14, pill 26, segment/chip/tile 10, tag 5, photo chip 7) and `HUB_SHEET_RADIUS` (24).
- **Do** use `HUB_FONT` families, one per weight, with no `fontWeight`; Geist Mono for every number, tag and eyebrow.
- **Do** keep one copper fill per screen region and put Copper Ink (`hub.ink`) on it.
- **Do** give every control `HUB_TOUCH_TARGET` (44 pt iOS / 48 dp Android), using hit slop on 36 px chips and text actions.
- **Do** fire `triggerImpact()` on presses and `triggerSelection()` on segment and keypad changes; the helpers are iOS-only by design.
- **Do** cap chrome text at `HUB_CHROME_MAX_FONT_SCALE` (1.3) and let body rows wrap to `HUB_ROW_SUB_LINES` (2).
- **Do** use `SectionHeader` (mono 11 eyebrow, optional count, copper text action) for every section, and `HubCard` + `ListRow` for every list.
- **Do** put a basis line under every money stat and words beside every status colour.
- **Do** use native `formSheet` with Warm Graphite content for create/edit, and the 5-second `UndoSnackbar` for deleting tasks, notes and expenses.

### Don't:
- **Don't** use copper for status, chart bars, headings or any non-tappable element.
- **Don't** add drop shadows to cards, rows, sheets or the snackbar; only the floating action pill casts one.
- **Don't** write hex or `rgba()` literals in components, or reach for `palette.*` directly from a hub component instead of `hub.*`.
- **Don't** use Instrument Serif for section headings, or sans for numbers.
- **Don't** put white text on copper.
- **Don't** add an "OVERDUE" pill: priority is the tag, lateness is the due line.
- **Don't** copy the legacy editorial sections (`maintenance-section`, `expenses-section`, `documents-section`, `bike-details-card`, `swipeable-task-card`): system font with `fontWeight`, `palette.primary500` blue actions, `InstrumentSerif-Italic` section titles and editorial ink tokens are the layer being replaced.
- **Don't** use the RN `Animated` API, or any transition longer than 300 ms.
- **Don't** add badges, streaks or celebratory illustration: no gamification.
- **Don't** nest a pressable inside a pressable `HubCard`; split the row into sibling Pressables instead.
