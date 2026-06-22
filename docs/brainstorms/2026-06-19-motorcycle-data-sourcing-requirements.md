# Motorcycle Data Sourcing & Article Pipeline — Requirements

**Date:** 2026-06-19
**Status:** Ready for planning
**Scope:** Deep (cross-cutting: data sourcing, legal posture, accuracy/verification, web + mobile data integration)
**Companions:**
- `docs/brainstorms/2026-06-18-blog-cms-requirements.md` — the CMS that renders these articles.
- `docs/brainstorms/2026-06-19-blog-seo-content-strategy.md` — why the maintenance cluster is the priority and how it converts.

## Problem & Motivation

The motorcycle maintenance-schedule cluster is both the **winning SEO content** (74% of impressions, pos 7–10) **and** the backbone of the **#2 in-app feature** (maintenance reminders). Today both run on **unsourced, hand-entered, make-level approximations**:

- Brand maintenance blog posts are hand-authored and state hard numbers as fact (*"valve clearance every 16,000 km"*) with **no source cited**.
- The in-app `oem_maintenance_schedules` table (`supabase/migrations/00022_*`) holds only **make-level** generic intervals (`model = NULL`) — it cannot represent variant-specific service (e.g. a Honda Africa Twin **DCT**'s transmission-fluid service differs from the manual-gearbox version).
- **No content table stores provenance** (`source_url`, `verified_by`); `is_verified` is never set.

This is an accuracy/liability gap on safety-critical data and a missed compounding opportunity: the same per-model data, sourced once and verified, can power both surfaces.

## Goal

Build a **source-of-truth per-model maintenance dataset**, populated from official documentation with full provenance and a human-verification gate, from which **both** blog articles and in-app maintenance reminders render. No safety-critical number is ever invented or re-typed by an LLM at publish time.

## Decisions (resolved in brainstorm)

1. **Structured-first.** The deliverable is a structured per-model dataset, not prose. Articles and the existing `oem_maintenance_schedules`/reminders both read from it. One source of truth.
2. **Aggressive sourcing posture.** Pull per-model data from OEM **owner's manuals** (free OEM PDFs — primary) **and service/workshop manuals** (for torque, valve-clearance, deep specs). Guardrails below.
3. **Verification gate.** Every value stores its citation. **Safety-critical numerics require human sign-off** against the cited source before they go live or feed reminders. Non-safety-critical values (cost estimates, narrative) are AI-confidence-gated.
4. **Hybrid rendering.** Spec tables render **directly from the verified dataset**; the LLM writes only the surrounding narrative. The LLM never re-types a safety-critical number at publish time — a verified `34 Nm` renders identically in the article, the app, and every locale.
5. **Pilot:** Honda **Africa Twin DCT**, end-to-end, as model #1 — proves variant granularity and is owner-verifiable (dogfood), before scaling to the ranking brands.

## Legal & Sourcing Guardrails (hard constraints)

- **Facts only.** Maintenance intervals, capacities, torque values, clearances, pressures are facts and are not copyrightable — extract and store the *values*. **Never reproduce** manual prose, procedures, step-by-step instructions, diagrams, or verbatim tables/layout.
- **Legitimate acquisition.** Owner's manuals from official OEM sources; service manuals **purchased/licensed**, never pirated PDFs.
- **Nominative use only.** "Honda Africa Twin DCT" used descriptively; no implication of OEM endorsement or affiliation.
- **Community data labeled.** Forum/owner data (real-world cost, "owners change at X") is allowed but clearly marked as community-sourced, never presented as factory spec.

## Mandatory Disclaimer (release-blocking)

Every page that surfaces sourced spec data — **both the blog article template and the in-app maintenance views** — must display a persistent footer disclaimer stating:
- the information is **informative in character**, and
- riders must **verify against official sources / their owner's & service manual** before acting on any value.

A page that renders spec data without this disclaimer fails release. (Reinforces, not replaces, the per-value verification gate.)

## Pipeline (in scope)

1. **Acquire** — per model/variant, gather the owner's manual (OEM PDF) and the legitimately-obtained service manual. Acquisition is human-initiated by nature (paid manuals); the pipeline catalogs each source document.
2. **Extract** — AI parses each document into structured fields, **each value tagged with provenance** (source document + page/section). The LLM's role is extraction, not generation of values.
3. **Verify** — a review queue. Safety-critical numerics are surfaced with their citation for human sign-off (`verified_by`, `verified_at`) before they can go live or populate reminders. Mismatches between sources are flagged.
4. **Store** — the canonical dataset (data-model intent below).
5. **Render (hybrid)** — blog article: spec tables generated from the dataset + AI-written narrative; in-app: reminders read intervals from the same rows. Disclaimer injected on both.

## Data-model intent (detail deferred to planning)

Structured-first is the whole point, so the shape matters; exact columns/indexes are for `/ce-plan`:
- **Extend `oem_maintenance_schedules`** beyond make-level to **make + model + year-range + variant** (e.g. DCT vs manual). Preserve the existing make-level rows as fallback so current reminders don't regress.
- **Specs table** for point values not on an interval cadence (torque, valve clearance, oil/coolant capacity, tire pressures, plug gap, fluid types/part references).
- **Sources/provenance** table referenced by each value: source document, type (owner's/service/community), page/section, retrieval date.
- **Verification fields:** `is_safety_critical`, `is_verified`, `verified_by`, `verified_at`, confidence for non-critical values.
- **Link to `blog_posts`** so an article declares which models/dataset rows it renders (drives "update dataset → article + app refresh").

## Out of Scope (v1)

- **Fully automated acquisition** of manuals (paid service manuals are procured manually).
- **The blog CMS itself** — covered by the companion CMS requirements doc; this doc supplies its maintenance content.
- **Mobile UI redesign** — the app benefits automatically from richer per-model/variant data through the existing `oemSchedulesPreview`/`importOemSchedule` path; UI changes beyond consuming better data are separate.
- **AI provider migration.** The current generator is OpenAI gpt-4.1 (`apps/api/src/modules/articles/article-generator.service.ts`; note `CLAUDE.md` is inaccurate). Whether to switch the narrative-writing step to Claude is a separate decision; not blocking.
- **Non-maintenance content types** (routes, gear reviews) — this pipeline is scoped to maintenance/spec data.

## Success Criteria

- Africa Twin DCT exists end-to-end: every safety-critical value carries a citation and a `verified_by`, the published article's spec tables and the in-app reminders render the **same** verified numbers, and the disclaimer is present on both.
- No safety-critical value reaches a live surface without human sign-off.
- A correction to a dataset value propagates to the reminders and all locales (DB-live) without re-editing prose, and to the article without re-editing prose. *(Audit 2026-06-22: in the Africa Twin pilot the article is English-only, so "all locales" applies to reminders; multi-locale article translation is deferred. The article also updates eventually, not instantly — re-run generator + on-demand revalidation — while reminders update instantly. See the pilot plan's revised Success criteria.)*
- The make-level fallback keeps working for models not yet sourced (no reminder regression).

## Dependencies & Assumptions

- Extends existing infra: `oem_maintenance_schedules` (00022), `articles`/`content_generation_log`, `article-generator.service.ts`, and the mobile `oemSchedulesPreview`/`importOemSchedule` path.
- PDF parsing/extraction capability for manuals (tooling choice deferred to planning).
- Owner's manuals are publicly available as OEM PDFs for the target brands (true for Honda/Yamaha/Kawasaki/BMW/etc.); service manuals require procurement budget.
- Solo + AI authoring; the verification gate is performed by the owner.

## Open Questions (for planning)

- **Extraction tooling:** generic PDF-to-structured-data vs. an LLM with document input; how to capture page-level provenance reliably.
- **Variant taxonomy:** how to model variants (DCT, A2/restricted, market trims) consistently across brands.
- **Cross-locale units:** store canonical SI + imperial, or convert at render? (Articles already show both mi/km.)
- **Service-manual procurement list & order:** which models after the Africa Twin pilot (rank by existing GSC traffic — Yamaha MT, Honda CBR, BMW GS first).
- **Confidence/disclaimer wording** for the community-sourced cost data tier.
