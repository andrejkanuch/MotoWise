# Schema markup report — MotoVault (`apps/web`)

**Scope:** JSON-LD / structured data in the Next.js web app.  
**Date:** 2026-04-14  
**Skill:** seo-schema (detection, validation, recommendations)

---

## Detection summary


| Mechanism                                           | Found                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **JSON-LD** (`<script type="application/ld+json">`) | **Yes** — primary pattern via `JsonLdGraph` (`src/components/marketing/json-ld-graph.tsx`) and a few inline scripts |
| **Microdata** (`itemscope`, `itemprop`)             | **No**                                                                                                              |
| **RDFa** (`typeof`, `property`)                     | **No**                                                                                                              |


**Format:** JSON-LD only — aligns with Google’s stated preference.  
**Emission:** Server components; graph serialized with `<` escaped as `\u003c` (safe embedding).

---

## Validation matrix


| Page / area                                                          | Primary `@type`s                                     | Status | Notes                                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Localized home** `[locale]/(marketing)/page.tsx`                   | Organization, WebSite, SoftwareApplication, FAQPage  | ✅      | Full `@graph` via `JsonLdGraph`. WebSite intentionally has no `SearchAction` (see `schema.ts`).                                                     |
| **Explore (locale)**                                                 | WebPage, BreadcrumbList                              | ✅      |                                                                                                                                                     |
| **Explore country / region**                                         | WebPage, BreadcrumbList, CollectionPage              | ✅      | `numberOfItems` from route list.                                                                                                                    |
| **Explore root** `app/explore/page.tsx`                              | WebSite (standalone object)                          | ⚠️     | Valid JSON-LD; **not** merged into `@graph` with other nodes — minor inconsistency vs marketing pages.                                              |
| **Blog post**                                                        | WebPage, BreadcrumbList, Article                     | ✅      | Uses `buildArticle` + absolute URLs.                                                                                                                |
| **Blog index**                                                       | Blog, BlogPosting stubs                              | ✅      |                                                                                                                                                     |
| **Feature / compare pages**                                          | WebPage, BreadcrumbList, FAQPage (many)              | ⚠️     | **FAQPage** on commercial site: **no Google FAQ rich result** (Aug 2023); **acceptable for LLM / AI citation** — already documented in `schema.ts`. |
| **Bikes hub & leaf**                                                 | WebPage, BreadcrumbList, FAQPage (conditional)       | ✅ / ⚠️ | Same FAQ note on leaves with FAQs.                                                                                                                  |
| **Tools** (cost calculator, TCLOCS)                                  | BreadcrumbList, WebApplication                       | ✅      |                                                                                                                                                     |
| **About / press**                                                    | Organization, ProfilePage, BreadcrumbList, etc.      | ✅      |                                                                                                                                                     |
| **Compare hub**                                                      | BreadcrumbList, ItemList, FAQPage, MobileApplication | ⚠️     | FAQ + `MobileApplication` — verify `MobileApplication` vs `SoftwareApplication` consistency with rest of site (cosmetic for rich results).          |
| **Support**                                                          | FAQPage (inline)                                     | ⚠️     | Same FAQ commercial caveat.                                                                                                                         |
| **Legacy route by UUID** `app/routes/[id]/page.tsx`                  | WebPage, Place, Review, Rating, AggregateRating      | ✅      | Custom `buildRouteJsonLd` — reviews in graph for SEO.                                                                                               |
| **Public slug route** `app/route/[country]/[region]/[slug]/page.tsx` | —                                                    | ❌      | **No JSON-LD emitted.**                                                                                                                             |


---

## Critical gap: `/route/{country}/{region}/{slug}`

- **Helpers exist** in `src/lib/seo/jsonld.ts`: `routeToTouristAttraction`, `regionToPlace`, breadcrumb builders — with tests in `src/lib/seo/__tests__/jsonld.test.ts`.
- **These helpers are not imported** by `app/route/[country]/[region]/[slug]/page.tsx`.
- **E2E** (`e2e/routes-discovery.spec.ts`) expects the first `application/ld+json` script to parse as `**@type: TouristAttraction`** when the route returns 200 — this will **fail** until the page emits that graph.

**Recommendation:** In the route detail page component, build a `nodes` array with e.g.:

1. `routeToTouristAttraction(...)` (map `fetchRoute` payload + `startLat`/`startLng` from polyline or API if required by `RouteForJsonLd`)
2. `buildBreadcrumbList(...)` from `@/lib/seo/schema` (or route-specific breadcrumb helper from `jsonld.ts` if used there)
3. Optionally `WebPage` for the canonical `/route/...` URL

Render with `<JsonLdGraph nodes={graph} />` at the top of the layout (same pattern as `/routes/[id]`).

**Ratings:** `routeToTouristAttraction` only adds `aggregateRating` when `ratingCount >= 3` — keep that rule to avoid Google thin-data flags.

---

## Deprecated / restricted types (seo-schema policy)


| Type                                           | Status in repo                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **HowTo**                                      | **Not used** ✅ (deprecated for rich results Sept 2023)                                          |
| **FAQPage**                                    | **Used** on many commercial pages — **OK for GEO/LLM**; do **not** expect FAQ rich results ✅/⚠️ |
| **SpecialAnnouncement**, **ClaimReview**, etc. | **Not used** ✅                                                                                  |


---

## Common technical checks


| Check                             | Result                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@context` on emitted graphs      | ✅ Present via `JsonLdGraph` wrapper (`https://schema.org`)                                                      |
| Relative URLs in JSON-LD          | ✅ Canonical URLs built with `BASE_URL` / `getCanonicalUrl` in builders                                          |
| Placeholder / fabricated ratings  | ✅ `schema.ts` documents no fabricated `aggregateRating`; `routeToTouristAttraction` gates on `ratingCount >= 3` |
| Multiple disconnected script tags | Mostly **one** graph per page using `@graph` ✅ (explore root exception above)                                   |


---

## Recommendations (priority)

1. **Critical:** Wire `**routeToTouristAttraction` + BreadcrumbList** into `**app/route/[country]/[region]/[slug]/page.tsx`**; align **E2E** with rendered output.
2. **High:** Consider wrapping **explore root** `WebSite` in the same `**JsonLdGraph` / `@graph`** pattern for consistency (optional second node later, e.g. `WebPage`).
3. **Medium:** Run **Google Rich Results Test** on homepage, one blog URL, one compare URL, and (after fix) one `/route/...` URL.
4. **Low:** Document in README or internal doc that **FAQPage** is intentional for **AI citation**, not for FAQ snippets.

---

## Files referenced

- `apps/web/src/components/marketing/json-ld-graph.tsx`
- `apps/web/src/lib/seo/schema.ts`
- `apps/web/src/lib/seo/jsonld.ts`
- `apps/web/src/app/route/[country]/[region]/[slug]/page.tsx` (no schema today)
- `apps/web/src/app/routes/[id]/page.tsx` (has schema)
- `apps/web/e2e/routes-discovery.spec.ts`

