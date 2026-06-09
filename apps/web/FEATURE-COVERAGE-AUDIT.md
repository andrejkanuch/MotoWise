# Feature Coverage Audit — motovault.app

_Generated: 2026-06-01 · Scope: feature pages + `llms.txt` + `llms-full.txt` + JSON-LD schema_

Audit of whether every core feature MotoVault ships is represented **accurately and consistently** across the four discovery surfaces: the `/features/*` marketing pages, the AI-crawler files (`llms.txt`, `llms-full.txt`), and the structured-data graph.

**Verdict:** content is well covered on every surface, but the **page-level information architecture does not match the feature taxonomy** that the llms files — and the product's own usage data — assert. The three most-used features have no dedicated page.

---

## Coverage matrix

| Feature | `/features/*` page | `llms.txt` | `llms-full.txt` | Page schema |
|---|---|---|---|---|
| AI diagnostics | ✅ `ai-diagnostics` | ✅ | ✅ own section | WebPage · Breadcrumb · **FAQPage** |
| Trip **creation** | ✅ `trip-planning` | ✅ | ✅ own section | WebPage · Breadcrumb · **FAQPage** |
| Garage / multi-bike | ✅ `garage-management` | ✅ | ⚠️ folded into "Maintenance" | WebPage · Breadcrumb · **FAQPage** |
| Learning paths | ✅ `learning-paths` | ✅ | ✅ own section | WebPage · Breadcrumb · **FAQPage** |
| **Maintenance tracking** | ❌ buried in `garage-management` | ⚠️ key-facts only | ✅ own section | — no page of its own |
| **Expense tracking** | ❌ buried in `progress-tracking` | ⚠️ one bullet | ✅ own section | — no page of its own |
| **Ride tracking** | ❌ buried in `progress-tracking` | ⚠️ "GPS ride recording" bullet | ✅ own "Ride Logging" section | — no page of its own |
| Trip **discovery** (`/explore`) | ❌ outside `/features` | ✅ Route discovery | ✅ own section | WebPage · Breadcrumb only (**no FAQ/ItemList**) |
| Guides | ✅ `/guides` (+Article) | ❌ **absent** | ❌ **absent** | WebPage · Breadcrumb · Article |
| Bikes (1500+ programmatic) | ✅ `/bikes` | ❌ absent | ❌ absent | not audited |

**Consistency win:** all five `/features/*` pages emit a uniform `WebPage + BreadcrumbList + FAQPage` graph. That baseline is solid — leave it.

---

## Findings (ranked by impact)

### 1. Taxonomy mismatch: highest-value features have no page — **highest impact**

The three features that lead the product story — **maintenance, expenses, ride tracking** — are exactly the three with **no dedicated indexable page**. They are bundled under two umbrella URLs nobody searches for:

- `/features/progress-tracking` actually contains **expense tracking + ride logging + dashboard**. Its H1/URL says "Progress Tracking" — a searcher looking for *"motorcycle expense tracker"* or *"motorcycle ride logger"* will never match it.
- `/features/garage-management` carries the **maintenance / service-reminder** content.

Meanwhile `llms-full.txt` correctly splits these into three first-class sections (Maintenance, Expense, Ride Logging). **The AI-crawler surface and the Google/human surface disagree on what the features are.** An AI engine reading llms-full.txt learns "MotoVault has expense tracking," tries to cite a source page, and finds `/features/progress-tracking` — a name/topic mismatch that weakens the citation.

Sharpened by usage data: PostHog-validated feature priority is **expenses > maintenance > rides > trips > AI**. The most-used, best-validated features sit behind the vaguest URLs, while AI diagnostics (lowest usage) gets the cleanest dedicated page. The IA is inverted relative to value.

### 2. Trip discovery can vanish from the sitemap — fragile

`/explore`, `/explore/[country]`, `/explore/[country]/[region]` are emitted in `src/app/sitemap.ts` **only if `publishedTrips.length > 0`** (`sitemap.ts:194`), and the fetch swallows errors to `[]` (`sitemap.ts:101`). If the query returns empty or fails, the entire trip-discovery surface drops out of the sitemap silently. It is also absent from the static `pages` array, so it has no guaranteed floor.

### 3. `/guides` is invisible to AI crawlers

A `/guides` section ships with full `Article` schema, but appears in **neither** `llms.txt` (the "Content" block lists Blog/About/Press only) **nor** `llms-full.txt`. AI engines are told the blog exists but not the guides.

### 4. `/explore` schema is thinner than feature pages

Every `/features/*` page carries a `FAQPage`; the explore index and country/region pages carry only `WebPage + BreadcrumbList`. Route-listing pages are natural fits for `ItemList` / `CollectionPage`. (`TouristAttraction` already lives on leaf route pages per the GEO analysis.) The discovery hub under-signals its structure.

### 5. Partial comparison coverage in `llms.txt`

`llms.txt` lists 4 comparisons (Rever, Calimoto, RideLog, Alternatives) but the site ships **11** compare pages. The other 7 (Kurviger, EatSleepRIDE, Scenic, MotoScan, MotorManage, Moto Shed, maintenance-vs-ride-apps) are not surfaced. May be deliberate curation — flagged so it is a choice, not an oversight.

### 6. Date staleness re-introduced

Only `/features/ai-diagnostics` was bumped to `2026-06-01` in `sitemap.ts`; the other four feature pages still read `2026-04-11`. If feature copy/taxonomy is being revised, those `lastmod` dates are now inaccurate — re-creating the freshness problem GEO rec #4 flagged.

---

## Remediation plan

### Phase A — Information architecture (addresses Finding 1, highest impact)

Split the umbrella pages into intent-matched feature pages so the three highest-value features get URLs, H1s, and schema that match how people and AI engines search.

| New page | Lifted from | Target query intent |
|---|---|---|
| `/features/expense-tracking` | `progress-tracking` (expense + analytics) | "motorcycle expense tracker", "cost per mile" |
| `/features/ride-tracking` | `progress-tracking` (GPS ride logging) | "motorcycle ride logger", "GPS ride tracking" |
| `/features/maintenance` | `garage-management` (service history + reminders) | "motorcycle maintenance app", "service reminder" |

Decisions to confirm before building:
- **Keep or retire `progress-tracking`?** Recommended: convert it into a hub that links the three split pages, OR 301-redirect it to `/features/expense-tracking` (the top-priority intent) to preserve any equity. Avoid leaving a vague orphan.
- **`garage-management`** stays (multi-bike garage is a real distinct feature) but hands the maintenance content to the new `/features/maintenance` page.
- Each new page must replicate the proven graph: `WebPage + BreadcrumbList + FAQPage`.
- i18n copy largely exists already — `messages/en.json` has `expenses`, `maintenance`, `rides`, `garage` namespaces — so the split is mostly re-homing existing strings, not net-new translation. Verify the other 4 locales before shipping (i18n ratchet).

### Phase B — Sitemap & freshness (Findings 2, 6)

- Add `/explore` to the static `pages` array so trip discovery always has a sitemap floor, independent of the published-trips query.
- Consider logging when `getPublishedTripsForSitemap()` returns empty/throws, so a silent drop is observable.
- Wire `PAGE_LAST_EDITED` to real last-edit dates (or build time per page) instead of hand-maintained constants; at minimum, bump the 4 stale feature pages when their copy changes in Phase A.

### Phase C — AI-crawler parity (Findings 3, 5)

- Add the three new feature pages to `llms.txt` Core features and give each its own section in `llms-full.txt` (the sections largely already exist — just align the headings/links to the new URLs).
- Add `/guides` to the `llms.txt` Content block and a Guides section to `llms-full.txt`.
- Decide explicitly whether to list all 11 comparison pages or keep the curated 4 (document the rationale either way).

### Phase D — Schema enrichment (Finding 4)

- Add `ItemList` (or `CollectionPage`) to `/explore`, `/explore/[country]`, `/explore/[country]/[region]` listing the routes they surface.
- Optionally add a `FAQPage` to the explore hub for common route-discovery questions.

---

## What NOT to change

- The five existing feature pages' schema pattern (`WebPage + BreadcrumbList + FAQPage`) is correct and consistent — preserve it on the new pages.
- `/bikes` programmatic pages being absent from llms files is acceptable (scale-generated content; keep them out of the curated reference).
- Do not over-list comparisons in `llms.txt` if the curation is intentional — just record the decision.
