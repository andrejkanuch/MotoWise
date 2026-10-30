# it4 · /bolder + /overdrive — where the site is too safe, and the one effect it can carry (research only, nothing edited)

Scope: `lens/SCOPE.md`. World: `DIRECTION.md` (copper is a verb, triad belongs to state, one diagonal, the ramp is the shadow, motion = transform/opacity entrances), `apps/mobile/DESIGN.md` (the Bike Plate anatomy: hero 64/64 · stripe 220/14, compact 40/42 · stripe 140/9), `it3-delight.md` (kept: the settle, the stripe-lay, the two-plate ledger; rejected: odometer digits, stroke-draw, copper underline), craft-floor + new-work "Both paths" (the first viewport is a thesis; prove, don't claim; build the form's web leverage; pace the scroll like a studio). Paths are `apps/web/src/` unless noted.

Method. Read the rendered HTML of `/`, `/features/garage-management`, `/features/expense-tracking`, `/compare`, `/explore`, `/pro`, `/trips/cl/cl-nb/nevados-de-chilln-chilln-to-the-termas`, `/get`, `/login` (all 200; plates/settles/reveals/frames counted) and the code behind each first viewport. Two facts that decide the overdrive section: the installed `react@19.2.3` exports no `ViewTransition` (Next's guide needs React 19.3), and the brief's own trip renders `polyline: null` with five waypoints.

**Where the quiet comes from.** Every page now speaks one dialect, and the system's two strongest moves — the Bike Plate and the full-bleed photograph — are used at their *smallest* settings: the shared object is the compact plate everywhere (264px under a 150px headline), the explore photograph is a rounded 4:5 card, the route page's first viewport has no route, and five of seven feature pages open on text with the app below the fold. The amplifications below spend nothing new: they turn the system's own dials up.

## Bolder — five places that are too safe

| # | File | What is timid now | Exact change (tokens only) | Cost |
|---|---|---|---|---|
| B1 | `components/marketing/bike-plate.tsx` (owner), `components/marketing/design-system.css` `.mv-plate*` block (owner), `components/marketing/hero.tsx:104` (owner) | **The home hero's plate is the compact plate.** `.mv-plate` is DESIGN.md's *compact* anatomy (figure 40/42, padding 16/20, stripe 140/9) at every call site. Under a `clamp(56px, 9.6vw, 150px)` headline the site's one shared object sits at 264px — the thesis object is smaller than the lede measure. | `bike-plate.tsx`: add `size?: 'hero'` → `data-size={size}`. `hero.tsx`: `<BikePlate size="hero" settle="late" … />`. CSS (DESIGN.md hero metrics, scaled stripe 220/14): `.mv-plate[data-size='hero'] { padding: 20px 24px 18px; min-width: 360px; }` `.mv-plate[data-size='hero'] .mv-plate-figure { font-size: 64px; line-height: 64px; letter-spacing: -0.5px; }` `.mv-plate[data-size='hero'] .mv-plate-unit { font-size: 32px; line-height: 32px; }` `.mv-plate[data-size='hero'] .mv-plate-caption { margin-top: 8px; font-size: 17px; line-height: 22px; font-weight: 600; }` `.mv-plate[data-size='hero'] .mv-plate-edge { margin-top: 14px; padding-top: 10px; }` `.mv-plate[data-size='hero'] .mv-plate-stripe { top: 22px; right: -72px; width: 220px; height: 14px; }` `.mv-plate[data-size='hero'] .mv-plate-stripe::after { top: 20px; height: 7px; }` `@media (max-width: 480px) { .mv-plate[data-size='hero'] { min-width: 0; width: 100%; } .mv-plate[data-size='hero'] .mv-plate-figure { font-size: 56px; line-height: 56px; } }`. The auth panel (`auth-ui.tsx:98`, a 100dvh photo panel holding a 280px plate) and the explore band (`app-promo.tsx:36`) are the same case; take `size="hero"` only if the owner widens the target. | ~11 lines CSS, 0 bytes of imagery, no new motion (the settle and stripe-lay keyframes scale with the element; `translateX(120%)` is relative to the stripe's width). Risk: the hero stack grows ~60px; at 375px the 56px figure keeps the stack inside one scroll of the 100svh hero. Light scheme: the 2px keyline is unchanged. |
| B2 | `components/marketing/feature-content-page.tsx:259–297` (header), `components/marketing/feature-screenshot.tsx`; call sites `features/{expense-tracking,maintenance,ride-tracking,ai-diagnostics,learning-paths}/page.tsx` (no `heroVisual`) | **Five feature pages open on text.** First viewport = crumbs, H1, lede, store buttons; the app appears 64px + a scroll later in the pair. The claim ("Know exactly what your bike costs") is made before anything proves it. | When `heroVisual` is absent, the first screenshot takes the hero's right column, cut by the band's bottom edge (the home rides-band crop, `.fx-art-cut`), and the pair below keeps the second shot in the page's one phone frame. TSX: `const [heroShot, ...rest] = heroVisual ? [null, ...screenshots] : screenshots;` header grid class when `heroVisual \|\| heroShot`; header `style={{ paddingTop: 120, paddingBottom: 0, overflow: 'hidden' }}`; right column `{heroVisual ?? (heroShot && <div className="mv-hero-cut md:justify-self-end"><Image src={heroShot.src} alt={heroShot.alt} width={900} height={1955} sizes="(max-width: 900px) 300px, 380px" priority /></div>)}`; `<FeatureScreenshotPair screenshots={heroVisual ? screenshots : rest} />`. CSS (a `<style>` in the template, the pair's own pattern): `.mv-hero-cut { width: 380px; max-width: 100%; height: 440px; overflow: hidden; margin-top: 48px; border: 1px solid var(--mv-line); border-bottom: 0; border-radius: var(--mv-radius-screen) var(--mv-radius-screen) 0 0; background: var(--mv-surface); }` `.mv-hero-cut img { width: 100%; height: auto; display: block; }` `@media (max-width: 900px) { .mv-hero-cut { width: 300px; height: 340px; margin-top: 40px; } }`; in `feature-screenshot.tsx` add `.mv-shot-pair .mv-phone-mockup:only-child { justify-self: start; }`. Pages with a `heroVisual` (garage, trips) are unchanged. | One `priority` image per page (900×1955 PNG → ~40KB webp at 380w); the pair's frame stays lazy. Device-frame budget holds (the cut is a bled screenshot, the frame stays below). No motion (Read page: no load choreography). Check before applying: `ai-diagnostics` and `learning-paths` first shots must read at a top crop. |
| B3 | `components/explore/explore.css:127–150, 783–800`; `components/explore/hero-bold.tsx:46` (`sizes`) | **The explore photograph is a card.** A 4:5 rounded image at 45% width beside the copy, on the ground. The home and the closing CTA let the photograph carry the emotion full-bleed; explore — the page about places — frames it. | The photo runs off the right edge of the viewport and stands the hero's full height (the home trips block's bleed, `.fx-art-bleed`): `.xp-hero-photo { aspect-ratio: auto; min-height: 640px; align-self: stretch; margin-right: calc(-1 * ((100vw - min(100vw, var(--mv-container))) / 2 + 40px)); border-radius: var(--mv-radius-card) 0 0 var(--mv-radius-card); }` and in the ≤1024 block `.xp-hero-photo { margin-right: 0; min-height: 0; aspect-ratio: 16 / 9; border-radius: var(--mv-radius-card); order: -1; }`. The nearest full-width ancestor takes `overflow-x: clip` (the home uses it on `.fx-section`). `sizes="(max-width: 1024px) 100vw, 52vw"`. | 0 bytes until the asset is re-exported: `public/images/hero-explore.jpg` is 1376px wide; the bleed column is ~760 CSS px at 1440, so retina gets 1376/1520 — re-export at 2000px like `hero-dusk-ride.jpg` (+~150KB, `priority` LCP already). No motion change (the `xp-rise` ×3 stay). |
| B4 | `app/(root)/trips/[country]/[region]/[slug]/page.tsx:452` (hero), `components/trip-detail/trip-detail.css:25–52` (`.rh-map-bg`, `.rh-scrim` exist, unused here) | **The route page's first viewport has no route.** H1, five figures and two buttons on bare ground; the map is a Mapbox GL frame 500px down behind a public token. The country page (`trips/[country]/page.tsx:226–233, 298`) already draws a static route map behind its hero — the slug page, the one riders land on from search, does not. | Port `getMapboxStaticUrl` (copper `pin-s` per waypoint, `dark-v11`, `1200x675@2x`; when `trip.polyline` is set add the route through `lib/map/static-image-provider.ts`), render `<div className="rh-map-bg" style={{ backgroundImage: \`url(${mapUrl})\` }} /><div className="rh-scrim" aria-hidden />` inside `.rh`, and put the hero in the dark scene the way the home hero and closing CTA do: `<div style={{ '--rh-edge-bottom': 'var(--mv-bg)' }}><section className="rh mv-dark-scene">…</section></div>`; in `.rh-scrim` the last stop becomes `var(--rh-edge-bottom, var(--mv-bg))` so the band blends into paper under the light scheme. Drop `filter: saturate(.5) brightness(.7)` on `.rh-map-bg` only if the scrim alone keeps the H1 at 4.5:1 — check both schemes. | One static image per trip at ISR time (~150–250KB, CSS background → not an LCP candidate); Mapbox static quota is already spent the same way on the country page. No motion. Copper pins = the sanctioned "ridden route" copper (DESIGN.md). Honest: real waypoints, nothing drawn from fiction; trips without waypoints keep the bare hero. |
| B5 | `components/marketing/compare-page.tsx` `COMPARE_CSS`; `[locale]/(marketing)/compare/page.tsx:296, 318` | **The matrix is the thesis, and the MotoVault column is one `font-weight: 600` header.** Ten apps across, nine jobs down; the one full column of checks reads only after counting. | Lift the MotoVault column one ramp step for its full height — the ramp is the shadow, not a card: give app0's `<td>`s the same `is-mv` class as its `<th>` (`className={app.key === 'app0' ? 'is-center is-mv' : 'is-center'}` on both cells) and `.mv-cmp-table th.is-mv, .mv-cmp-table td.is-mv { background: var(--mv-surface); }`. Hairlines keep running through it; no radius, no border. The same two lines serve every `Vs*` page (their `is-mv` header already exists). | 2 lines CSS + 2 class strings. Dark: surface on ground (#1a1b1e/#111214) is quiet but legible as a column; light: white on paper is unmistakable. Skeleton test passes: with the words removed, one lifted column of marks still says "this one does all of it". |

Rejected amplifications: a copper rule under the manifesto (copper is a verb), a second stripe on the rides band (one stripe per viewport — the maintenance plate shares that viewport at 900px tall), the manifesto at display size (the hero is the only display-size moment), a figure beside the compare H1 (one stat row per page, and there is no honest number), a bigger price on `/pro` (the price is already 64px in the page's one card), anything on `/get` (one job, one viewport, already right).

## Overdrive — the stripe is laid down by the scroll

**Pick: (b), scoped to one plate.** The home page already tells the product's one mechanism with two plates on one ledger: the hero plate is *ready* at 24,318 km; the features-grid plate is the same bike 1,800 km later, *due soon* (`features-grid.tsx:95–104`). That second plate is the home's only scroll-reveal — and the reveal is the generic fade+rise (`.mv-reveal`), which also hides the plate figure until it enters. Replace it with the brand's own signature: the plate settles 0.98 → 1 and its livery stripe slides along its 45° axis into place, **driven by the plate's own view timeline instead of the clock**. The same two keyframes the hero plays at load (`mv-plate-settle`, `mv-plate-stripe-lay`) now play as the visitor scrolls the plate in; nothing is ever hidden; no JavaScript; transform only on a clipped child; one stripe, one diagonal.

Memory test: *"the yellow plate on the home page laid its copper stripe as I scrolled down to it."* The fill is deliberately **not** animated: scroll-driven animation is bidirectional, and a plate that turns back to bone when you scroll up says the bike un-wears. The stripe is livery, so laying it twice is harmless; the state is a record, so it stays printed.

Against the direction: entrance only (`animation-range: entry`), ≤ the reveal's own range, transform/opacity only, `prefers-reduced-motion` honoured, visible by default (`@supports` gate: Firefox and old Safari get the finished plate), no loop, no parallax, no scroll-scrubbed *scene* — the plate is the only thing that moves and it moves once per entry, like `.mv-reveal` does today. The `data-settle` clock version and this scroll version never meet on one object (the rule from it3-animate §4 holds: the hero plate keeps `settle="late"`, this plate gets no `settle` prop).

### Code — `components/marketing/features-grid.tsx`

Markup (line 95): the plate's wrapper drops `mv-reveal` and takes the new class.

```tsx
<div className="fx-art fx-art-plate fx-plate-lay">
  <BikePlate
    figure={t('grid.maintenance.plateFigure')}
    unit={t('grid.maintenance.plateUnit')}
    caption={t('grid.maintenance.plateCaption')}
    racingNumber="27"
    identity={t('grid.maintenance.plateIdentity')}
    state="due"
    style={{ width: '100%', maxWidth: '440px' }}
  />
</div>
```

CSS, appended to `FEATURES_CSS` (the component's own sheet; the keyframes are global, defined in `design-system.css:736–743`):

```css
/* The stripe is laid down by the scroll. The signature keyframes
   (mv-plate-settle, mv-plate-stripe-lay) run on the plate's own view
   timeline: settle over the first part of its entry, the stripe over the
   rest. Progressive: without scroll-timeline support the plate is simply
   complete. The fill never animates — the state is a record. */
@supports (animation-timeline: view()) {
  .fx-plate-lay .mv-plate {
    view-timeline: --fx-plate block;
    animation: mv-plate-settle var(--mv-ease-expo) both;
    animation-timeline: --fx-plate;
    animation-range: entry 5% entry 45%;
  }
  .fx-plate-lay .mv-plate-stripe {
    animation: mv-plate-stripe-lay var(--mv-ease-expo) both;
    animation-timeline: --fx-plate;
    animation-range: entry 15% entry 70%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fx-plate-lay .mv-plate,
  .fx-plate-lay .mv-plate-stripe { animation: none; }
  .fx-plate-lay .mv-plate-stripe { transform: rotate(45deg); }
}
```

Notes for the apply agent. (1) `view-timeline` on the plate is visible to its descendant stripe by name, so no `timeline-scope` is needed. (2) Duration is ignored on a scroll timeline; the easing shapes how much of the travel happens early in the range — `--mv-ease-expo` keeps the "settles" feel. (3) The stripe's `translateX(120%)` start sits past the plate's right edge inside `overflow: hidden`, so the first frame is a plate without its stripe, never a missing plate. (4) The plate's `transition: background-color` (garage state change) is untouched. (5) Browser check: Chrome/Edge/Safari 26 lay the stripe; Firefox shows the finished plate; verify at 1440 and 375 in both schemes that the range ends before the plate reaches the viewport's middle (if not, pull `entry 70%` to `entry 60%`). Cost: ~16 lines CSS, 0 JS, 0 bytes of imagery, compositor-only.

### Rejected, one reason each

| Candidate | Verdict |
|---|---|
| (a) The hero plate's figure counts up with scroll as an odometer | Rejected on honesty. The figure is the demo bike's odometer — a record. Scroll is not distance; "every mile, on record" would become every pixel on record, the number is unreadable while it moves and cannot be built from real digits without digit strips (the odometer-roll it3-delight already rejected), and the hero sits above the fold where no scroll exists yet, so it would count after the plate has left the viewport. |
| (c) The trip hero's route drawn by `stroke-dashoffset` from the real GPX | Rejected on fact and rule. The brief's own trip renders `polyline: null` with five waypoints — there is no GPX to draw, only a dashed guess between pins (fiction in a hero). `stroke-dashoffset` is neither transform nor opacity (it3-delight rejected the same technique on the 404). B4 gives the route page its route honestly, as a static map. |
| (d) Explore photo revealed through a clip-path at load | Rejected. A load-time wipe on the page's `priority` LCP image delays the perceived paint of the one thing that carries the emotion, and the hero already runs three `xp-rise` entrances. The memory test fails: "the photo wiped in" is a mood, not a mechanism. B3 makes the photograph bigger instead. |
| (e) View transitions: the plate / H1 travels from the features list to a feature page | Rejected on dependencies and content. `react@19.2.3` exports no `ViewTransition` (`node -e` check: only `Activity`); Next 16's guide requires React 19.3, and dependencies are Renovate-only. The hand-rolled alternative (`Link onNavigate` + `document.startViewTransition`) cannot await the router's commit. And there is nothing to share: `/features` has no plate, only `garage-management` and `trip-planning` have a hero object, and the H1 text differs on every page (a cross-fade of different words). Revisit after Renovate lands React 19.3, as a `<ViewTransition name="bike-plate">` on `BikePlate` only where both ends render one. |
| (f) The 404's route-to-nowhere drawn by scroll | Rejected. The 404 is a `100svh` grid with nothing to scroll on desktop, so a scroll timeline has no input; a stroke draw is not transform/opacity (already rejected in it3-delight); and a lost rider should not be given theatre. |

## Owner flags

- **d-bolder-1** B1 touches three owner-only files (`bike-plate.tsx`, `design-system.css`, `hero.tsx`); the hero-size metrics above are DESIGN.md's, not invented.
- **d-bolder-2** B3 needs `public/images/hero-explore.jpg` re-exported at 2000px wide (the asset is 1376px; a bleed at 1440 is soft on retina). B4 spends Mapbox static requests per trip at ISR, the same budget the country page already uses.
- **d-bolder-3** The overdrive effect replaces the home's one scroll-reveal on the plate; the manifesto keeps `.mv-reveal`, so the home still has "one sequence + two scroll moments" (it3-animate V18). I could not watch the stripe lay (the browser pane is not mine) — the apply agent verifies the range in Chrome and Safari before shipping.
