# Audit — Africa Twin DCT Data Pilot + Blog CMS/SEO Plans

**Date:** 2026-06-22
**Method:** 7 parallel specialist agents (feasibility, data-integrity, security, coherence, scope, product, adversarial). Each verified the plan's codebase claims against the actual repo rather than taking them on faith.
**Documents audited:**
- `docs/plans/2026-06-19-001-feat-africa-twin-dct-data-pilot-plan.md` (primary — the implementable artifact)
- `docs/brainstorms/2026-06-19-motorcycle-data-sourcing-requirements.md` (origin)
- `docs/brainstorms/2026-06-18-blog-cms-requirements.md`
- `docs/brainstorms/2026-06-19-blog-seo-content-strategy.md`
**State at audit:** nothing built. Latest migration `00148`; plan targets `00149`. This is a *plan* audit.

---

## Verdict

**The plan is unusually well-grounded and should NOT be built as currently sequenced.** Its factual premises about the codebase are almost all true, the verification-gate design is the right shape, and the migration mechanics are safe at this table's scale. But the audit surfaced **five P0 issues the 2026-06-21 review pass missed** — two of which are *false success criteria* (the "renders identically in article + app" parity claim is already contradicted by existing code, and "imperial never persisted" is false on the web path), one safety-control weakness (the numeric guard is a leaky denylist), one durability/data-loss hazard in the gate semantics, and one strategic mis-sequencing (the pilot builds its blog half on the exact MDX pipeline the CMS doc commits to deleting).

**Recommendation: re-sequence, keep the data-model work, fix the five P0s before writing code.** The acquire→extract→verify→store half (U1–U4, U7) is durable and can proceed. The render half (U5/U6 article) should wait behind a minimal CMS core, or be explicitly owned as disposable scaffolding.

---

## What the audit CONFIRMED is solid (don't relitigate)

Verified true against the repo:
- `oem_maintenance_schedules` (00022) is make-level, no provenance, `is_verified` never set, can't represent variants. ✓
- `findByMotorcycle` / `autoPopulateForBike` / `previewCache` / `mapRow` / the `scheduleIdFilter` PK branch all exist where the plan says (`oem-schedules.service.ts:21/126/16/225/143`). The "4th tier" framing is accurate (3 tiers today). ✓
- `content_generation_log.content_type` CHECK has exactly the 7 enumerated values; `00145` is the DROP/ADD pattern. ✓
- `00144_model_insights.sql` is a real service-role-only RLS template (ENABLE RLS, no policies, updated_at trigger). ✓
- `article-generator.service.ts` is OpenAI (not Claude — CLAUDE.md is wrong, the docs are right), writes to the `articles` DB table → genuinely can't write the web tree, so the separate `apps/web/scripts/` generator decision is correct. ✓
- DB-role-check pattern is real (`trip-templates.service.ts:344` — note: plan cites a shortened path), JWT role is INFORMATIONAL-ONLY per the decorator, proxy `adminAuth()` exists, web uses TanStack Query + graphql-request (no urql), `revalidate = 604800` confirmed, all three mobile files + the diagnose disclaimer card exist. ✓
- The deny-all RLS posture + "no `motorcycle_id` FK → no IDOR" reasoning for the two new tables is correct. ✓

The plan's authors did their homework. The findings below are gaps, not a teardown.

---

## P0 — Resolve before writing any code

### P0-1 — Strategic: the pilot's blog half is built on the pipeline the CMS doc commits to retiring
*Flagged by: product, coherence, scope, adversarial.*
The pilot writes a committed `.mdx` to `apps/web/content/blog/en/` and uses a `dataset_models` frontmatter key as an explicit "stand-in for the future `blog_posts` FK." The CMS doc's stated goal: "the file-based MDX pipeline is **fully retired**; the database is the single source of truth," migrating all 50 MDX files to rows. So the pilot's new article becomes the 51st file to migrate, and the generator gets built twice (once writing `.mdx`, once writing a row). The pilot's regenerate→commit→deploy + 7-day-ISR workflow is exactly the deploy-coupled flow the CMS exists to kill.
**Fix:** Land the minimal CMS core first (`blog_posts` + `blog_redirects` + the data-source swap the de-risk spike already proved is a field-for-field copy), then U5 writes a `blog_posts` row and `dataset_models` becomes the real FK. U1–U4 + U7 (the data half) have no such dependency — run them in parallel now. If you keep the MDX path anyway, state in writing that the render half is disposable scaffolding.

### P0-2 — The gate must be ONE shared predicate applied to every read path; gate on `is_verified` alone, and backfill existing rows
*Flagged by: data-integrity, security (both as P0).*
The plan states the gate `source_id IS NULL OR is_verified = true` in two code locations (`findByMotorcycle` tiers AND the `scheduleIdFilter` PK branch) — the exact two-implementations shape that caused the *original* P0. Worse, `source_id IS NULL = trusted` is fragile: the day anyone backfills `source_id` onto the legacy baseline rows (the whole point is provenance everywhere), every baseline row flips to requiring `is_verified=true`, which defaults `false` → **mass silent reminder regression**, or someone sets `is_verified=true` without human review → unverified numbers go live.
**Fix:** (a) Extract a single `applyRowGate(query)` helper and call it in every query builder in the file. (b) Make the gate `is_verified = true` alone, and **backfill all existing baseline rows to `is_verified = true` in the U1 migration** (they are today's trusted production data). Then `source_id` is pure provenance with one meaning. (c) Add a test that fails if any `source_id IS NOT NULL AND is_verified = false` row is reachable by any tier or the PK branch.

### P0-3 — The numeric guard is a leaky denylist; invert it to an allowlist
*Flagged by: feasibility, scope, security, adversarial (4 agents). Adversarial verified against the real CBR article.*
The guard ("digit followed by km/mi/Nm/ml/bar/psi/mm") misses the spec formats the existing maintenance articles actually use: `10W-30`/`SAE 10W-30`, `4.8 L`/`3.4 quarts`, `kPa`, `lb-ft`, en-dash ranges (`0.20–0.24`), spelled-out (`every 16,000 kilometers`), hyphenated-adjective (`8,000-mile interval`), decimal-comma (`0,20`). Any of these slipping into prose is an AI-typed safety number on a live page — the core invariant breaks. It also false-positives on legit narrative (`1,100cc`, `6 gears`, `2-year`).
**Fix:** Invert the control. The narrative Zod schema already forbids numeric fields — enforce that the **rendered prose contains no standalone digit-cluster at all** (reject `\d` outside the dataset-driven table regions; narrative says "see the schedule below"). Apply it to ALL string fields (headings, key-takeaways, intro), not just the body. Add the CBR-article formats as guard test fixtures.

### P0-4 — "Renders identically in article + app" is already false: mobile is km-only, web is mi+km
*Flagged by: adversarial (verified `maintenance.tsx:601`).*
Mobile renders `${intervalKm} km` with **no** unit-system conversion, despite the app having a `unitSystem` preference used elsewhere. The article template renders `8,000 mi (12,000 km)`. A US rider sees different *units* on the two surfaces today, and during the ISR window potentially different *numbers*. U7's parity test only compares the metric cell, so it would green-light this divergence.
**Fix:** Either (a) mobile applies the same render-time imperial derivation gated on `unitSystem`, and the parity test asserts the *displayed* string per unit system; or (b) narrow the success criterion in writing to "the stored metric value is identical," conceding displayed units differ. Don't let a metric-only assertion stand in for "renders identically."

### P0-5 — "Imperial derived at render, never persisted" is false on the web path, and rounding mints an unverified safety number
*Flagged by: feasibility, adversarial.*
For the committed MDX, imperial **is** persisted — baked into the file as text by the generator (there's no per-request render hook for static MDX). And imperial is never verified against any source (the Spanish manual is metric-only), so rounding can change a practical value: `24 Nm → 17.7 → 18 lb-ft` (~5% over-torque if torqued to 18), valve clearance `0.20 mm → 0.008 in` loses a significant figure.
**Fix:** Reword KTD 7: imperial is derived at *generation* time for the article (baked into MDX) and at render time on mobile; never stored in the *dataset DB rows*. Specify rounding precision **per `spec_type`** and add a `convert→round→convert-back` tolerance test that flags any spec whose displayed imperial exceeds tolerance for human review.

---

## P1 — Significant; resolve during planning of the affected unit

- **7-day ISR window lets app and website show different safety numbers after a correction** *(adversarial, coherence, feasibility).* Mobile is DB-live, web MDX is stale up to 7 days. The plan files this under "freshness"; it's actually two live surfaces publishing contradictory safety numbers. **Fix:** make the generator script trigger on-demand revalidation as one atomic step; add a bounded-staleness caveat to the success criterion.
- **Verification gate is single-human / single-source / single-edition → rubber-stamp risk** *(adversarial, security).* A confidently-wrong extraction (right format, plausible but wrong page) gets approved against a 14MB Spanish manual. The origin's "flag mismatches between sources" safeguard is structurally absent with one source. **Fix:** show the AI's extracted *context snippet* (not just "Page N"), require the reviewer to **re-type** the value, and state explicitly that single-source cross-check is deferred (not silently dropped).
- **"Feeds the #2 feature" is undercut by the deferred variant-capture UI** *(product, coherence, scope, feasibility).* No real user can set `variant`, so the verified DCT rows sit in a tier no production bike reaches — in-app payoff is ~zero on ship. **Fix:** either pull a minimal DCT/MT onboarding selector into the pilot (cheap vs the verification machinery), or drop the in-app justification and own it as "establishes the pattern; in-app value lands when capture ships."
- **`value TEXT` defeats the Zod range-guard, dedup, and safe conversion** *(data-integrity).* Range guard runs only in extraction; a later SQL/import write of `5000` or `0.020` isn't rejected; decimal-comma reparse at render can produce a 100×-wrong torque. **Fix:** store `value_numeric NUMERIC NOT NULL` (parsed+validated once) + optional `value_display TEXT` (verbatim manual string); add a `CHECK` per spec_type.
- **Natural-key index details** *(feasibility, data-integrity).* Must use `COALESCE(variant,'')` expression form (matching `00129`'s `COALESCE(model,'')`/`COALESCE(year_from,0)`), AND include `COALESCE(year_to,0)` — both in the recreated index and the duplicate pre-check GROUP BY — or non-overlapping year ranges collide. State the exact DDL.
- **`motorcycle_specs` has no unique constraint → "re-running creates no duplicates" is aspirational** *(data-integrity).* **Fix:** add `UNIQUE (make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), spec_type, spec_name)` + `ON CONFLICT DO UPDATE`.
- **`verified_by` FK with no `ON DELETE` blocks GDPR erasure** *(data-integrity).* Defaults to RESTRICT; the repo has an account-deletion pipeline. **Fix:** `verified_by ... ON DELETE SET NULL` (keep `is_verified`/`verified_at` as the durable audit fact).
- **The existing 20 legacy maintenance articles stay live, uncited, no disclaimer** *(adversarial).* The disclaimer gates on `specData: true`, which only the new generator sets. The legacy articles assert the same safety numbers the plan calls a liability. **Fix:** add a P1 follow-up to retrofit the disclaimer onto existing maintenance articles regardless of `specData`.
- **Don't copy the existing `is_safety_critical` logic** *(security).* `article-generator.service.ts:233` derives it from LLM-output keyword matching — the opposite of the plan's server-set allowlist. The plan says "follow article-generator.service.ts as a pattern," so a dev could replicate the wrong approach. **Fix:** define the allowlist as an `as const` constant in `packages/types` and flag the divergence in U2.
- **"Public preview" framing is inaccurate** *(data-integrity, security).* `oemSchedulesPreview` has no `@Public()` → runs under the default-closed global guard (authenticated). The gate is still needed (any authed user must not see drafts), but reword to "authenticated onboarding preview" so the threat model is right.
- **Service-role key handling for the web script is undocumented** *(security, feasibility).* `apps/web/scripts/` doesn't exist and `apps/web/.env.example` has no `SUPABASE_SERVICE_ROLE_KEY`. **Fix:** add it as a comment-only entry, name the `package.json` invocation, and confirm it runs as a standalone Node step (never `NEXT_PUBLIC_*`, never in the bundle).
- **U6 file list is missing `apps/web/src/lib/blog.ts`** *(feasibility).* `specData` isn't parsed into the `Article` interface today; the disclaimer predicate needs it surfaced.
- **Owner's-manual coverage + edition/market assumptions** *(adversarial).* U2 targets torque/valve clearance while Scope admits those are often service-manual-only (deferred) — the spec path may produce empty rows. The Spanish edition's intervals may differ by market from the EN/US-facing article. EU sui-generis database right can attach to reproducing the manual's schedule *structure*, not just verbatim prose. **Fix:** U2 pre-flight to confirm the manual actually contains each targeted spec_type; record edition/market applicability; extend the legal posture to table-structure curation.

---

## P2 — Scope, clarity, and polish

- **Scope cuts to consider for a genuinely "lean" pilot** *(scope).* (a) Is `motorcycle_specs` needed to prove the loop, or do interval rows alone satisfy "end-to-end"? Keep only if U5 explicitly renders richer-than-mobile spec tables — and say so. (b) U4's full admin page (per-row loading/error/empty, bulk action, confirm dialogs) is past "lean" for one owner verifying ~20 rows; a developer-run approval script + the approve mutation proves the gate just as well. (c) The CMS/SEO "7 fields now" list should split into keep (seoTitle/metaDescription/ogImage/authorId/robots_noindex/canonicalUrl/blog_redirects) vs defer (clusterSlug/isPillar/showLastUpdated/changeSummary/schema_type toggle) vs keep-nullable-zero-content (tl_dr/key_takeaways). The conversion-widget components belong outside the CMS schema entirely.
- **`dataset_models` format is unspecified** *(coherence, scope).* `["HONDA/CRF1100/DCT"]` slash-format has no parser spec. Document `make/model[/variant]`, normalization rules, and how it maps to columns.
- **Locale-propagation success criterion contradiction** *(coherence).* Origin says corrections propagate "to the article, the reminders, and all locales"; pilot narrows article to en-only. Reconcile the wording in the origin's success criterion.
- **CMS open-redirect / canonical validation** *(security).* When the CMS is built, validate `blog_redirects.to_slug` is a relative internal path and `canonical_url` is within `motovault.app` (UI + DB CHECK).
- **Liability framing may raise the bar, not lower it** *(product, adversarial).* A citation is an authority claim; the disclaimer partly retracts it. Treat accuracy/correctness as the headline benefit; don't let "liability reduction" carry the cost/payoff case.
- **Minor doc fixes** *(feasibility, coherence).* Correct the `trip-templates.service.ts` path; clarify U5's two generators (narrative LLM in API vs build-time MDX in web); specify the exact `oem.disclaimer` copy; move U1's `maintenance_extraction`/`maintenance_narrative` test assertions into U2/U5; prefer reusing `public.update_updated_at()` over a third trigger fn.

---

## Suggested order of operations

1. **Decide the sequencing (P0-1)** — CMS-core-first vs scaffolding-owned. This changes U5/U6 materially.
2. **Apply the five P0 fixes to the plan** (gate helper + is_verified + backfill; allowlist guard; parity wording or mobile conversion; imperial rounding/persistence wording).
3. **Fold the migration-correctness P1s** (NUMERIC value, index COALESCE+year_to, specs unique constraint, verified_by ON DELETE) into U1.
4. **Then** `/ce-work` U1 → U7 (data half can start immediately; render half per step 1).
