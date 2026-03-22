# r/expo Post Draft

---

## Title Options (pick one):

**Option A:** I challenged myself to ship a full Expo 54 app as fast as possible. 5 days, zero lines of code written by me.

**Option B:** 5 days. Zero lines of code typed by me. Shipped a full Expo 54 app. Here's the honest version.

**Option C:** Gave myself a challenge — ship a real Expo app in the shortest time possible. Did it in 5 days without writing a single line of code.

---

## Post:

So I gave myself a challenge — build and ship a full mobile app in the shortest time possible. No shortcuts on quality, real app, real users, App Store ready. I just wanted to see how fast it can be done in 2026 with AI.

Ended up doing it in 5 days. Actual dev time, not counting Apple review. And I didn't write a single line of code myself.

Before anyone thinks I'm flexing or exaggerating — I'm a software engineer, I've shipped mobile apps professionally before, I know Expo and React Native well. I'm not new to this. The difference is I didn't type the code. I directed everything — architecture, data models, code review, every product decision. The AI did the writing. I was more like a tech lead than a developer if that makes sense.

The app is [MotoVault](https://motovault.app/) — motorcycle maintenance tracker with AI diagnostics. I ride as a hobby but I'm honestly clueless about the mechanical side. My bike broke down on a trip, I was standing there googling symptoms getting nowhere. That annoyed me enough to build this.

**The approach — compound engineering**

I used [compound engineering](https://every.to/guides/compound-engineering). Basically every piece of work makes the next one easier. Plan, build, review, feed learnings back, repeat. Each cycle compounds on the last.

The thing that mattered most for me: **nail your backend and database first before you open a single screen file.** I spent serious time on data models, API shape, relationships, how everything connects. Once that was solid, frontend was mostly fitting pieces together. Screen 1 took ages. By screen 10 the AI basically knew what I wanted.

Tech stack — no deliberation at all. Picked what I know from work and trust. Expo 54 (RN 0.81, React 19), NestJS 11 with GraphQL code-first, Supabase for DB and auth, Turborepo monorepo, Next.js for the landing page, Claude AI for the whole workflow. Didn't spend a single minute going "hmm should I use X instead of Y." For a challenge like this that kind of decision fatigue would've eaten a whole day.

**For UI quality — compound design loop**

Built a Claude Code plugin for this — [compound design loop](https://github.com/andrejkanuch/design-lenses). Runs 8 AI agents across 4 rounds on each screen:

1. DIAGNOSE — critique + domain audit, no edits just analysis
2. FOUNDATIONS — design system + copy cleanup
3. ENHANCE — animations, edge cases, error states
4. SHIP — final polish

The jump from round 1 to round 4 on each screen was honestly surprising. It caught stuff I'd normally ship with — spacing issues, missing empty states, copy that reads weird, animation timing that feels off. Open source if you want to try it.

**What the app actually does**

Maintenance logging, expense tracking across multiple bikes, service reminders. The AI diagnostic flow asks you step by step about what's going on with your bike, cross-references your maintenance history, and gives you a starting point for what might be wrong. Plus learning content (50+ lessons, quizzes) and skill tracking.

**The thing nobody talks about with AI coding**

Ok here's something I want to be real about because I see too many "I built X with AI" posts that skip this part. **AI gives you confidently wrong answers all the time.** Like it'll generate something that looks completely fine, reads well, follows patterns — and it's just wrong. Wrong assumptions about your data model, wrong API calls, subtle logic bugs wrapped in clean code. The convincing part is what makes it dangerous. If you don't know what correct looks like you'll ship garbage and not even realize it.

This is exactly why my previous experience mattered so much. I caught stuff constantly. Things that looked great at first glance but were doing the wrong thing underneath. If I didn't already know how to build apps I'd have shipped a broken product that just happened to look nice. Anyone telling you AI replaces knowing your craft is selling you something.

**Takeaway**

The challenge was worth it. 5 days is real but only because I already knew the stack inside out, planned the backend first, and reviewed everything the AI produced like a hawk. Compound engineering made each day faster than the last — day 5 was probably 3-4x more productive than day 1.

If you know your tools well and you haven't tried working this way yet, give it a shot. But please — don't trust the AI output blindly. That's the trap.

If any of you ride — [motovault.app](https://motovault.app/). Would love feedback from people who are both devs and riders.

---

## Prepared follow-up comments:

**"what do you mean you didn't write code?"**
> I didn't type code into an editor. I architected everything, reviewed every line, made all the product and technical decisions. The AI wrote the actual code based on my direction. Think of it like being the tech lead who designed the system and reviews every PR but didn't write the implementation. Without my experience shipping apps this absolutely would not have worked — the AI needs someone who knows what right looks like.

**"5 days, come on"**
> 5 intense days yeah. But context — I already know Expo, RN, NestJS, Supabase from work. Didn't learn a single new technology. Zero time picking stack. The compound approach meant day 5 was wildly faster than day 1 because all the patterns were set. The challenge was mainly to see how fast compounding actually gets you there if you already have the skills. Turns out pretty fast.

**"how bad were the AI hallucinations?"**
> Bad enough that if I wasn't reviewing carefully I'd have shipped some embarrassing stuff. Mostly it's subtle — like it'll assume a relationship in your DB that doesn't exist, or generate an API call with params that look right but aren't what your endpoint expects. Or it'll handle a happy path perfectly and completely ignore edge cases. The code always looks clean and correct at first glance which is the problem. You really need to know what you're looking at.

**"tell me more about the compound design loop"**
> Open source — https://github.com/andrejkanuch/design-lenses. It's a Claude Code plugin. 8 specialized agents look at your screen from different angles (design system, copy, motion, resilience, etc) across 4 rounds. Orchestrator synthesizes between rounds. Works with JSX, TSX, HTML, Vue, Svelte. Built it because I kept shipping the same types of UI issues and wanted something systematic to catch them.

**"what about the AI diagnostics in the app?"**
> Uses Claude. Asks you step by step about symptoms — won't start, weird noise, power loss, whatever — and if you have maintenance history logged it uses that for context. It's not replacing a mechanic, just gives you a starting point so you don't show up at the shop sounding completely lost. For someone like me who can barely tell parts apart it's been genuinely useful.

**"why those technologies specifically?"**
> I just picked what I use at work. That's it. Expo because best DX for RN, NestJS because code-first GraphQL is fast to work with, Supabase because auth+DB with zero config. If I spent even half a day evaluating alternatives that's half a day wasted on a 5 day challenge. Speed over theoretical perfection.
