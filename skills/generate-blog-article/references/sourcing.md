# Sourcing, Citation & Provenance Rules

The single most important rule: **every fact and every number must come from a real source you actually fetched and read.** No invention, no "typical values", no memory-only numbers. This is a public, brand-facing, sometimes safety-relevant site.

## What counts as an acceptable source
Ranked best → acceptable:
1. **Manufacturer official documentation** — owner's manuals (free OEM PDFs), official service-interval pages, OEM spec sheets.
2. **Official safety / regulatory bodies** — NHTSA (vPIC), FIM, national transport authorities.
3. **Authorized dealer / OEM service portals.**
4. **Long-established moto publications** for general (non-numeric) context only.

Not acceptable: random forums as a sole source for numbers, AI-generated content farms, pirated service manuals, your own prior knowledge unverified.

## Extraction rules
- **Facts only.** Service intervals, torque values, fluid capacities, valve clearances, tyre pressures are factual data (not copyrightable). Extract those.
- **Never reproduce** prose, step-by-step procedures, diagrams, photos, or verbatim formatted tables from a manual. Re-express data in your own structure.
- **Two-source rule** for any number that affects safety or money: confirm against ≥2 independent sources. If they conflict, present a range and note the discrepancy — never pick one silently.
- **Units:** keep the manual's metric value as canonical; show imperial conversion alongside.

## Recording provenance (the "pull sources from where you got the data" requirement)

### In every article body
End the body with:
```md
## Sources
- [Yamaha MT-09 Owner's Manual (2024)](https://…) — service intervals, oil capacity
- [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) — model/year verification
```
Each bullet = the real title, a real link, and what it sourced. Minimum 2 sources for a guide, and for spec articles a source for **every** numeric table.

### In the database (SPEC mode only)
For each manual used, insert a `maintenance_data_sources` row (`source_type`, `title`, `edition_language`, `market_applicability`, `reference` part-number if known, `source_url`), and reference its `id` when staging extracted spec values so a human can audit the chain later. See `db-schema.md`.

## Accuracy / honesty in the article
- If a value couldn't be verified, **say so** ("manufacturer figure not published; dealer-quoted range") rather than presenting a confident number.
- Make model-year and market scope explicit (a 2021 MT-09 differs from a 2024).
- The verify-against-official-docs disclaimer is rendered automatically on the page — but it does not excuse a wrong number. Get the numbers right or leave them out.

## Why drafts for specs
Safety-critical numerics (torque, valve clearance, brake specs) can injure someone if wrong. The project rule is: a human signs off before those go live. So spec articles are inserted as `status='draft'`; a person reviews the numbers against the cited sources and publishes. Do not bypass this.
