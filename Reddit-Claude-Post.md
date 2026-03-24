# r/claude Post — DRAFT

---

## ⚠️ IMPORTANT: r/claude vs r/ClaudeAI

These are DIFFERENT subreddits with different rules.

**r/claude** — strict Rule 2: "Only tools or projects built for Claude specifically. If it just uses Claude or was built with Claude Code, that isn't enough to qualify."

This post is 100% about the Design Lenses plugin. Do NOT mention MotoVault by name or link to it. The app is only referenced vaguely as "a project" to explain why you built the plugin. The plugin IS a Claude-specific tool — it only runs on Claude Code. That's what makes this compliant.

**When to post:** A few days after the r/ClaudeAI post. Don't post both the same week.

---

## TITLE (pick one):

**Option A:** I built an open source Claude Code plugin that runs 8 AI agents on your UI files. Here's how it works.

**Option B:** Open source Claude Code plugin — 8 specialized design agents review your UI across 4 rounds. Free, MIT licensed.

**Option C:** Made a Claude Code plugin that gives your UI files a systematic design review. 8 agents, 4 rounds, open source.

---

## POST BODY:

I've been using Claude Code as my main dev tool for a while now and one thing kept bothering me — the UI it produces is functional but not polished. It follows patterns, it works, but every screen ships with the same kinds of problems. Spacing inconsistencies, missing empty states, copy that reads like a machine wrote it, no loading states, animation timing that feels off.

I kept catching the same issues manually on every screen. So I built a plugin to do it systematically.

**Design Lenses** — [github.com/andrejkanuch/design-lenses](https://github.com/andrejkanuch/design-lenses)

It's a Claude Code plugin that runs 8 specialized AI agents across 4 rounds on any UI file (JSX, TSX, HTML, Vue, Svelte):

1. **DIAGNOSE** — Design Critic + Domain Expert assess visual hierarchy, accessibility, contrast, domain-specific usability. No edits, just analysis.
2. **FOUNDATIONS** — Design System Agent + Copy Agent review spacing, typography, color tokens, labels, messaging tone.
3. **ENHANCE** — Motion Agent + Resilience Agent evaluate animations, edge cases, text overflow, responsive behavior.
4. **SHIP** — Polish Agent + Bolder Agent handle pixel alignment, performance, and signature design touches.

Between each round an orchestrator synthesizes findings by consensus level — if multiple agents flag the same issue it gets prioritized over single-agent suggestions. All agents are research-only. Only the orchestrator touches your files.

**Why a multi-round loop instead of single-pass review**

If you ask Claude to "review this UI" you get a wall of suggestions with no prioritization and no systematic coverage. It tries to look at everything at once and the output is messy.

The idea behind Design Lenses is that good design review isn't one big pass — it's multiple focused passes through different lenses. The Motion Agent doesn't care about typography. The Copy Agent doesn't care about animations. Each one goes deep on its thing, and the orchestrator figures out what actually matters based on consensus.

The compound part is key too. Round 2 doesn't just repeat round 1 — it uses round 1's findings as context. So by round 4 the agents are working with a much richer understanding of the file. Each round builds on the last.

**The origin story**

I'll be honest — I'm lazy when it comes to design. I know when something looks wrong but I don't have the design vocabulary to ask for specific fixes. I came across [Impeccable](https://impeccable.style/) and loved the concept — giving AI actual design expertise through structured commands. Really cool project.

But I wanted something that runs as a full loop, not individual commands. I was using [compound engineering](https://every.to/guides/compound-engineering) for my coding workflow — plan, build, review, feed learnings back, repeat — and I wanted the same thing for design. So I built Design Lenses as a multi-agent compound loop specifically for Claude Code.

**What it actually catches**

Some examples from real usage:

- Inconsistent padding between similar components that looks fine at a glance
- Empty states that just show a blank screen instead of helpful messaging
- Button copy that's technically accurate but feels robotic
- Missing haptic feedback on iOS interactive elements
- Animations that are either too slow (feels laggy) or too fast (feels jarring)
- Touch targets that are too small for the domain context (the plugin has domain presets — motorcycle, fitness, finance, etc. — and adapts its review accordingly)
- Contrast ratios below WCAG standards that pass a casual visual check

Most of this stuff I would've shipped with. Not because it's hard to fix but because I wouldn't have noticed it in a manual review.

**Install and usage**

MIT licensed, free. Install:
```
claude plugin marketplace add andrejkanuch/design-lenses
claude plugin install design-lenses@design-lenses
```

Main command:
```
/design-lenses:design-loop <file> --domain=<domain>
```

Domain presets: motorcycle, fitness, finance, ecommerce, medical, or default. Takes 5-10 minutes per file depending on complexity. Generates a `design-review-progress.md` tracking every modification with reasoning.

There's also a quick mode — `/design-lenses:design-brainstorm` — that runs 3 agents instead of the full 8 if you just want a fast review.

Happy to answer questions about how it works or take suggestions for improvements.

---

## Prepared follow-up comments:

**"how does this differ from Impeccable?"**
> Different approaches to the same problem. Impeccable gives you individual commands (`/polish`, `/audit`, `/typeset`) that you run on demand — really well crafted, great design vocabulary. Design Lenses runs a full pipeline automatically — 8 agents across 4 rounds where each round builds on the previous one's findings. Think of Impeccable as a design toolkit and Design Lenses as an automated design review pipeline. Both valid, depends on whether you want control over individual passes or want a one-command full review.

**"does it actually edit your files or just suggest?"**
> Both, your choice. By default the orchestrator applies approved fixes after synthesizing agent findings. But you can run with `--no-apply` or `--dry-run` to get the analysis without any edits. It always generates a progress markdown tracking what changed and why, so nothing is a black box.

**"why Claude Code specifically? could this work with Cursor or other tools?"**
> Built it as a Claude Code plugin because that's my main tool and the plugin system makes it straightforward to orchestrate multi-agent workflows. The underlying concept — multiple specialized agents doing focused reviews in rounds — could work anywhere, but the implementation uses Claude Code's plugin architecture. If someone wanted to port it I'd be happy to help.

**"8 agents sounds expensive, how much does a full run cost?"**
> Depends on file size but typically a full 4-round loop on a standard screen file runs 5-10 minutes and uses roughly what you'd spend on a few back-and-forth Claude Code conversations. Not free, but not crazy either. The brainstorm mode (`/design-lenses:design-brainstorm`) uses only 3 agents if you want a cheaper quick pass.

**"what domain presets are available and how do they work?"**
> Six presets right now: motorcycle, fitness, finance, ecommerce, medical, and default. The domain parameterizes all agent prompts — so a motorcycle domain knows riders might wear gloves (larger touch targets), a medical domain is stricter on accessibility, finance cares more about data density and readability. You can also just use default and it works fine for general apps.

**"is the consensus mechanism actually useful or just overhead?"**
> It's the most important part honestly. Without it you get 8 agents each producing a list of suggestions and no way to tell what matters. The consensus mechanism means if 3+ agents independently flag the same spacing issue, that gets CONSENSUS priority and gets fixed first. A single agent flagging a minor nitpick stays as SINGLE-MINOR and might not get applied at all. It filters the noise massively.
