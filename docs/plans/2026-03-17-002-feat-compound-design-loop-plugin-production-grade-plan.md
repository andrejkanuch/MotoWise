---
title: "feat: Compound Design Loop Plugin — Production-Grade Quality"
type: feat
status: completed
date: 2026-03-17
---

# Compound Design Loop Plugin — Production-Grade Quality

## Enhancement Summary

**Deepened on:** 2026-03-17
**Research agents used:** best-practices-researcher, Impeccable skill pattern extractor, spec-flow-analyzer
**Key improvements from deepening:**
1. Added mandatory Context Gathering phase — ask user what they're building before spawning agents
2. Reconciled agent count to 8 (not 6) across 4 iterations
3. Defined progress file schema as shared contract between design-loop and design-status
4. Added input validation, agent failure recovery, and conflict resolution specs
5. Added Skill Authoring Playbook patterns (from Impeccable analysis) as implementation guide
6. Incorporated user feedback: generic prompts don't work — every agent must be parameterized by platform, theme, and scope

## Overview

Upgrade the compound-design-loop Claude Code plugin from a working prototype (510 lines, 3 skills) to a production-grade, marketplace-ready plugin. The plugin orchestrates multi-persona design reviews using parallel agent teams and all 19 Impeccable design commands.

**Plugin location:** `/Users/andrejmacm5/personal/compound-design-loop/`
**Repository:** https://github.com/andrejkanuch/compound-design-loop

## Problem Statement

The plugin works but has critical gaps identified by both automated analysis and expert review:

1. **Agent prompts are too abstract** — reads like a concept doc, not executable instructions. Claude will improvise differently every run.
2. **18-agent spawn is impractical** — token limits, timeouts, context exhaustion. Need to batch into focused agents.
3. **No auto-apply mechanism** — findings from iteration 1 don't feed into iteration 2. Defeats the "compound" promise.
4. **Progress tracking broken** — `design-loop` never creates the file that `design-status` reads.
5. **Prompts not context-aware** — "mobile dark-theme interfaces" advice for a React web dashboard is wrong. Must ask user what they're building.
6. **Missing infrastructure** — no CLAUDE.md, LICENSE, .gitignore, CHANGELOG.md.
7. **Impeccable dependency unclear** — agents reference /critique etc. but don't clarify if delegated or self-contained.
8. **Metadata inconsistencies** — duplicate emails across plugin.json/marketplace.json.

### Research Insights

**From skill authoring best practices:**
- SKILL.md should be under 500 lines — use reference files for deep domain knowledge
- Agent prompts need specificity matched to task fragility (high freedom for creative review, low freedom for structured checklists)
- Every NEVER item needs a "why" clause — theory-of-mind phrasing produces better consistency than dogmatic rules
- Provide input/output examples over prose descriptions for controlling output format

**From Impeccable skill analysis:**
- Effective skills follow Assess → Execute → Verify structure
- DON'T items are always more specific than DO items (name exact anti-patterns)
- Code examples are short (3-10 lines), inline within their dimension, never in a separate section
- Reference files are encyclopedic knowledge; skill files are opinionated workflows

**From spec-flow analysis — critical gaps identified:**
- 12 error paths undefined (missing file, binary file, typo in --domain, agent timeout)
- No conflict resolution rules for when agents disagree
- No re-entry spec for running on a file with existing progress
- Progress file schema undefined — design-status can't parse what design-loop doesn't define

## Proposed Solution

### NEW: Mandatory Context Gathering Phase

Before any agents spawn, the orchestrator must understand what it's reviewing. This replaces hardcoded assumptions with explicit user input.

```
Step 0: Context Gathering (MANDATORY)

Ask the user (or auto-detect with confirmation):

1. PLATFORM: "What platform is this for?"
   → Mobile (iOS/Android)
   → Web (desktop browser)
   → Web (responsive/mobile-first)
   → Cross-platform (React Native / Expo)
   → Other: ___

2. THEME: "What theme/appearance?"
   → Dark theme only
   → Light theme only
   → Both (supports dark + light mode)
   → System-preference adaptive

3. SCOPE: "What are we reviewing?"
   → A single component
   → A full page/screen
   → A multi-screen flow
   → An entire app shell

4. CONTEXT: "Any specific design context?"
   → Outdoor use (sunlight readability)
   → Glove/accessibility constraints
   → Data-heavy dashboard
   → Content/editorial
   → E-commerce/conversion focused
   → None specific

5. DOMAIN: "What domain?" (from --domain flag or ask)
   → motorcycle / fitness / finance / ecommerce / medical / default

Result: A DESIGN_CONTEXT object used in every agent prompt:
{
  platform: "mobile",
  theme: "dark-only",
  scope: "full-page",
  context: "outdoor-use",
  domain: "motorcycle"
}
```

All agent prompts use `[PLATFORM]`, `[THEME]`, `[SCOPE]`, `[CONTEXT]`, `[DOMAIN]` placeholders filled from this context.

### Architecture Redesign: 8 Agents Across 4 Iterations

Consolidate the 18 pseudo-agents into **8 focused agents** (not 6 — the plan previously miscounted):

```
Iteration 1: DIAGNOSE (2 agents in parallel)
├── Agent: Design Critic (combines /critique + /audit)
└── Agent: Domain Expert (parameterized by DESIGN_CONTEXT)
    → SYNTHESIZE → AUTO-APPLY fixes → write progress file

Iteration 2: FOUNDATIONS (2 agents in parallel)
├── Agent: Design System Agent (combines /normalize + /typeset + /arrange)
└── Agent: Copy & Clarity Agent (combines /clarify + /onboard)
    → SYNTHESIZE → AUTO-APPLY fixes → update progress

Iteration 3: ENHANCE (2 agents in parallel)
├── Agent: Motion & Delight Agent (combines /animate + /delight + /colorize)
└── Agent: Resilience Agent (combines /harden + /distill + /adapt)
    → SYNTHESIZE → AUTO-APPLY fixes → update progress

Iteration 4: SHIP (2 agents in parallel)
├── Agent: Polish & Extract Agent (combines /polish + /optimize + /extract)
└── Agent: Bolder/Overdrive Agent (combines /bolder + /overdrive)
    → SYNTHESIZE → AUTO-APPLY final fixes → mark complete
```

### Auto-Apply Mechanism

Between each iteration, the orchestrator follows this exact sequence:

```markdown
## Synthesis Protocol (after each iteration)

1. READ both agent outputs completely
2. CATEGORIZE findings:
   - CONSENSUS (both agents flagged) → apply immediately
   - SINGLE-CRITICAL (one agent, severity=critical) → apply immediately
   - SINGLE-MAJOR (one agent, severity=major) → apply with note
   - SINGLE-MINOR (one agent, severity=minor) → defer to next iteration
   - CONTRADICTION (agents disagree) → prefer the Design Critic over Domain Expert
     for visual issues; prefer Domain Expert over Design Critic for usability issues
3. APPLY fixes using Edit tool on the target file
4. UPDATE design-review-progress.md with:
   - Which fixes were applied
   - Which were deferred and why
   - Agent sign-off status
5. PROCEED to next iteration
```

### Progress File Schema (shared contract)

```markdown
---
status: in-progress | complete
file: path/to/file.html
platform: mobile
theme: dark-only
scope: full-page
domain: motorcycle
started: 2026-03-17T10:00:00Z
iteration: 2
---

# Design Review Progress

## Iteration 1: DIAGNOSE
- [x] Design Critic — 8 issues found, 6 applied, 2 deferred
- [x] Domain Expert — 5 issues found, 4 applied, 1 contradicted

### Applied Fixes
1. Contrast ratio bumped from #404040 to #6b6b6b (consensus)
2. Focus-visible states added globally (critic-only, critical)
...

### Deferred
- Speed readout size increase (single-minor, revisit in SHIP phase)

## Iteration 2: FOUNDATIONS
- [x] Design System Agent — 12 normalizations applied
- [ ] Copy & Clarity Agent — pending

## Commands Covered
- [x] /critique (iteration 1)
- [x] /audit (iteration 1)
- [ ] /normalize (iteration 2)
...
```

### Input Validation

```markdown
## Input Validation (Step 0, before context gathering)

1. FILE PATH: Verify file exists and is readable
   - Missing → "Please provide a file path: /design-loop <file>"
   - Non-existent → "File not found: [path]. Check the path and try again."
   - Directory → "Expected a file, got a directory. Please specify a file."
   - Binary → "Cannot review binary files. Provide an HTML, JSX, TSX, Vue, or Svelte file."
   - Empty (0 bytes) → "File is empty. Nothing to review."
   - Very large (>3000 lines) → Warn: "Large file (N lines). The loop may hit context limits. Consider reviewing a single component instead."

2. --domain FLAG: Validate against known presets
   - Unrecognized → "Unknown domain '[value]'. Valid options: motorcycle, fitness, finance, ecommerce, medical, default. Using 'default'."

3. --max-iterations: Validate numeric 1-30
   - Invalid → "Invalid max-iterations value. Using default (10)."

4. EXISTING PROGRESS: Check for design-review-progress.md
   - Found → "Found existing progress (iteration N/4). Resume or restart?"
```

### Agent Failure Recovery

```markdown
## Agent Failure Handling

- TIMEOUT: Skip the failed agent, log to progress file: "Agent X timed out — proceeding with Agent Y's findings only."
- EMPTY OUTPUT: Treat as if agent found no issues. Log: "Agent X returned no findings."
- CONTEXT EXHAUSTION: If context is running low, skip remaining iterations and output progress so far.
- NEVER retry a failed agent in the same iteration — it will likely fail again for the same reason.
```

## Implementation Phases

### Phase 1: Infrastructure & Metadata

**Files to create/modify:**

| File | Lines | Content |
|------|-------|---------|
| `CLAUDE.md` | ~60 | Plugin purpose, version sync locations (plugin.json + marketplace.json + CHANGELOG.md), pre-commit checklist, testing workflow |
| `LICENSE` | standard | MIT license text |
| `.gitignore` | ~10 | `.DS_Store`, `node_modules/`, `.claude/worktrees/` |
| `CHANGELOG.md` | ~30 | v1.0.0 (initial) and v2.0.0 (this upgrade) |
| `plugin.json` | fix | email → `kanuchandrej@gmail.com`, version → `2.0.0` |
| `marketplace.json` | fix | version → `2.0.0` |

### Phase 2: Reference Files

Extract domain knowledge into modular reference files. Following the Impeccable pattern: reference files are encyclopedic knowledge; skill files are opinionated workflows.

| File | Lines | Content |
|------|-------|---------|
| `reference/domain-experts.md` | ~250 | Full persona for each domain. Structure per persona: Background, Evaluation criteria (10+ questions), Domain vocabulary, Love vs. complain, Competitor comparison |
| `reference/agent-roles.md` | ~200 | Detailed role definition for all 8 agents. Structure per agent: Mission statement (one sentence), What it combines, Evaluation checklist (10+ items), Output format, DO/DON'T list |
| `reference/critique-framework.md` | ~100 | 10-dimension scoring framework with 1-5 scales + pass/fail gates. Tables for quick reference. "Non-obvious" callouts. |
| `reference/accessibility-checklist.md` | ~80 | WCAG AA checklist: contrast ratios, focus states, ARIA, keyboard nav, touch targets, motion preferences, color-not-sole-indicator |

**Skill Authoring Pattern (from Impeccable analysis):**
- No frontmatter on reference files — pure content
- Tables for quick-reference data
- "Non-obvious" callouts for expert knowledge
- Single-line "Avoid" footer per section
- Keep at one level deep from SKILL.md (no chaining)

### Phase 3: Rewrite design-loop SKILL.md

The most critical file. Must follow the Impeccable structural pattern:

```
Frontmatter (name, description, user-invokable, args)
↓
Opening line (one authoritative sentence — the mission)
↓
H2: Prerequisites & Validation
H2: Context Gathering (NEW — the platform/theme/scope questions)
H2: Iteration 1: DIAGNOSE
  → Agent prompts (30-50 lines each, concrete checklist)
  → Synthesis Protocol
H2: Iteration 2: FOUNDATIONS
  → Agent prompts
  → Synthesis Protocol
H2: Iteration 3: ENHANCE
  → Agent prompts
  → Synthesis Protocol
H2: Iteration 4: SHIP
  → Agent prompts
  → Synthesis Protocol
H2: NEVER (anti-patterns with reasons)
H2: Verify & Complete
↓
Closing one-liner
```

**Agent prompt template (each agent gets this structure):**
```markdown
### Agent: [Name]

Launch this agent with the Agent tool:

> You are a [ROLE] reviewing a [PLATFORM] [THEME] [SCOPE] for a [DOMAIN] application.
> Read [FILE] and evaluate:
>
> 1. [Specific criterion with measurable outcome]
> 2. [Specific criterion]
> ...
> 10. [Specific criterion]
>
> **Output format:**
> For each finding:
> - **Severity**: critical / major / minor
> - **Element**: exact CSS selector or line reference
> - **Current**: what it is now
> - **Recommended**: what it should be (with code)
> - **Why**: impact on the user
>
> **DO**: [3-4 principles]
> **DON'T**: [3-4 specific anti-patterns]
>
> Do NOT edit the file. Output findings only.
```

**NEVER section:**
```markdown
## NEVER

- NEVER spawn more than 2 agents simultaneously — Claude Code has practical limits on concurrent subagents. Two is reliable; three is risky; four will timeout.
- NEVER edit the file from a research-only agent — conflicting edits corrupt the file. Only the orchestrator applies fixes during synthesis.
- NEVER skip the synthesis step — applying Agent A's fixes without checking Agent B's contradictions produces inconsistent results.
- NEVER run /delight before /distill — adding personality to a cluttered interface makes it worse, not better. Subtract first.
- NEVER run design-loop on a file with uncommitted git changes — the auto-apply mechanism has no rollback. Git is your safety net.
- NEVER use generic prompts like "You are a UI designer" — always include the DESIGN_CONTEXT (platform, theme, scope, domain) so the agent gives relevant advice.
- NEVER force the completion promise if agents failed — report partial progress honestly.
```

**Target: 450-500 lines** (under the 500-line recommendation, with deep content in reference files)

### Phase 4: Rewrite design-brainstorm SKILL.md

Parameterize all prompts using the same DESIGN_CONTEXT pattern. Add synthesis framework.

**Key changes:**
1. Replace "mobile dark-theme interfaces" with `[PLATFORM] [THEME] [SCOPE]`
2. Add context detection (read file, infer platform/theme, confirm with user)
3. Add synthesis output template:
   ```
   ## Brainstorm Synthesis
   ### Consensus Issues (flagged by 2+ agents)
   | # | Issue | Agents | Impact | Suggested Fix |
   ### Disagreements
   | # | Topic | Agent A says | Agent B says | Recommendation |
   ### Top 5 Priorities
   ### Next Step: Run /design-loop for the full treatment
   ```
4. Cross-skill reference to `/design-loop`
5. Add `user-invokable: true` to frontmatter

**Target: 150+ lines**

### Phase 5: Implement design-status SKILL.md

Must parse the progress file schema defined in this plan.

**Key functionality:**
```markdown
1. Find design-review-progress.md in current directory or project root
2. If not found → "No active design loop found. Start one with /design-loop <file>"
3. If found, parse and display:
   - Phase: "Phase 2 of 4: FOUNDATIONS"
   - Progress bar: "████░░░░ 45% (8/19 commands)"
   - Completed commands with checkmarks
   - Remaining commands
   - Last applied fixes (from most recent iteration)
   - Time estimate: "~2 iterations remaining"
4. If status=complete → "Design loop complete! All 19 commands finished."
```

**Target: 100+ lines**

### Phase 6: Expand README.md

| Section | Content |
|---------|---------|
| Header | Name, one-line description, badges (version, license) |
| Install | `claude plugin install`, local testing, project-scope |
| Quick Start | Full command example with expected output |
| Commands | Table of all 3 skills with descriptions and examples |
| How It Works | ASCII flow diagram, 4-iteration architecture, agent count |
| Context Gathering | Explain the platform/theme/scope/domain questions |
| Domain Presets | Table with all 6 domains and what each evaluates |
| Architecture | 8 agents listed with what Impeccable commands each covers |
| Dependencies | Works standalone; enhanced with Impeccable and Ralph Loop |
| Troubleshooting | Agent timeout, context limits, Impeccable not installed |
| Contributing | How to add domains, modify agents, test locally |
| Changelog | Link to CHANGELOG.md |
| License | MIT |

**Target: 200+ lines**

## Acceptance Criteria

### Functional Requirements
- [ ] `CLAUDE.md` exists with version sync locations and dev workflow
- [ ] `LICENSE` file exists (MIT)
- [ ] `.gitignore` exists
- [ ] `CHANGELOG.md` exists with v1.0.0 and v2.0.0 entries
- [ ] All metadata files use `kanuchandrej@gmail.com` and version `2.0.0`
- [ ] 4 reference files exist in `.claude/skills/design-loop/reference/`
- [ ] `design-loop/SKILL.md` has concrete agent prompts with `[PLATFORM]`/`[THEME]`/`[SCOPE]` placeholders
- [ ] `design-loop/SKILL.md` includes mandatory context gathering phase
- [ ] `design-loop/SKILL.md` includes auto-apply synthesis protocol
- [ ] `design-loop/SKILL.md` includes NEVER section with reasons
- [ ] `design-loop/SKILL.md` includes input validation
- [ ] `design-loop/SKILL.md` includes agent failure recovery
- [ ] `design-loop/SKILL.md` creates progress file in Step 0
- [ ] `design-brainstorm/SKILL.md` is parameterized (no hardcoded platform/theme)
- [ ] `design-brainstorm/SKILL.md` includes synthesis output template
- [ ] `design-status/SKILL.md` parses progress file and displays status
- [ ] All 3 skills have `user-invokable: true` in frontmatter
- [ ] Agent count is 8 across 4 iterations (2 per iteration)
- [ ] README.md has component table, troubleshooting, contributing guide

### Quality Gates
- [ ] Plugin loads: `claude --plugin-dir /path/to/compound-design-loop`
- [ ] All skills appear in `/help` output
- [ ] No hardcoded "mobile dark-theme" in any agent prompt
- [ ] Email is `kanuchandrej@gmail.com` in all files
- [ ] Version is `2.0.0` in all version-bearing files
- [ ] design-loop SKILL.md is under 500 lines (deep content in reference files)
- [ ] Every NEVER item has a "why" clause

## File Inventory (Final State)

```
compound-design-loop/
├── .claude-plugin/
│   ├── plugin.json                          # v2.0.0
│   └── marketplace.json                     # v2.0.0
├── .claude/skills/
│   ├── design-loop/
│   │   ├── SKILL.md                         # ~480 lines, 8 agents, context-aware
│   │   └── reference/
│   │       ├── domain-experts.md            # ~250 lines, 6 domain personas
│   │       ├── agent-roles.md               # ~200 lines, 8 agent definitions
│   │       ├── critique-framework.md        # ~100 lines, 10-dimension scoring
│   │       └── accessibility-checklist.md   # ~80 lines, WCAG AA checklist
│   ├── design-brainstorm/
│   │   └── SKILL.md                         # ~150 lines, parameterized
│   └── design-status/
│       └── SKILL.md                         # ~100 lines, real progress parsing
├── CLAUDE.md                                # ~60 lines, dev workflow
├── CHANGELOG.md                             # ~30 lines, semantic versioning
├── README.md                                # ~220 lines, comprehensive
├── LICENSE                                  # MIT
└── .gitignore                               # ~10 lines
```

**Estimated total lines:** ~1,680 (up from 510, 3.3x increase)

## Phase Dependencies

```
Phase 1 (Infrastructure) → no dependencies, do first
Phase 2 (Reference files) → no dependencies, can parallel with Phase 1
Phase 3 (design-loop) → depends on Phase 2 (references must exist to link)
Phase 4 (design-brainstorm) → depends on Phase 2 (domain presets in reference)
Phase 5 (design-status) → depends on Phase 3 (progress file schema defined there)
Phase 6 (README) → depends on Phases 3-5 (must document final architecture)
```

**Safe parallel groups:**
- Group A (parallel): Phase 1 + Phase 2
- Group B (parallel after A): Phase 3 + Phase 4
- Group C (after B): Phase 5
- Group D (after C): Phase 6

## Sources & References

- **Skill authoring best practices:** Claude Code docs, Anthropic skills repo, community guides (2025-2026)
- **Impeccable plugin (v1.3.0):** Skill depth patterns, reference file structure, frontmatter conventions
- **Compound Engineering plugin (v2.40.0):** Agent orchestration, workflow skills, multi-phase patterns
- **Spec-flow analysis:** 12 gap categories, 12 critical questions, 10 recommended next steps
- **User feedback:** Context gathering requirement, generic prompts fail across platforms, email fix
- **Institutional learning:** `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` — synchronization between parallel phases
