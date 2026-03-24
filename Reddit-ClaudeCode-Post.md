# r/ClaudeCode Post — DRAFT

---

## HOW TO POST THIS ON REDDIT

1. Go to r/ClaudeCode → Create Post
2. Select flair — look for "Workflow", "Tutorial", "Plugin", or "Show & Tell" (pick whatever fits best)
3. Use one of the titles below
4. Paste the post body
5. Post prepared follow-up comments to seed discussion

**When to post:** A few days after the r/ClaudeAI post. Different audience, different angle.

**Angle vs other posts:**
- r/ClaudeAI → compound engineering philosophy + story
- r/claude → Design Lenses plugin only (no app promo)
- **r/ClaudeCode → technical deep dive: CLAUDE.md structure, actual workflow, concrete code patterns, the plugin architecture. This is the "show me the code" version.**

---

## TITLE (pick one):

**Option A:** My CLAUDE.md setup for shipping a full-stack app in 5 days — here's the structure that made compounding actually work

**Option B:** How I structure CLAUDE.md + a compound engineering workflow to get Claude Code to produce consistent output across a full project

**Option C:** The CLAUDE.md structure and workflow that let me ship a full-stack monorepo app in 5 days. Sharing the setup.

---

## POST BODY:

I shipped a full-stack mobile app in 5 days using Claude Code without typing a single line of code. Not as a flex — I want to share the actual setup that made it work, because the CLAUDE.md structure and workflow matter way more than people realize.

The app is a Turborepo monorepo — Expo 54 mobile app, NestJS 11 GraphQL API, Next.js landing page, Supabase for DB and auth, shared packages for types, design tokens, and generated GraphQL types. I'm sharing the actual patterns because I think they're useful for anyone doing full-stack projects with Claude Code.

**Disclosure:** I also built a Claude Code plugin called [Design Lenses](https://github.com/andrejkanuch/design-lenses) during this project. I'll cover it at the end. It's free and MIT licensed.

---

**The CLAUDE.md structure that made compounding work**

I see a lot of people write a CLAUDE.md once and forget it. Mine grew throughout the project. Here's the structure I landed on — not the full file, but the sections that actually mattered:

**Architecture section** — where things live and how they connect:
```
## Architecture
- apps/mobile: Expo 54 — user-facing mobile app
- apps/api: NestJS 11 — GraphQL API (code-first) + Claude AI
- apps/web: Next.js 16 — web app + admin dashboard
- packages/types: Zod schemas, shared TS types, DB types
- packages/graphql: generated GraphQL client types (TypedDocumentNode)
- packages/design-system: CSS tokens, semantic colors, spacing constants
```

This seems basic but it prevents Claude from guessing where things go. Without this it would regularly create files in the wrong directory or import from the wrong package.

**Naming conventions** — the thing that prevents 80% of inconsistency:
```
## Naming Conventions
- DB columns: snake_case (user_id, content_json)
- TypeScript/GraphQL: camelCase (userId, contentJson)
- Map at the NestJS service layer; never expose snake_case to clients
- GraphQL operations: Get/List/Create/Update/Delete + EntityName
- GraphQL files: kebab-case (get-article-by-slug.graphql)
- Expo routes: kebab-case (add-bike.tsx)
```

Before I added this Claude would randomly switch between naming styles. After — consistent on every file.

**The "Do NOT" section** — this is the most important part:
```
## Do NOT
- Import from apps/ into packages/
- Use relative paths across package boundaries (use @motovault/* imports)
- Modify generated files in packages/graphql/src/generated/
- Modify packages/types/src/database.types.ts (auto-generated)
- Use ESLint or Prettier (use Biome)
- Skip RLS policies on new tables
- Use TypeScript `enum` (use `as const` objects)
- Use `any` type for GraphQL data — always use generated types
- Hardcode colors (hex, rgba) — use palette tokens from design-system
```

Every single one of these came from Claude making that exact mistake at least once. I'd catch it in review, add it to the Do NOT list, and it wouldn't happen again. This is where compounding really lives — in the accumulated mistakes.

**Type system documentation** — Claude needs to know which types to use where:
```
## Type System (Three Sources)
- database.types.ts: DB row shapes — use ONLY in NestJS services
- Zod schemas: Validation/input types — use at API boundaries, forms
- NestJS @ObjectType(): API contract — defines what GraphQL clients see
- TypedDocumentNode: Generated client types — use in mobile + web
```

Without this Claude would import database types directly into mobile components, breaking the type boundary.

**Update sequences** — for multi-step operations:
```
## Update Sequence (when modifying data models)
1. Update Supabase migration SQL
2. Push migration: npx supabase db push
3. Run pnpm generate:types to update database.types.ts
4. Update Zod schemas in packages/types to match
5. Update NestJS models/resolvers to match
6. Run pnpm generate to regenerate full pipeline
```

This was critical. Without it Claude would update the resolver but forget the migration, or update the Zod schema but skip the type generation step.

---

**The workflow: backend-first compounding**

What works for me is starting with database and backend. Not touching a single screen file until I have a clear picture of how the data looks, how the API is shaped, how things connect.

Database schema, GraphQL types, Zod validation, RLS policies — all solid before I touch frontend. This is where most of the compounding starts because once the AI has a strong backend contract to work against, frontend screens are mostly assembly.

First screen took a lot of back-and-forth. By the tenth screen Claude was producing code that matched my patterns on the first try. It had nine screens worth of established conventions to reference. Less correction, fewer hallucinations, way faster output.

The key: every time Claude got something wrong I added the correct pattern to CLAUDE.md. The file grew from maybe 20 lines on day 1 to 100+ by the end. That's the compound interest.

---

**Where Claude hallucinates the most (with examples)**

Specific patterns I kept running into:

**1. Phantom database relationships.** Claude would write a query joining tables through a relationship that didn't exist in my schema. The code looked perfectly valid — correct Supabase syntax, correct field names — but the relationship wasn't defined. Compiles fine, returns empty data silently.

**2. Almost-right field names.** It would use `content_json` in one place and `contentJson` in another, or reference `bike_id` when the column was actually `motorcycle_id`. Close enough to look right in review.

**3. Ignoring the type generation pipeline.** It would add a new field to a resolver but not update the corresponding Zod schema or run the codegen step. Everything compiles because the generated types are stale — you only discover the mismatch at runtime.

**4. Happy path only.** Every screen's happy path would be perfect. Empty states, error handling, loading states — consistently missing unless I explicitly asked for them. This is exactly why I built the design plugin.

---

**The design plugin: Design Lenses**

Problem 4 above kept happening. I was catching the same UI issues on every screen — missing empty states, inconsistent padding, robotic copy, no haptic feedback, animations that felt wrong. I'm lazy about design and don't have the vocabulary to describe fixes precisely.

I came across [Impeccable](https://impeccable.style/) — great concept of giving AI design skills through structured commands. But I wanted something that runs as a compound loop, not individual commands.

So I built [Design Lenses](https://github.com/andrejkanuch/design-lenses). It's a Claude Code plugin that runs 8 agents across 4 rounds:

1. **DIAGNOSE** — visual hierarchy, accessibility, contrast, domain usability (no edits)
2. **FOUNDATIONS** — spacing, typography, color tokens, copy quality
3. **ENHANCE** — animations, edge cases, text overflow, responsive behavior
4. **SHIP** — pixel alignment, performance, final polish

Between rounds an orchestrator synthesizes by consensus (CONSENSUS > SINGLE-CRITICAL > SINGLE-MAJOR > SINGLE-MINOR). Agents are research-only — orchestrator applies fixes. Each round builds on the previous round's findings.

Install:
```
claude plugin marketplace add andrejkanuch/design-lenses
claude plugin install design-lenses@design-lenses
```

Usage:
```
/design-lenses:design-loop <file> --domain=<domain>
```

Domain presets: motorcycle, fitness, finance, ecommerce, medical, default. Quick mode: `/design-lenses:design-brainstorm` (3 agents, faster).

MIT licensed, free, works on JSX/TSX/HTML/Vue/Svelte.

---

**TL;DR**

The stuff that actually matters for shipping full projects with Claude Code:

1. **CLAUDE.md is a living document.** Update it after every session. Every mistake becomes a "Do NOT" entry that prevents repetition. This IS the compound interest.
2. **Backend first.** Give the AI a strong contract to work against and frontend becomes assembly.
3. **Naming conventions are the highest-ROI section.** Prevents 80% of inconsistency.
4. **Document your type boundaries.** Claude will import the wrong type from the wrong layer if you don't tell it explicitly.
5. **Update sequences for multi-step operations.** Claude doesn't remember to run codegen unless you tell it the order.

Happy to share more specific sections of the CLAUDE.md or answer questions about the workflow.

---

## Prepared follow-up comments:

**"how big did your CLAUDE.md get?"**
> Started around 20 lines. Ended at 100+ and growing. The key sections by size: Do NOT list (biggest — kept growing with every caught mistake), naming conventions, architecture overview, type system rules, auth patterns, mobile UI patterns, Supabase client rules, and update sequences. I'd say the Do NOT list alone was responsible for half the productivity gains. Every time I caught Claude making a mistake and added it to the list, that category of error just stopped happening.

**"do you use CLAUDE.md or .claude/settings.json?"**
> CLAUDE.md for everything project-specific. I keep it in the repo root so it's versioned with the project and any collaborator (human or AI) gets the same conventions. Settings.json is more for Claude Code configuration itself — I keep those minimal. The CLAUDE.md is the knowledge base.

**"how do you handle the type generation pipeline?"**
> I have a documented sequence in CLAUDE.md: migration SQL → push → generate DB types → update Zod schemas → update resolvers → run full codegen. Claude follows this sequence reliably once it's documented. The problem before was that it would do step 5 and skip steps 1-4, so you'd end up with resolvers that reference fields that don't exist in the database yet. Documenting the order fixed it completely.

**"what's the biggest time sink when working this way?"**
> Review. Not writing code, not prompting — reviewing output. Especially early in a project when the CLAUDE.md is thin and Claude is still learning patterns. I probably spent 30-40% of my time reviewing generated code, especially the stuff that looked correct. The obvious bugs are fast to catch. The subtle ones — wrong relationships, stale types, almost-right field names — those eat time. Gets much faster as the project matures and the CLAUDE.md fills out.

**"is compound engineering just 'iterate and improve'?"**
> It's more specific than that. Regular iteration means you get better over time vaguely. Compound engineering means each cycle produces concrete artifacts (CLAUDE.md entries, established patterns, type contracts) that make the next cycle measurably faster. The difference is that the improvements are encoded in the system, not just in your head. If you took a break for two weeks and came back, the CLAUDE.md still has everything. The compounding doesn't decay.

**"how does the design plugin consensus work?"**
> Each of the 8 agents produces findings independently. The orchestrator collects all findings and categorizes them: if 3+ agents flag the same issue it's CONSENSUS (highest priority, always applied). If only one agent flags it but it's critical (accessibility violation, broken layout) it's SINGLE-CRITICAL. Single agent minor suggestions are SINGLE-MINOR and might not get applied. This filtering is what makes it practical — without it you'd get 8 agents worth of noise and no way to prioritize.

**"can you share the full CLAUDE.md?"**
> It's pretty specific to my stack (Expo + NestJS + Supabase + Turborepo) but the structure transfers to any project. The sections that matter everywhere: Architecture (where things live), Naming Conventions, Type Boundaries, Do NOT list, and Update Sequences. Even if your stack is completely different, those five sections will prevent 90% of the consistency issues I had early on.
