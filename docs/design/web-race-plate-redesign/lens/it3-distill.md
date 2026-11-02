# Lens it3 — /distill: strip every page to its essence

Scope: every file in `lens/SCOPE.md`. Method: source read of each page and its components, `curl` of the dev server for DOM order and element counts (`/` 2,167 words, 6 store anchors, 14 `<details>`, 14 figures; `/compare` 8 store anchors, 113 SVGs; `/features/maintenance` 6 store anchors; `/explore` 42 figures). Paths are relative to `apps/web/src`; i18n keys to `apps/web/messages/en.json`. Rows already applied from it2-layout ★ (manifesto viewport, proof order, figure pairs 4→2, FAQ edge, compare container) are not repeated. Positioning per PRODUCT.md: the rider's logbook — rides, expenses, maintenance, trips; AI diagnostics is out of scope for positioning (owner).

## Summary

The site says the same three things in many forms. "Free" appears eight times on the home page (hero trust line, hero strip, proof figure, FAQ, CTA subtitle, CTA trust line, sticky bar, footer). "No OBD hardware" appears five times. Every page carries two to four store-button pairs (hero, mid-page, closing, footer, sticky). The feature template prints its three feature rows a second time as the long-form band and a third time as FAQ answers. Compare pages state the verdict three times (quick verdict, wins lists, final verdict card) and the check date three times. The home page gives a quarter of its length to AI diagnostics (a band + 4 of 14 FAQs + a proof figure), which the owner has ruled out of positioning. The chrome has a Features dropdown listing the four features that are *not* the logbook.

What stays per page is written as a sentence under each heading; the table lists what fights it. ★ marks the ten highest-impact cuts. i18n keys removed by a cut are listed in the last section (prune happens at the end).

## Home — `app/[locale]/(marketing)/page.tsx` and its sections

**The one thing:** every mile, every service, every cost, on record for one bike — download the app. What fights it: the diagnostics band, three stat rows, a hook link above the H1, "free" eight times, 14 FAQs.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 1 | ★ cut | `components/marketing/hero.tsx` L78-94 | Remove the `.hero-hook` anchor ("Know what your bike really costs →"). It is a second, copper CTA above the H1, and its sentence is already the expenses block's H2 (`grid.expenses.title`). Delete `.hero-hook*` rules in design-system.css L1030-1042 (owner file: report). |
| 2 | cut | `hero.tsx` L130-141 | Remove `.hero-trust` ("Free · iOS + Android · Built for motorcycles"): the buttons name the platforms and the strip 60px below says "Free · No trial, no credit card". |
| 3 | cut | `hero.tsx` L23-28, L144-154 | Remove `.hero-strip` (Expenses / Maintenance / Trips / Free): a ticker of the section H2s one viewport below, and the page's second stat row. The scrim already fades the photo to the ground; drop `.hero-strip*` rules (design-system.css L1162-1206, owner file). |
| 4 | keep | `hero.tsx` L96-128 | H1, one-sentence description, the Bike Plate, the two store buttons. This is the page. |
| 5 | cut | `components/marketing/manifesto-section.tsx` L15, L26-33 | Remove `.mf-definition` (the 13px SEO site-definition). Crawlers already get it three times: `JsonLd.organizationDescription`, `Metadata.description`, and FAQ item 0 ("What is MotoVault?"), which is server-rendered and open by default. Do not move it to `sr-only` (hidden crawler text is the pattern Google treats as cloaking); fold "12,000+ models from the NHTSA catalogue" into FAQ 0 instead. Drop the `definition` prop. |
| 6 | simplify | `components/marketing/proof-section.tsx` L21-34 | Replace the four figures. "5 tools" counts diagnostics and learning; "0 OBD hardware" is an anti-feature that proves nothing to a rider who never had a scanner; "100% free" is a slogan dressed as a number. Keep: `12,000+` models in the catalogue (the one honest big number, currently buried in the definition), `14` expense categories, the App Store rating when present. Three figures, same shell. |
| 7 | ★ cut | `components/marketing/features-grid.tsx` L32, L52-56, L170-180, L211-236 | Remove the figure pairs and the trips proof sentence: with the proof row above, the pairs are the page's second and third stat rows, and "1 tap to start" is not a number worth 40px. Delete `FIGURE_BLOCKS`, the `figures`/`proof` branches of `FeatureCopy`, `.fx-figures*` and `.fx-proof` CSS. The 14-categories figure moves to the proof row (row 6). |
| 8 | cut | `features-grid.tsx` L72 | Remove `.fx-head` `mv-section-sub` ("Built for motorcycles, not retrofitted from car software. No OBD hardware…"): it restates the manifesto and repeats "no OBD". Keep "Four records. One logbook." |
| 9 | ★ cut | `components/marketing/diagnostics-demo.tsx` (whole file); `page.tsx` L4, L96 | Remove `<DiagnosticsDemo />` from the home page. Owner: AI diagnostics is out of positioning scope; PostHog: 5 users vs 13 for expenses. The band is the fifth product block, the second deeper band, and the only place a card (`.diag-result`) sits on a screenshot on a band. The feature keeps `/features/ai-diagnostics`, its footer link and FAQ 0's mention. If the owner wants one mention on the home page, it is one row in the features list, not a stage. |
| 10 | ★ cut | `components/marketing/faq.tsx` L3; `page.tsx` L53 | 14 FAQs → 6. Stay (reordered so JSON-LD's first four are the strongest): 0 "What is MotoVault?" (becomes the site definition, ≤50 words), 1 "Is MotoVault really free?", 8 "What maintenance reminders does MotoVault send?", 9 "Can I track expenses for multiple bikes?" (rewrite to the honest facts: 1 bike free, Pro unlimited, cost per km, 14 categories), 7 "How is MotoVault different from REVER or Calimoto?", 4 "Is my data safe?". Cut: 2 (AI diagnostics), 3 (models — folded into 0), 5 (trip planning: the feature page has six), 6 (offline, 120 words of unverifiable sync claims), 10 (OBD-II, 121 words), 11 (GPX — feature page), 12 (countries — /explore says it), 13 (AI accuracy, 132 words). `FAQ_INDICES` → `[0,1,2,3,4,5]`, `length: 4` → 6 in `buildFAQPage`. |
| 11 | cut | `faq.tsx` L20-26 | Answers cap at 60 words (today 44–132). The lede "Everything you'd ask in the first five minutes. If we missed yours, write to …" restates the H2; keep only "Missed yours? Write to support@motovault.app." (`Faq.introLead` shortens; `introTrailing` goes). |
| 12 | cut | `components/marketing/cta-section.tsx` L92-116 | Remove the trust line ("Free to start · No credit card · iOS and Android"): the subtitle one line above already says "Free on iOS and Android", the buttons name the platforms. |
| 13 | keep | `cta-section.tsx` L30-45 | The closing photo band, the H1-scale line, the subtitle, the two buttons: the page's one centred moment. |
| 14 | ★ cut | `app/[locale]/(marketing)/layout.tsx` L109 | Delete the console easter egg `<script>` (three `console.log` lines with hard-coded hex colours and the retired "better than a spreadsheet" slogan). Nothing else references it. |

## Chrome — navbar, footer, sticky bar

**The one thing:** get to a page, get the app. What fights it: a Features menu that lists the wrong four features, a footer that repeats the store buttons and the operator three times.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 15 | ★ simplify | `components/marketing/navbar.tsx` L13-23, L465-495, L539-555, CSS L160-279 | Replace the Features dropdown with a plain `Features` link to `/features`. The menu lists trip planning, diagnostics, garage, learning (icon + title + subtitle each) — the four features that are not the logbook, so the first thing a visitor opens contradicts the hero. The index page already groups all seven. Delete `FEATURE_ITEMS`, the dropdown state/keyboard code (L291-298, L369-418), `.mv-nav-dropdown`/`.mv-nav-menu`/`.mv-nav-item*` CSS, the lucide imports, and the sheet's feature group (one `Features` row instead). |
| 16 | cut | `navbar.tsx` L25-29 | Drop `faq` → `/#faq` from `NAV_LINKS`: a nav link to a section of another page, on every page. The footer keeps it. |
| 17 | ★ cut | `components/marketing/footer.tsx` L72-107 | Remove the two store buttons from the footer. Every page already closes with a store-button pair (home CTA, `FeatureCta`, `.end-cta`, `.sp-cta`, `.xp-band`) 200–300px above the footer, and the sticky bar covers scroll-depth on Android/desktop. Which pair stays per viewport: hero + closing; sticky bar is the fallback. Delete `.mv-footer-stores`/`.mv-footer-store` CSS (design-system.css L796-818, owner file). |
| 18 | cut | `footer.tsx` L47-52 | Drop "Riders" → `/#proof` (a link to a stat row). Add "Garage" and "Learning paths" to the Product column so the footer lists all seven feature pages (row 29 relies on it), and "Tools" (cost calculator, TCLOCS) to Resources (row 49 relies on it). |
| 19 | cut | `footer.tsx` L126-133; `Footer.bottomBar` | Bottom bar reads "© 2026 Kan Consult s.r.o. · MotoVault is a product of Kan Consult s.r.o. · Built by a rider." above an operator line that names Kan Consult s.r.o. a third time, next to a `motovault.app` span on motovault.app. Keep "© 2026 Kan Consult s.r.o." and the operator line (#321); delete the middle clause, "Built by a rider" (the brand text says it), and the `motovault.app` span (L129). |
| 20 | cut | `footer.tsx` L120-123 | Remove the 240px outlined wordmark. DIRECTION tolerates it as decoration, but it is the third "MotoVault" in 300px (brand link, bottom bar, wordmark) after a full-bleed photo CTA has already closed the page. Owner call; the distill case is that it adds a second closing flourish. Delete `.mv-footer-wordmark` CSS (L845-858, L900-903, owner file). |
| 21 | keep | `components/marketing/sticky-app-bar.tsx` | One sentence, one copper button, one dismiss. This is the correct amount. |

## Feature pages — `components/marketing/feature-content-page.tsx` and the seven `features/*/page.tsx`

**The one thing (each):** what this record is, shown once in the app, then download. What fights it: the same three facts told as rows, then as prose, then as FAQ answers; three link rows after the FAQ; a 52-word lede.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 22 | cut | `feature-content-page.tsx` L282 | Ledes are 36–52 words on the three logbook pages (`FeaturesMaintenance.heroSubtitle` 52w restates the title and the three rows). Cap `heroSubtitle` at 25 words, one sentence, on all seven namespaces. |
| 23 | ★ cut | `feature-content-page.tsx` L426-439; `features/*/page.tsx` `longForm` props | The long-form band repeats the feature rows as prose: on `/features/maintenance` s1 = f2 (service history), s2 = f1 (reminders), s3 = FAQ 2 (share history). On the four others it is 330–430 words of generic SEO prose ("Riders use MotoVault diagnostics in countless real-world scenarios"; trip-planning's 250-word fictional walkthrough "A rider wakes up on Saturday"). Keep the band as H2 + intro paragraph only (the keyword carrier, ≤60 words) on all seven; delete the H3 `sections` loop (L431-436) and the `sections` field. The one exception that earns its place: trip-planning `positioningBody` ("Why we built this first", 81w) becomes that page's intro. |
| 24 | cut | `feature-content-page.tsx` L488-500 | Remove the "Have more questions? Visit our support page" paragraph under every FAQ (7 namespaces × 2 keys). The footer has Contact on every page. Keep the `/compare` inbound link (L503-508): it is the hub-and-spoke rule and the only route to the money page not in the footer. |
| 25 | cut | `feature-content-page.tsx` L511-525; `related` prop on 7 pages | Remove "Other features" (two 26px display rows with arrows). With row 18 the footer Product column links all seven feature pages 300px below. Delete `FeatureRoute`/`FEATURE_ROUTE_TITLE_KEY` if nothing else uses them. |
| 26 | cut | `components/marketing/feature-cta.tsx` L57-67 | Remove `socialProof` ("Built specifically for motorcycles"): a 13px line under the buttons that proves nothing. Used by `/features/*`, `/features`, `/compare/*`. |
| 27 | simplify | `components/marketing/feature-screenshot.tsx` L10-18 | `.mv-shot-panel` draws a 1px keyline + card radius around a screenshot that already carries the app's own chrome, beside a phone frame with its own bezel: two keylines side by side. Drop `border`; keep the radius clip and surface. |
| 28 | simplify | `features/ai-diagnostics/page.tsx` L63-70, L101-144, L146-159 | `DiagnosisResult` is a bordered card holding three progress bars and a `<dl>` of hairline rows: hairlines inside a keyline. Drop the card border (surface step only) so the rows are the only lines; the bars stay (they depict the app). |
| 29 | cut | `features/trip-planning/page.tsx` L32, L177-186 | Remove the "Who can see a trip" table: Private / Unlisted / Public is already the full text of f4 "Privacy controls" and of step 3. Keep f4. |
| 30 | ★ cut | `features/garage-management/page.tsx` L31-94, L130-135 | Remove the `MaintenanceTimeline` demo (a hand-written table of five fictional jobs: "Mobil 1 15W-50 · 3.2 qt", "Pirelli Rosso III"). The second screenshot on the same page (`service-history.png`) is the real thing. Also drop `maintSubtitle`. |
| 31 | cut | `features/learning-paths/page.tsx` L180 | Drop the fifth feature row "Test what you learned": `coursesTitle` and `curriculumBody` both already say "a quiz at the end of every module". |
| 32 | keep | `features/learning-paths/page.tsx` L62-151; `features/trip-planning/page.tsx` L50-146 | `ModuleProgress` and `RouteDepiction`: the only depiction of each page's actual object. Keep both; they are each page's one card. |

## Features index — `app/[locale]/(marketing)/features/page.tsx`

**The one thing:** seven pages, grouped logbook / around the ride. What fights it: a lede that pre-tells both group sentences.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 33 | cut | `features/page.tsx` L175 | Remove `heroSubtitle` ("From the next three-day loop to a mystery rattle: MotoVault keeps the records of ownership… and helps you plan, diagnose and learn."): both group bodies (L188, L215) say it again 200px lower. H1 + crumbs, then the lists. |
| 34 | keep | `features/page.tsx` L104-126 | Title-as-link rows with one arrow: the arrow is the row's only verb. Keep. |

## Compare family — `components/marketing/compare-page.tsx`, `compare/page.tsx`, `compare/alternatives`, `compare/maintenance-vs-ride-apps`

**The one thing (vs pages):** the spec sheet, then which app for which rider. What fights it: the verdict three times, the date three times, the same 10 facts as table + wins lists + prose. **(index):** the matrix, then one link per comparison. What fights it: two lists of the same nine apps, three store-button pairs.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 35 | ★ cut | `compare-page.tsx` L566-574 | Remove the "Final verdict" card: it repeats `quickVerdict` (L413-418) in 45 words instead of 30 and is the only card on the page. `whenToChoose` (L541-547) becomes the closing prose; delete `.mv-cmp-card`. |
| 36 | cut | `compare-page.tsx` L379-384, L484-502 | Remove the two "Where X wins" lists (4 + 4 sentences): every item is a row of the spec sheet above with its Notes column. Delete `.mv-cmp-stack`. |
| 37 | cut | `compare-page.tsx` L395-397, L505-508 | The check date is printed three times per page (header `updatedAt`, `testingPreamble`, `pricingTableTitle` "(April 2026)"). Keep the preamble under the spec sheet only; drop the header meta line and the date interpolation in the pricing title. |
| 38 | cut | `compare/page.tsx` L403-406 | Remove the mid-article `StoreButtons` + "Get MotoVault free." (three store pairs on one page: hero L283, here, `FeatureCta`). Hero and closing stay. |
| 39 | cut | `compare/page.tsx` L360-389 | Two lists of the same nine apps: "The comparisons" (title + one-line verdict + link) and "The apps" (name, tagline, description, best-for, price, platforms, "Read comparison"). Remove "The apps"; the matrix already carries price per app and the comparisons list already says what each app is for. Keep `app*.name`/`price` (matrix) and `app0.description` (JSON-LD). |
| 40 | cut | `compare/page.tsx` L292, L354 | `matrixSubtitle` promises "A dash means the feature is partial or limited" but the matrix renders only yes/no (L318); delete the sentence. `comparisonsSubtitle` claims "Each page was written after running both apps on the same rides" — contradicts the ★5 preamble; delete the key. |
| 41 | keep | `compare-page.tsx` L438-482, L504-539; `compare/page.tsx` L288-349 | The spec sheet, the pricing table, the matrix: the pages' reason to exist. Icons in cells have text alternatives; keep. |
| 42 | simplify | `compare/alternatives/page.tsx`, `compare/maintenance-vs-ride-apps/page.tsx` | Apply rows 35–38: one verdict, one date, one store pair besides the closing CTA. (Not read line-by-line; same template grammar.) |

## Content shells — blog, guides, bikes, tools, support, legal (`trackside-read.css`)

**The one thing:** the article. What fights it: two identical CTA tiles per post, two link lists after the article, a third prose block after a tool's FAQ.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 43 | ★ cut | `app/[locale]/(marketing)/blog/[slug]/page.tsx` L404-412 | Remove the end-article `ContextualAppCta`: the same surface tile (34px display headline + copper button) already sits mid-article (L333-340). Keep the mid-article one (intent-matched, after the second H2). The `EndArticle` placement disappears from `store_cta_click` — note in analytics. |
| 44 | cut | `blog/[slug]/page.tsx` L402; `components/marketing/related-resources.tsx` | Remove "Keep going" (feature page + tool + /compare): with row 18 the footer links features and tools, the navbar links Compare. "Related articles" (L415-440) stays — it is the only unique list. |
| 45 | simplify | `blog/[slug]/page.tsx` L347-364 | Drop the info `<svg>` beside the disclaimer sentence; the sentence says "informative only" itself. |
| 46 | keep | `blog/[slug]/page.tsx` L301, L400 | Byline (one line) and AuthorBio (end matter): E-E-A-T, different jobs. |
| 47 | cut | `tools/tclocs-checklist/page.tsx` L287-290 | Remove the trailing `seoTitle`/`seoP1-3` block: a third prose block after the TCLOCS guide (six H3s) and its FAQ, hidden in print. |
| 48 | cut | `tools/cost-calculator/page.tsx` L164-173 | Remove `seoTitle1`/`seoP1-3` and `seoTitle2`/`seoP4`: the article above (L125-162, one H2 + three H3) already covers "what it costs / what the calculator covers / why track". ~700 words under a calculator → ~350. |
| 49 | cut | `app/[locale]/(marketing)/support/page.tsx` L118-135 | "Report a bug" and "Feature requests" are two sections whose body is "email support@motovault.app". Fold into one sentence under Contact ("Bugs and ideas go to the same address; a device model and app version help."). |
| 50 | keep | `privacy/page.tsx`, `terms/page.tsx` | Owner decision pending on legal text (★20): no cuts. |

## Explore — `app/explore/*`, `components/explore/*`

**The one thing:** find a route; the count of routes is the proof. What fights it: a subtitle under every H2 that re-says the H2, continent totals, an arrow on every row.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 51 | keep | `components/explore/hero-bold.tsx` | H1, lede, the two real counts, search, photo. Correct. |
| 52 | cut | `components/explore/popular-strip.tsx` L26-30, L45 | Remove the sub ("Routes in {country}, where you seem to be riding from." explains geo-IP; the H2 "Start in {country}" says it). Drop the arrow `Icon` in each chip: the chip is the link. |
| 53 | cut | `components/explore/editors-ledger.tsx` L35-39 | Remove the sub ("{n} routes picked by hand." under "Editor's picks"). |
| 54 | cut | `components/explore/country-ledger.tsx` L26-29, L38-41, L55 | Remove the sub (explains the sort order), the per-continent `MetaLabel` totals ("{n} countries · {n} routes" — a stat row per continent that the rows themselves add up to), and the arrow icon on every country row. Keep the per-row route count. |
| 55 | cut | `components/explore/trip-list-card.tsx` L24-34 | Trim the meta line to place · surface · difficulty. Drop "Editor's pick" (the Editor's section already marks them) and "Rated 4.5 by 12 riders" (ratings are near zero; where real they are on the detail page). |
| 56 | simplify | `components/explore/app-promo.tsx` L15-18 | Sub "Open any route in the MotoVault app, ride it, and keep the record: the ride itself, the fuel it took, and the service it brings closer." → "Open any route in the app, ride it, and keep the record." |

## Trips — `app/trips/[country]/[region]/[slug]/page.tsx`, `components/trip-detail/*`

**The one thing:** this route — figures, map, stops — and one way to take it with you. What fights it: four "Get the app" buttons, three GPX buttons, a Share button that links to itself, facts printed twice.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 57 | ★ cut | `trips/[country]/[region]/[slug]/page.tsx` L537-540 | Remove the "Share" ghost button: its `href` is the page's own URL — a control that does nothing. (Same in `trips/[country]/page.tsx` if present.) |
| 58 | ★ cut | `…/[slug]/page.tsx` L556-573 (CTA only), L646-654, L780-786 | Four "Get the app" + three GPX buttons per page. Keep: hero pair (Get the app + GPX, L528-547), `.end-cta` (L796-816), `.trip-sticky` (<1024). Cut: the `tabnav-cta` (the sticky bar covers phones; on desktop the hero is one scroll up), the `.map-foot` GPX, and the `variant="bottom"` GPX section (its quota line and paywall dialog still fire from the hero button). |
| 59 | cut | `…/[slug]/page.tsx` L619-622 | Remove the "Curated by" row from `.rfacts`: `.rh-author` (L549-551) says "Curated by X · Updated …" in the same viewport. |
| 60 | cut | `…/[slug]/page.tsx` L665-670, L716-718, L726-728 | Remove the itinerary aside ("A suggested split across {n} days, with {m} waypoints" — each day already prints its stop count), the reviews aside and the `.reviews-count` line: "{n} reviews from riders who rode it" is printed twice under an H2 that says "From riders who rode it". |
| 61 | simplify | `components/trip-detail/trip-detail.css` L272-284 | `.map-card` (border + radius + surface) wraps `.map-frame` (radius + overflow): one container. Keep the frame's clip, drop the card's border and background — the map has its own edge. |
| 62 | keep | `…/[slug]/page.tsx` L480-525, L576-625 | The five hero figures, the facts list, the itinerary: the route. |

## Pro + checkout — `app/pro/page.tsx`, `pricing-card.tsx`, `pro/checkout/*`

**The one thing:** what Pro lifts, what it costs, one button. What fights it: the six features listed three times, billing terms said five times, an icon on every row.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 63 | ★ cut | `pro/page.tsx` L125-145 | Remove "What Pro adds": the six features are already the pricing card's list (beside the H1) and the Free-vs-Pro table. The sub ("Pro is one bundle, not a tier ladder… Everything you log stays free.") is the H1 and lead for the third time. |
| 64 | cut | `pro/page.tsx` L108-117 | Remove the hero check-list: "Billed today · cancel anytime" is also the card footnote, `finalLine`, and two FAQ answers; "Works on iPhone, Android and the web" belongs in the FAQ. |
| 65 | cut | `pro/page.tsx` L52-55, L221 | Drop FAQ "Is there a lock-in?" (its answer is the second half of "How do I cancel?") and `finalLine` under "Ready when you are" (the card said it). |
| 66 | simplify | `pro/pricing-card.tsx` L26-34, L65-75, L82-85 | Drop `BENEFIT_ICONS` (six lucide icons beside six titles that say what they are) and the `Lock` icon on the footnote; text rows. Keep `Check`/`Minus` in the table (they are the data). |
| 67 | cut | `pro/checkout/page.tsx` L389-399 (else branch) | With no trial, the summary note "Billed {price} today and on each renewal. Cancel any time." repeats the "Due today" row directly above it. Render the note only when `trialDays`. |
| 68 | cut | `pro/checkout/success/page.tsx` L242-252 | Remove `.mvp-success-plate` (an `aria-hidden` Bike Plate as decoration). The unlocked list and the one button are the page. |

## Auth — `components/auth-ui/*`, `app/login`, `app/signup`

**The one thing:** the form. What fights it: a second tagline on the photo panel that says what the subtitle says.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 69 | cut | `auth-ui.tsx` L97-100; `login/page.tsx` L34, L168; `signup/page.tsx` L37 | Remove `panelNote`. Login: panel "Service history, real costs and every ride, kept in one logbook." vs subtitle "Your garage, rides and service history, synced to every device."; signup: "Logging service and spend is free. Pro lifts the limits." vs "Free forever for logging. Pro removes the limits." Keep the plate on the panel, keep the subtitle. |
| 70 | keep | `auth-ui.tsx` L380-400 | Submit, legal line, alt link: required. |

## Welcome / get — `app/welcome/page.tsx`, `app/get/page.tsx`

**The one thing:** get the app on your phone. What fights it: the email printed three times, tags that repeat their titles, a subtitle that lists the rows.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 71 | cut | `welcome/page.tsx` L106-110, L117, L127 | Remove the header "Signed in as {email}" (the account line in the card and the phone block say "Sign in with the same account: {email}"), the subtitle (it lists the three reason rows that follow), and the reason tags ("GPS" under "Record rides with GPS", "Camera" under "Scan receipts with the camera"). |
| 72 | cut | `get/page.tsx` L204-211 | Show the "Buy Pro on the web" line only when `discountCode` is present; without a code the bio-link page has one job and this is a second CTA. Keep "Free on iPhone and Android." |

## Garage / profile — `app/(community)/garage/*`, `components/garage-ui/*`

**The one thing:** the bike's plate, what is due, what was spent, rides — read-only; open the app to change it. What fights it: the "open the app" sentence three times, a skeleton drawn as art.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 73 | cut | `garage/garage-view.tsx` L99-100 | Remove `.gv-intro` ("Everything here comes from your MotoVault app. To add or change anything, open the app."): the meta line says "Read-only on the web" and the rail/band/bar says "Open in the app". Keep `emptyIntro` on the empty state. |
| 74 | cut | `garage/empty-garage.tsx` L85-108 | Remove `BikePreview` (a dashed ghost plate with placeholder bars and a pill): decoration that imitates a loading skeleton. `EmptyStartHero` is the page. |
| 75 | cut | `components/garage-ui/app-handoff.tsx` L36 | Drop `railEyebrow` ("iPhone and Android") under "Open in the app"; the QR tile and store links below say it. |
| 76 | keep | `app-handoff.tsx` (rail / band / bar) | One handoff surface per breakpoint, never two at once. Correct. |

## Ride / share / rider / u — `app/ride`, `app/share`, `app/rider`, `app/u`, `components/shared-trip-view.tsx`

**The one thing:** the shared object (a ride, a service history, a rider, a trip) and one way into the app. What fights it: a third figure that is the sum of the other two, a followers count, three closing buttons.

| # | keep / cut / simplify | file:line | exact change |
|---|---|---|---|
| 77 | cut | `share/[token]/page.tsx` L168-171 | Remove the "Records" figure: it is "Done" + "Still to do", which sit beside it. |
| 78 | cut | `rider/[username]/page.tsx` L117-120 | Remove the "Followers" figure: near zero for every rider and not a logbook fact. Rides and distance stay. |
| 79 | simplify | `components/shared-trip-view.tsx` L113-134 | Three closing buttons (deep link + iOS + Android). Keep the deep link as primary ("Open in the app") and one ghost "Get the app" → `/get` (it already redirects by platform). |
| 80 | keep | `ride/[id]/page.tsx`, `u/[handle]/layout.tsx` | Figures, list, one closing pair. (The nested `/u` shell is it2-layout's row, not repeated.) |

## ★ The ten highest-impact cuts

1. Home: remove the diagnostics band (row 9) and cut 14 FAQs to 6, dropping the four AI/OBD items (row 10).
2. Home: remove the figure pairs and trips proof from the features sequence — one stat row per page (row 7); the proof row carries the honest numbers (row 6).
3. Home: remove the hero hook link (row 1) and the console easter egg (row 14).
4. Chrome: replace the Features dropdown with one link (row 15); remove the footer store buttons (row 17).
5. Feature pages: the long-form band keeps H2 + intro only — the H3 sections repeat the rows (row 23).
6. Feature pages: remove the garage page's fictional maintenance table (row 30).
7. Compare: remove the Final verdict card and the wins lists; one verdict, one date (rows 35–37).
8. Blog: one `ContextualAppCta` per article, not two (row 43).
9. Trips: remove the self-linking Share button; one GPX button and three "Get the app" surfaces instead of seven controls (rows 57–58).
10. Pro: remove "What Pro adds" — the six features are listed three times (row 63).

## i18n keys removed by these cuts (list only; prune happens at the end)

- Hero: `badgeExpensesHook`, `trustLineStrip`, `tickerExpensesLabel/Sub`, `tickerMaintenanceLabel/Sub`, `tickerTripsLabel/Sub`, `tickerFreeLabel/Sub` (rows 1–3). Already dead, same prune: `tickerDiagnostics*`, `tickerPlatform*`, `cornerFreePlatforms`, `badgeNew`, `badgeDiagnosticsLive`, `line1-3`, `subtitle*`, `trustLine`, `downloadCta`, `exploreFeatures`, `scrollDown`, `seoTitle`.
- Home: `siteDefinition` (row 5). Manifesto: `eyebrow` (dead).
- Proof: `toolsLabel`, `obdSuffix`, `cameraLabel`, `freeLabel` (row 6; new key `modelsLabel`, `categoriesLabel`); dead: `ratingLabel`, `nativeLabel`.
- Features.grid: `sectionSub`; `{expenses,rides,maintenance,trip}.fig1Value/fig1Label/fig2Value/fig2Label` (16); `trip.proof` (rows 7–8). Dead in same block: `*.kv1/kv2*`, `*.chip1/chip2*`, `diag.*`, `sectionMeta`.
- DiagnosticsDemo: all 12 keys (row 9).
- Faq: `items[2,3,5,6,10,11,12,13]` (row 10), `introTrailing` (row 11); dead: `sectionLabel`, `sectionTitle`, `sectionMeta`.
- Cta: `trustFree`, `trustNoCreditCard`, `trustPlatforms` (row 12), `socialProof` (row 26); dead: `trustNoCard`, `trustFreeForever`, `trustUnlimitedBikes`, `personality`, `metaLabel`, `disclaimer`, `headline`? (used by FeatureCta — keep), `subtitle` (FeatureCta — keep).
- Navbar: `tripPlanning`, `diagnostics`, `garage`, `learning`, `tripPlanningSub`, `diagnosticsSub`, `garageSub`, `learningSub` (row 15), `faq` (row 16); dead: `maintenance`, `expenses`, `rides`, `progress`, `viewAllFeatures`, `download`, `signup`, `blog`, `riders`, `compare`? (used — keep).
- Footer: `appStore`, `googlePlay` (row 17), `riders` (row 18); `bottomBar` value shortens (row 19). Dead: `tagline`, `copyright`, `features`, `learning`, `garage`, `download`, `support`, `accountDeletion`, `builtWithAi`, `about`, `company`.
- Features* (7 namespaces): `faqMore`, `faqSupportLink` (row 24); `s1-3Title/Body` on Maintenance/Expenses/Rides; TripPlanning `galleryTitle/Body`, `walkthroughTitle`, `walkthroughP1-4`, `seoHeading`→keep as title; Diagnostics `longFormHow*`, `longFormExamples*`, `longFormComparison*`; Garage `longFormMultiBike*`, `longFormScheduling*`, `longFormResale*`; Learning `longFormCurriculum*`, `longFormProgression*`, `longFormLesson*` (row 23). FeaturesIndex: `relatedTitle` (row 25), `heroSubtitle` (row 33). FeaturesTripPlanning: `visibilityTitle/Body/ColLevel/ColWho/ColWhere`, `visPrivate/Unlisted/Public` + `*Who` + `*Where` (row 29). FeaturesGarage: `maintTitle`, `maintSubtitle`, `maintColTask/When/Odometer/Status`, `maint1-5Label/Sub/Date/Miles/Status` (row 30). FeaturesLearning: `quizTitle`, `quizDesc` (row 31). (The large dead `pillar*`, `stat*`, `cat*`, `pathCard*`, `level*`, `nextFeature*`, `cta*`, `hero*2`, `bike*`, `expense*`, `donut*` sets in these namespaces are the clarify group (c) prune.)
- Compare: `finalVerdictTitle`, `verdictCtaTitle`, `appsTitle`, `appsSubtitle`, `readComparison`, `app1-9.tagline/description/best/platforms`, `comparisonsSubtitle` (rows 35–40); `matrixSubtitle` value shortens. Vs* (9 namespaces): `verdict`, `verdictTitle` where present, `mvWins`, `<comp>Wins`, `mvWin0-3`, `<comp>Win0-3`, `updatedAt`; `pricingTableTitle` loses `{date}` (rows 35–37).
- Blog: `relatedResourcesTitle`, `relatedFeatureMaintenance`, `relatedFeatureExpenses`, `relatedToolChecklist`, `relatedToolCost`, `relatedCompare` (row 44). TclocsChecklist: `seoTitle`, `seoP1-3` (row 47). CostCalculator: `seoTitle1`, `seoP1-3`, `seoTitle2`, `seoP4` (row 48). Support: `bugReportTitle/Description`, `featureRequestTitle/Description` → one new key `bugsAndIdeas` (row 49).
- Welcome: `signedInAs`, `subtitle`, `ridesTag`, `remindersTag`, `receiptsTag` (row 71); dead: `eyebrow`. AppHandoff: `railEyebrow` (row 75); dead: `openIn`, `theApp`, `doInApp`, `scanToOpen`. GarageV2: `intro` (row 73), `previewRegion`, `previewLabel` (row 74); dead: `eyebrowGarage`, `titleLead`, `titleSerif`.
- English-in-place (no keys): rows 52–62, 63–68, 69, 72, 77–79.
