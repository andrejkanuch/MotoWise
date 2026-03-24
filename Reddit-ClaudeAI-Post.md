# r/ClaudeAI Post — DRAFT

---

## HOW TO POST THIS ON REDDIT

1. Go to r/ClaudeAI → Create Post
2. Select the most relevant flair (look for "Showcase", "Project", or "Claude Code" — pick whatever fits best from the dropdown)
3. Use one of the titles below
4. Paste the post body
5. Immediately post the **prepared follow-up comments** as separate replies to your own post to seed discussion

**Before posting:** Have the video from the r/expo post ready (YouTube unlisted link or direct upload). Also make sure you've commented genuinely on 2-3 other r/ClaudeAI posts in the days before this goes live.

**When to post:** Wednesday–Thursday, 9–11 AM EST

---

## TITLE (pick one):

**Option A:** Compound engineering is the most underrated workflow for Claude Code. Shipped a full app in 5 days — here's the system.

**Option B:** How I used compound engineering to ship a full mobile app in 5 days with Claude Code. Zero lines of code typed by me.

**Option C:** The biggest productivity unlock I found with Claude Code isn't prompting — it's compound engineering. Here's how it works.

---

## POST BODY:

I've been using Claude Code full time for a few months and the single biggest thing that changed my output wasn't better prompts or model upgrades. It was changing how I structure work.

The concept is called [compound engineering](https://every.to/guides/compound-engineering). Plan → Build → Review → Compound → Repeat. Every unit of work makes the next one easier. Not in a vague "you get better over time" way — I mean literally. Each cycle feeds concrete learnings back into the system so the next cycle starts from a higher baseline.

I tested this by giving myself a challenge — build and ship a full mobile app in the shortest time possible. No shortcuts on quality, real users, App Store ready. Did it in 5 days. Zero lines of code typed by me. I was the architect and reviewer, Claude did the writing.

The app is [MotoVault](https://motovault.app/) — motorcycle maintenance tracker with AI diagnostics. I ride as a hobby, my bike broke down on a trip, I was standing there googling symptoms getting nowhere. That bugged me enough to build this.

**What compounding actually looks like in practice**

What works for me is starting with the database and backend. Not touching a single screen file until I have a clear picture of how the data looks, how the API is shaped, how things connect. Database schema, GraphQL types, Zod validation, RLS policies — all of that first. I spent serious time on this and it's where most of the compounding starts.

Because once that foundation is solid and you move to frontend, you're not guessing. The AI has a clear contract to work against. It knows what the API returns, what the types look like, what relationships exist. First screen still took a while because Claude was learning my patterns. But by the tenth screen it basically knew what I wanted — it had nine screens worth of conventions to reference. Less correction, fewer hallucinations, way faster output.

That's what compounding feels like. The early work is slow. You're setting things up, correcting a lot, building the CLAUDE.md with conventions. Then at some point it shifts and every new thing you build comes out closer to right on the first try. Same model, same me. The only thing that changed was the accumulated context.

**Compounding applied to design — the plugin**

I'll be honest — I'm lazy when it comes to design. I can tell when something looks off but I don't have the vocabulary to fix it properly. One day I came across [Impeccable](https://impeccable.style/) and it clicked — the idea of giving AI actual design skills through structured commands. Really cool project. But I wanted something that fit the compound engineering loop, not individual commands.

So I built a Claude Code plugin — [Design Lenses](https://github.com/andrejkanuch/design-lenses). It runs 8 specialized AI agents across 4 rounds on any UI file:

1. **DIAGNOSE** — Design Critic + Domain Expert assess visual hierarchy, accessibility, contrast, domain usability. No edits, just analysis.
2. **FOUNDATIONS** — Design System Agent + Copy Agent review spacing, typography, color tokens, labels, tone.
3. **ENHANCE** — Motion Agent + Resilience Agent evaluate animations, edge cases, text overflow, responsive behavior.
4. **SHIP** — Polish Agent + Bolder Agent handle pixel alignment, performance, signature design touches.

Between each round an orchestrator synthesizes findings by consensus and applies approved fixes. Each round builds on what the previous round found — that's the compound part. Round 2 doesn't repeat round 1, it uses round 1's findings as context.

The jump from before to after on each screen was honestly surprising. Stuff I would've shipped with in a normal project got caught — inconsistent padding, empty states that just showed a blank screen, button copy that was technically correct but felt wrong, missing haptic feedback, animations that were either too slow or too fast.

**The honest part**

I'm a software engineer. I've shipped mobile apps professionally. I know Expo, React Native, NestJS, GraphQL from my day job. This is my stack.

Even with all that — Claude gives you confidently wrong answers all the time. Code that looks correct, follows your patterns, reads clean. And it's wrong. Wrong assumptions about your data model, API calls with params that look right but aren't what your endpoint expects, edge cases completely ignored while the happy path is perfect.

If I didn't already know what correct looks like I'd have shipped a polished-looking broken app. Compound engineering helps because each review cycle catches more — but it doesn't replace knowing your craft. The AI is an incredible accelerator. It's not a replacement for understanding what you're building.

**The compound engineering checklist I used**

For anyone who wants to try this approach:

- Solid CLAUDE.md with all your conventions, naming patterns, architecture decisions
- Backend and data models first. Lock the contract before building screens
- Review every AI output like you're reviewing a junior's PR — especially the stuff that looks correct
- Feed learnings back after each session. When Claude gets something wrong, document the convention so it doesn't repeat
- Use patterns, not one-offs. Every screen should follow the same structure so compounding has something to build on
- Track what the AI gets wrong. You'll start seeing the same types of hallucinations and can proactively prevent them

**The plugin is MIT licensed and free.** Install:
```
claude plugin marketplace add andrejkanuch/design-lenses
claude plugin install design-lenses@design-lenses
```

Main command: `/design-lenses:design-loop <file> --domain=<domain>`

Has domain presets for motorcycle, fitness, finance, ecommerce, medical — or just use default. Also has a quick mode (`/design-lenses:design-brainstorm`) that runs 3 agents if you don't want the full loop.

Happy to answer questions about the workflow, the plugin, or what 5 days of full-time compound engineering with Claude Code actually looks like.

---

## Prepared follow-up comments:

**"what's the difference between this and just prompting better?"**
> Prompting better improves a single interaction. Compound engineering improves every interaction after the first one. The idea is that you're building a system — CLAUDE.md conventions, established patterns, type contracts — that accumulates knowledge. By day 3 I wasn't writing better prompts, I was writing the same prompts but against a way richer context. The model just knew more about my project and produced better output without me asking differently.

**"how does the design plugin compare to just asking Claude to review UI?"**
> The difference is structure and compounding. When you ask Claude to "review this UI" you get a wall of suggestions with no prioritization. Design Lenses runs 8 agents that each look through a specific lens — one only cares about motion, another only about copy, another about edge cases. Then the orchestrator synthesizes by consensus. If 3 agents flag the same issue it gets prioritized. And each round builds on the last, so you get compounding within a single file review too.

**"5 days sounds like BS"**
> Fair. Context — I already know Expo, React Native, NestJS, Supabase from my day job. Didn't learn a single new technology. Zero time spent choosing a stack. The compound approach meant day 5 was wildly faster than day 1 because all the patterns, types, conventions were established. It's 5 intense full days. Not 5 casual afternoons. And "zero code written" means I didn't type implementation — I still made every architecture decision, reviewed every line, designed the data model, caught hallucinations constantly.

**"what goes in your CLAUDE.md?"**
> Everything the AI needs to maintain consistency. Naming conventions (snake_case in DB, camelCase in TS), architecture rules (types flow from packages/ to apps/, never the reverse), auth patterns (which Supabase client to use when), port assignments, file naming conventions, what NOT to do. I also add learnings as I go — when Claude makes a mistake, I document the correct pattern so it doesn't repeat. By day 5 the CLAUDE.md was basically a full onboarding doc for the project.

**"what was the hardest AI hallucination to catch?"**
> The subtle data model ones. Claude would generate a query assuming a relationship between tables that didn't exist in my schema, but the code looked perfectly reasonable. Or it would use a field name that seemed right but was slightly different from what Supabase actually had. These compile fine, pass linting, look correct in review — and then silently return empty data at runtime. That's the dangerous kind. The obvious failures are easy. It's the ones that look right that get you.

**"does the plugin actually edit your files?"**
> The agents are research-only — they analyze and report findings but don't touch your code. Only the orchestrator makes edits after synthesizing across all agents. It generates a progress markdown tracking every change with reasoning, so you can review exactly what happened. You can also run with `--no-apply` or `--dry-run` if you want analysis without edits.

**"can I apply compound engineering to non-frontend work?"**
> That's actually where it started for me. The backend was the first thing I built this way — each resolver built on patterns from the last one, each migration built on the schema conventions already established. By the time I got to frontend the whole system was already compounding. The design plugin is just one application of the same idea. You could apply this to tests, API design, documentation — anything where consistency matters and previous work informs future work.

**"what's the most underrated part of this workflow?"**
> The CLAUDE.md maintenance. People create it once and forget about it. I was updating mine after almost every session — new conventions discovered, mistakes to avoid, patterns that worked well. That file IS the compound interest. Without it you're starting fresh every session and the compounding breaks down. Treat it like a living document, not a config file.
