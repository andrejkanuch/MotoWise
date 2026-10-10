---
name: MotoVault Mobile — Race Plate
description: Every bike carries a number plate, and the plate tells you whether it is ready.
colors:
  # Dark scheme (palette.plate*) — graphite ramp, bone ink
  graphite-ground: "#111214"
  graphite-card: "#1A1B1E"
  graphite-raised: "#232427"
  graphite-option: "#2E3034"
  graphite-line-step: "#3D3F44"
  bone-ink: "#ECE6DA"
  bone-ink-2: "#BDB8AE"
  bone-ink-3: "#8E8A83"
  bone-ink-4: "#5F5C57"
  line-dark: "rgba(236,230,218,0.09)"
  line-2-dark: "rgba(236,230,218,0.05)"
  exhaust-copper: "#D4622E"
  copper-text: "#EC8A5A"
  plate-ink: "#121315"
  go-green: "#4FB47A"
  info-blue: "#6C9BF2"
  # Plate-state triad (same fills in both schemes)
  plate-bone: "#ECE6DA"
  plate-signal: "#F2C230"
  plate-red: "#E5483A"
  # Light scheme (palette.plateLight*)
  light-ground: "#F3F2EF"
  light-card: "#FFFFFF"
  light-raised: "#EBE9E4"
  light-option: "#DEDBD4"
  light-line-step: "#C9C5BC"
  light-ink: "#141517"
  light-ink-2: "#45464A"
  light-ink-3: "#6B6C70"
  light-ink-4: "#9C9DA1"
  line-light: "rgba(20,21,23,0.10)"
  line-2-light: "rgba(20,21,23,0.05)"
  light-copper: "#B8501F"
  light-copper-text: "#A6461A"
  light-signal-ink: "#8A6700"
  light-red: "#C8352A"
  light-go: "#2E8A55"
  light-info: "#2F64C8"
typography:
  plate:
    fontFamily: "Barlow Condensed SemiBold (PlateCondensed-SemiBold)"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: "64px"
    letterSpacing: "-0.5px"
    fontFeature: "tnum"
  plate-compact:
    fontFamily: "Barlow Condensed SemiBold (PlateCondensed-SemiBold)"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: "42px"
    letterSpacing: "-0.3px"
    fontFeature: "tnum"
  figure:
    fontFamily: "Barlow Condensed SemiBold (PlateCondensed-SemiBold)"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "30px"
    fontFeature: "tnum"
  figure-small:
    fontFamily: "Barlow Condensed Medium (PlateCondensed-Medium)"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: "22px"
    fontFeature: "tnum"
  large-title:
    fontFamily: "Barlow Condensed Bold (PlateCondensed-Bold)"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "0.2px"
  sheet-title:
    fontFamily: "Barlow Condensed SemiBold (PlateCondensed-SemiBold)"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "0.2px"
  section-title:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "25px"
  body:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "17px (iOS) / 16px (Android)"
    fontWeight: 400
    lineHeight: "22px (iOS) / 24px (Android)"
  body-strong:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "17px (iOS) / 16px (Android)"
    fontWeight: 600
    lineHeight: "22px (iOS) / 24px (Android)"
  subhead:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  caption:
    fontFamily: "system-ui (SF Pro / Roboto)"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  chip: "10px"
  control: "12px"
  card: "16px"
  plate: "20px"
  sheet: "24px"
  island: "28px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
  xxxl: "40px"
components:
  bike-plate-ready:
    backgroundColor: "{colors.plate-bone}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "20px"
  bike-plate-due:
    backgroundColor: "{colors.plate-signal}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "20px"
  bike-plate-overdue:
    backgroundColor: "{colors.plate-red}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "20px"
  bike-plate-compact:
    typography: "{typography.plate-compact}"
    rounded: "{rounded.plate}"
    padding: "16px"
  button-primary-dark:
    backgroundColor: "{colors.exhaust-copper}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "52px"
  button-primary-light:
    backgroundColor: "{colors.light-copper}"
    textColor: "{colors.light-card}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "52px"
  button-cancel-dark:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "52px"
  button-primary-disabled-dark:
    backgroundColor: "{colors.graphite-option}"
    textColor: "{colors.bone-ink-4}"
    rounded: "{rounded.control}"
    height: "52px"
  grouped-group-dark:
    backgroundColor: "{colors.graphite-card}"
    rounded: "{rounded.card}"
  grouped-group-light:
    backgroundColor: "{colors.light-card}"
    rounded: "{rounded.card}"
  grouped-row:
    typography: "{typography.body}"
    padding: "12px 16px"
    height: "44px (iOS) / 48px (Android) minimum"
  choice-chip-dark:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone-ink-2}"
    rounded: "{rounded.chip}"
    padding: "0 16px"
    height: "44px"
  choice-chip-selected-dark:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.copper-text}"
    rounded: "{rounded.chip}"
  home-action-tile-dark:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.bone-ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "68px (iOS) / 64px (Android) minimum"
  tab-island-dark:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.bone-ink-3}"
    typography: "{typography.caption}"
    rounded: "{rounded.island}"
    padding: "8px"
    width: "max 520px"
  tab-island-light:
    backgroundColor: "{colors.light-card}"
    textColor: "{colors.light-ink-3}"
    rounded: "{rounded.island}"
    padding: "8px"
  ride-button:
    backgroundColor: "{colors.exhaust-copper}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.pill}"
    size: "52px"
---

# Design System: MotoVault Mobile — Race Plate

## Overview

**Creative North Star: "The Race Plate"**

Every bike carries a number plate, and the plate tells you whether it is ready. The app is built around one object: a rounded plate panel whose fill colour is the bike's readiness (bone = ready, signal yellow = due soon, red = overdue), printed with condensed racing numerals cut from plate lettering. The plate is reused wherever a bike appears (Home hero, Garage list, bike hub ride status, onboarding reveal), so a rider learns one object once.

Around the plate the world is quiet and mechanical: a five-step graphite ramp with bone ink in dark, a warm off-white ramp with near-black ink in light, exhaust copper reserved for actions and selection, and native system type for every sentence. Density is confident but grouped: native inset grouped rows, a strict 4pt grid, tabular figures, and one large condensed title per screen. Primary actions sit low and large (the Home action row, the seated Ride button, sticky sheet footers) for a rider with one hand and possibly gloves.

The world explicitly retires the previous "Bike Hub" editorial world: no serif, no italic display, no mono numerals, no eyebrows or section numbers, and no blue for medium priority. One diagonal livery stripe on the plate is the only rebellion against the grid.

**Key Characteristics:**
- The plate is the signature: state is a fill colour, not a badge.
- Light and dark are both first-class; every token has a value in each scheme.
- Copper means "act here" or "this is selected", never status, never a chart highlight.
- Barlow Condensed carries numbers and titles only; everything read as a sentence is the OS face and scales with Dynamic Type.
- Native idioms per platform: UISegmentedControl, form sheets with grabbers and header blur on iOS; Material segmented buttons, single-detent sheets and ripples on Android.

## Colors

A graphite-and-bone instrument palette with one warm action colour and a three-step state triad that belongs to the plate.

The token names in code are kept from the editorial era (`useEditorialTheme().t`): `bg`, `surface`, `surface2`, `surface3`, `ink`…`ink4`, `line`, `line2`, `warm` (copper), `warm2` (copper text). The bike hub reads the same palette through `useHubTheme()` (`ground`, `card`, `raised`, `option`, `track`). Both resolve from `palette` in `@motovault/design-system`; no colour literal lives in a component.

### Primary
- **Exhaust Copper** (dark `exhaust-copper`, light `light-copper`): fills primary buttons (sheet Save, Ride button, `EButton` primary), the active tab dot, toggle tint, inline date-picker accent, option-row check, progress fill, and the selected-chip border. Ink on copper is `onWarm`: `plate-ink` in dark, `light-card` (white) in light, because dark ink on light copper is only 3.7:1.
- **Copper Text** (dark `copper-text`, light `light-copper-text` in the hub / `light-copper` elsewhere): text-weight copper for links and text actions ("See all", "Open analytics", "Done") and selected chip labels.

### Plate-state triad
- **Plate Bone** (`plate-bone`): ready. Same fill in both schemes.
- **Signal Yellow** (`plate-signal`): due soon.
- **Plate Red** (`plate-red`): overdue.
- **Plate Ink** (`plate-ink`): the only ink printed on any plate state, and on copper in dark.

As text or dots on the ground (not plate fills) the triad uses its ink variants: `dueInk` = `plate-signal` in dark, `light-signal-ink` in light; `overdueInk` = `plate-red` in dark, `light-red` in light. Priority dots reuse them: low = ink-3, medium = ink-2, high = dueInk, critical = overdueInk.

### Neutral
- **Graphite ramp, dark** (`graphite-ground` → `graphite-card` → `graphite-raised` → `graphite-option` → `graphite-line-step`): screen ground, grouped cards and tab island, raised controls (cancel button, chip fill, row icon wells), selected Android segment and disabled primary, chart tracks.
- **Paper ramp, light** (`light-ground` → `light-card` → `light-raised` → `light-option` → `light-line-step`): the same five roles in light. Cards are pure white on an off-white ground.
- **Bone Ink, dark** (`bone-ink` → `bone-ink-4`): primary text, secondary text, captions and section labels, placeholders and chevrons.
- **Ink, light** (`light-ink` → `light-ink-4`): the same four roles in light.
- **Lines** (`line-dark` / `line-light`, and the fainter `line-2-*`): hairline row separators, sheet-footer top rule, island keyline, ripple colour.
- **Go / Info** (`go-green`, `info-blue`, light `light-go`, `light-info`): success (sheet primary DONE state) and informational series such as the ride speed chart. Not part of the plate triad.

### Sanctioned exceptions
- **Expense category hues.** Fourteen fixed category colours (`palette.hubCat*` in dark, `palette.plateLightCat*` in light, ≥3:1 on white), resolved with `hubCategoryColor(category, hub)`. The same hue marks a category on the Add-expense chip dot and in the Costs chart bar, and the category name always sits beside it. None is copper or a state colour, so a bar never reads as a warning or a button.
- **Ridden-route copper.** On maps (ride detail, flyover, trip detail, create trip) the ridden route is drawn in copper (`t.warm`): a 4px line over a 10px glow at 15% opacity. This is the one place copper is a data mark rather than an action, because the route is the rider's own trace.

### Named Rules
**The Copper Is a Verb Rule.** Copper marks an action or the current selection. It is never a status, a heading accent, a chart highlight or display type.

**The Triad Belongs to State Rule.** Bone, signal and red are reserved for readiness. Medium priority is graphite, never a hue; decorative use of yellow or red is forbidden.

**The Both-Schemes Rule.** No token ships with only one scheme's value. Light is not an inversion: the plate gains a 2px `plate-ink` keyline on light grounds, copper darkens, and status inks shift to text-safe variants (every text token clears 4.5:1 on card, ground and raised).

## Typography

**Display Font:** Barlow Condensed (registered as `PlateCondensed-Medium / -SemiBold / -Bold`)
**Body Font:** the platform's own face (SF Pro on iOS, Roboto on Android), set by weight only, never by `fontFamily`

**Character:** Racing-plate numerals against a native interface. The condensed face gives figures and titles the weight of plate lettering; the system face keeps every sentence native, accessible and Dynamic Type aware.

### Hierarchy
- **Plate** (SemiBold 600, 64/64, tabular; compact 40/42): the plate's big figure only. Fits to one line down to 0.6 scale, capped at 1.2× font scale.
- **Figure** (SemiBold 600, 28/30; small Medium 500, 20/22; tabular): stats, amounts, odometers, plate units. The Add-expense amount is figure at 40/44.
- **Title** (Large title Bold 700, 36/40; Sheet title SemiBold 600, 28/32): one condensed title per screen or sheet. iOS large navigation titles use `PlateCondensed-Bold`.
- **Section title** (system 600, 20/25): "Up next" and other in-page section heads, sentence case.
- **Body** (system 400, 17/22 iOS, 16/24 Android; strong 600): rows, captions on plates, button labels, inputs.
- **Subhead** (system 400, 15/20): compact plate caption, text actions.
- **Label** (system 500, 13/18) and **Caption** (system 400, 12/16): section captions above grouped cards, row subtitles, tab labels, plate identity edge.

### Named Rules
**The Condensed Means Number Rule.** Barlow Condensed carries plates, figures and titles. Anything a rider reads as a sentence uses the system face so it follows Dynamic Type.

**The Plain Voice Rule.** Sentence case everywhere. No serif, no italic, no eyebrows or kickers above titles, no section numbers, no letter-spaced uppercase labels.

## Layout

A strict 4pt grid: every gap, padding and margin is one of 4, 8, 12, 16, 20, 24, 32, 40. The screen gutter is 16. Sections on a screen and in a sheet are separated by 24; a caption sits 8 above its grouped card.

On a tablet, content stops at a **720pt readable column** (`readableWidth`: `maxWidth: 720`, centred); on a phone the column is wider than the screen and nothing changes. The tab island stops at 520pt and centres.

The Home first viewport is fixed in order: large condensed title, the hero plate (about the top third), a 4-up action row (Ride, Expense, Task, Diagnose; tiles 68pt iOS / 64dp Android, 8 apart), then "Up next" as inset rows. Scroll content reserves room for the floating tab island, whose real height is measured (`useTabBarStore`) because it grows with font scale.

Touch targets are 44pt on iOS and 48dp on Android. Fixed chrome (tab labels, segment labels, hub header, sheet titles) caps font scale at 1.3; body content scales freely, and rows stack their tag above the title from font scale 1.5.

## Elevation & Depth

Flat and tonal. Depth comes from stepping up the graphite (or paper) ramp: ground → card → raised → option. There is no drop shadow on cards, rows, plates or the tab island, and no native blur in the app body; the island is an opaque card-step surface with a hairline keyline so list text never reads through it. Over the bike hub an opaque ground-colour dock sits behind the island from 8pt above it to the screen edge.

The only blur is the iOS navigation header, pinned to the app scheme (`systemChromeMaterialDark/Light` on Profile, `systemMaterialDark/Light` on Garage), never the adaptive material that follows the system appearance.

### Named Rules
**The Ramp Is the Shadow Rule.** A surface is lifted by moving one step up the ramp, never by a shadow.

## Shapes

Continuous corners (`borderCurve: 'continuous'`) on every rounded element. Radii are role-based: chips and row icon wells 10 (wells 8), controls and buttons 12, grouped cards 16, the plate 20, form sheets 24, the tab island 28 (plate + 8), and pills/the Ride button fully round.

The only diagonal in the app is the livery stripe: two parallel bands rotated 45° through the plate's top-right corner. Everything else is orthogonal.

## Components

### Bike Plate (signature)
The bike's readiness as an object.
- **Anatomy:** figure row (plate figure + figure-weight unit, baseline aligned, kept clear of the stripe); one caption line beneath (body-strong on hero, subhead on compact, max 2 lines; prefixed with the state word only when the caption does not already say it); identity edge below a 1px rule at 16% ink: bold tabular racing number, then "make model · year" in label at 68% ink. No kicker above the figure.
- **Sizes:** hero (padding 20, gap 8, stripe 220/14/34) and compact (padding 16, gap 4, stripe 140/9/22).
- **States:** fill is the triad colour; ink is always `plate-ink`. On light grounds the plate carries a 2px `plate-ink` keyline; on graphite it has none.
- **Livery stripe:** a copper band and a half-width ground-colour band, so it reads as copper-plus-black in dark and copper-plus-white in light.
- **Motion:** settles in once (scale 0.98→1 with opacity, 240ms, exponential ease-out); a state change cross-fades the fill colour over 200ms. Pressed scale 0.985. Reduce Motion skips both.
- **Accessibility:** one button with the state word in its label.

### Inset grouped rows
- **Group:** card-step surface, radius 16, no border, clips its rows. Captions above (label, ink-3, 16 inset) and footers below (caption).
- **Row:** min height 44/48, padding 12 vertical, 16 sides; optional 28pt icon well on the raised step; body title, caption subtitle; trailing value (body, ink-3), state dot, or chevron (ink-4). The hairline separator starts at the text column and is omitted on the last row.
- **Press:** iOS tints the row with ink at 6%; Android uses a ripple at 8%. Toggles are native with copper tint; option rows show a copper check.

### Form sheets
- **Anatomy:** condensed sheet title top-left; sections 24 apart, each a label caption over an inset grouped card; rows 52 high with 18pt neutral icons; the amount as a 40pt condensed figure.
- **Sticky footer:** pinned above the keyboard (`KeyboardStickyView`) on a ground-colour bar with a 0.5px top hairline. Cancel (raised graphite, body-strong ink) beside a flexible copper primary, both 52 high, radius 12. Primary states: ready = copper / onWarm, disabled = option step / ink-4, done = success / onWarm.
- **Chips:** 44 high, radius 10, raised fill with 1.5px border; selected = copper border and copper-text label. Category chips carry their category dot; priority chips carry the priority dot.
- **Detents:** iOS keeps a resting + expanded pair (expense 0.7/0.9, task 0.85/1.0, complete task 0.65/0.85/1.0) with a visible grabber and 24 corner radius. Android gets a single 0.92 detent, because react-native-screens lays the sheet out at its largest detent and a lower one pushed the footer off screen.

### Tab bar island and Ride button
- **Island:** floats at the safe-area inset (minimum 12), spans the gutters (20) on a phone and caps at 520 on a tablet; card-step surface, hairline keyline, radius 28, 8 padding. Follows the system scheme everywhere, including over the hub. Fades in once (240ms).
- **Tabs:** Home, Discover, Garage, Profile. 22pt Lucide icon and caption label; active = ink with semibold label and a 4pt copper dot beneath, inactive = ink-3. Labels shrink to fit instead of wrapping. The Garage badge is a danger-red count bubble.
- **Ride button:** a 52pt copper circle seated inside the island row between Discover and Garage (not rising out of it), route icon in onWarm. While a ride records it gently pulses (1→1.12) and shows elapsed time in copper text below; Reduce Motion stops the pulse. Medium haptic on iOS.
- **Over sheets:** on iOS the native sheet covers the bar; on Android the island is not drawn while a logging sheet is on top of the stack.

### Segmented control
- **iOS:** native `UISegmentedControl`, appearance pinned to the app scheme.
- **Android:** Material single-choice segmented buttons in graphite: selected = option step with ink, unselected = card step with ink-2, line borders. Selection is a raised surface, never copper.

### Buttons and chips (shared kit)
`EButton` primary is copper with onWarm ink; ghost is transparent with a line border; solid is the raised step; danger is red text. `EChip` active fills copper with onWarm ink; inactive is raised with ink-2.

### Platform chrome
- Status bar style follows the resolved **app** scheme (light content in dark, dark content in light), not the system.
- iOS headers: large titles in the condensed face, transparent with app-scheme blur, no shadow, minimal back button. Android headers: opaque ground colour.
- Android pressables use ripples; iOS uses opacity or tint plus haptics.

## Do's and Don'ts

### Do:
- **Do** show a bike's readiness with the Bike Plate wherever a bike appears, using the triad fill and `plate-ink`.
- **Do** resolve every colour from `useEditorialTheme()` / `useHubTheme()` and ship both scheme values for any new token.
- **Do** use copper only for a primary action, a link, or the current selection, with `onWarm` as its ink.
- **Do** use `dueInk` / `overdueInk` for due and overdue text or dots on the ground, never the plate fills.
- **Do** set numbers in the condensed figure roles with tabular digits, and sentences in the system face.
- **Do** keep every spacing value on the 4pt scale and every screen inside the 720pt readable column.
- **Do** build forms as inset grouped sections with the sticky Cancel + copper primary footer.
- **Do** keep a category's hue identical on its chip and its chart mark, with the name beside it.
- **Do** respect Reduce Motion: the plate settle and state fade drop to 0ms.

### Don't:
- **Don't** use a serif, italic, or mono face anywhere.
- **Don't** put an eyebrow, kicker or section number above a title, or set labels in letter-spaced uppercase.
- **Don't** use copper for status, a chart highlight, or display text (the ridden route on a map is the one exception).
- **Don't** use bone, signal or red decoratively, or give medium priority a hue.
- **Don't** add drop shadows or translucent blur to cards, rows or the tab island; step up the ramp instead.
- **Don't** add another diagonal: the livery stripe is the only one.
- **Don't** give Android form sheets more than one detent, or draw the tab island over an Android sheet.
- **Don't** pin a header blur, segmented control or status bar to the system appearance; follow the app scheme.
