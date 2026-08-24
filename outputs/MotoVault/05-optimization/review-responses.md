# MotoVault — reviews and ratings playbook

**Rewritten 2026-08-24.** Supersedes the 2026-07-22 version entirely.
Tone: direct, rider-to-rider, signed by a person. Never defensive, never corporate.
SLA: 1–2★ **< 4h** · 3★ **< 24h** · 4–5★ **< 72h**.

---

## What was struck, and why

The previous version's **PRIORITY #1 was "reply to the existing US 2★"**, with
three drafted variants. **That action is impossible and has been removed.**

The US 2★ is a **star-only rating with no review text**. Apple exposes a developer
response only for *reviews* — a rating submitted without written content has
nothing to attach a response to, and no ASC surface or API endpoint offers one.
`asc reviews --app 6760291360` returns three records; none of them is the US
rating, because a bare rating is not a review. Any plan item that says "reply to
the 2★" is not a task that can be completed and should be struck wherever it
appears (it is `A1` in `00-MASTER-ACTION-PLAN.md`).

**The only lever on the US storefront is generating new US ratings.** With one
rating, one bad rating is the whole displayed average. With five, a 2★ costs
about half a star. That is the entire strategy, and it is the playbook below.

---

## Where trust actually stands (2026-08-24)

Authoritative source — note `--all`, which is what the earlier audit missed:

```bash
asc reviews ratings --app 6760291360 --all
```

**7 ratings, average 4.43, across 6 countries:** SK 2@5★ · BE 1@5★ · MK 1@5★ ·
CL 1@5★ · DE 1@4★ · **US 1@2★**.

The earlier "1 rating, US 2★, zero elsewhere" reading was an artifact of querying
only the 8 localized storefronts. Every positive rating lives in a storefront
nobody was checking. The app is not trust-less globally — it is trust-less **in
the US, which supplies 40% of impressions.**

**Written reviews: three, all 5★, all answered 2026-08-24** (state
`PENDING_PUBLISH`): SVK `ch8659` "Best app for every motorcycle rider" (2026-05-22),
CHL `Moqueca19` "Reseña" (2026-05-31), BEL `ing.roman` "Nice app with great
potential" (2026-08-10). The queue is at zero. The Belgian reviewer had
specifically praised "the developer who is actively responding" while having no
reply on file — that is the cost of letting the queue sit.

**Google Play: zero reviews, and no star rating displayed at all.** The page shows
"100+ Downloads", which is below Play's threshold for surfacing a rating. Play is
not a low-rating problem; it is a blank slate, and a blank slate is a different
and easier problem.

---

## Support address — decided

**`support@motovault.app` is canonical.** Owner decision, 2026-08-24. Every
template below uses it literally; do not reintroduce a second address.

It won on consistency: the privacy policy and the web footer already use it, and
the three review replies posted 2026-08-24 use it, so `support@` is already the
address in public. Two follow-ups are still open in code and store config:

| Place | Current | Action |
|---|---|---|
| `apps/mobile/src/lib/store-review.ts:25` (`FEEDBACK_EMAIL`) | `hello@motovault.app` | **change to `support@motovault.app`** — this is where every unhappy soft-ask responder is sent |
| App Store support URL | verify | **point at `support@motovault.app`** |
| Privacy policy | `support@` | no change |
| Web footer | `support@` | no change |

Both open items are code/config changes with no metadata delta, so they can ship
inside a read window. Do them in the R1 build if it has not been submitted yet;
otherwise R2. Until `store-review.ts` is changed, an unhappy rider is routed to an
address the store copy no longer advertises — keep `hello@` alive as an alias
until then, and afterwards.

---

## The rating-generation playbook

This is the part that matters. Replies are hygiene; rating volume is the outcome.

### The mechanism, as actually implemented

`apps/mobile/src/lib/store-review.ts` — a soft-ask gate in front of Apple's
native dialog. Happy riders reach the native prompt; unhappy riders get routed to
private email instead of a public 1★. Gating, read from source:

- Fires only from a `REVIEW_MILESTONE` value-moment — 9 of them, led by
  `EXPENSE_LOGGED`, `MAINTENANCE_COMPLETED`, `RIDE_COMPLETED`. Never onboarding.
- `MIN_ACTIONS_BEFORE_REVIEW = 2` — never on a rider's first value-moment.
- **Once per app version**, and `REVIEWED_VERSION_KEY` is stamped at
  `store-review.ts:103` — *before* the alert renders at line 116 — so a dismissal
  without an answer still burns that version's single chance.
- The soft-ask is a **bare `Alert.alert`** (`store-review.ts:116`), not the themed
  confirm its own docstring describes. Verified against source 2026-08-24.
- No-ops where the native API is unavailable (Expo Go).

Events to watch in PostHog: `review_soft_ask_shown` → `review_soft_ask_positive`
/ `review_soft_ask_negative` → `review_prompted` → `review_feedback_opened`. Each
carries `action_count`, `app_version` and (when known) `milestone`.

### The blocker

The soft-ask merged `c5fb8253` on **2026-08-03**, five days *after* 3.18.0 went
live. `runtimeVersion` policy is `appVersion` and `app.config.ts` is at 3.19.1, so
OTA builds from `main` target the 3.19.1 runtime and cannot reach a 3.18.0 user —
which is every iOS user, because the App Store still serves 3.18.0.

**On iOS the soft-ask has delivered to zero users for three weeks. On Android it
has been live since 3.19.0 and has produced zero visible reviews.** Both halves
need action, and they are different actions:

1. **iOS: ship 3.19.1.** Nothing else. It is the critical path in `timeline.md`.
2. **Android: verify it fires at all.** 3.19.0 has been live with the soft-ask and
   Play still shows zero reviews. Either the prompt is not firing, or Play's
   in-app review API is silently rate-limiting, or the volume is simply too low to
   have produced one yet. Check `review_soft_ask_shown` counts on Android builds
   before assuming the third.

### The arithmetic to plan against

First-time installs run **1.24/day** (r6). Over 90 days that is ~110 new iOS
riders. Roughly two-thirds delete. Of those remaining, only ones who log two
value-moments see a soft-ask, only the ones who tap "yes" see the native dialog,
and only some of those complete a rating. Getting **five US ratings** out of that
funnel is a real target, not a soft one — the US is 40% of impressions but the
install split follows it only roughly.

This is why the once-per-version stamp is quietly helpful: **frequent releases
reset eligibility.** Three release trains in 90 days means a retained rider gets
three chances instead of one. Do not "fix" that behaviour.

### Levers, in order of expected return

1. **Ship 3.19.1** (unblocks everything above).
2. **Verify the Android path fires** — a store with zero reviews needs exactly one
   to cross into having social proof, and Play's display threshold makes the first
   handful worth more than the tenth.
3. **Replace the `Alert.alert` at `store-review.ts:116` with a designed sheet.** A
   system alert converts worse than a designed one, and this is the only step in
   the chain we fully control — Apple's native dialog is a black box, so
   soft-ask→`review_prompted` is the only conversion rate we can move.
4. **Ask known-happy riders directly.** Pro subscribers, riders with 20+ logged
   expenses, anyone who has emailed something nice. This does not depend on a
   release and it is the only lever that can target the US specifically.
5. **Do not loosen the gating.** A prior PostHog read established that rating
   volume is capped by the size of the active user base and by prompt→rating
   conversion, not by the gate being too tight. Loosening it burns Apple's ~3
   shows/year cap on low-intent moments.

**What not to do:** never incentivise, never gate content on a rating, never
deep-link straight to the write-review page bypassing the OS dialog. All three
are App Store guideline violations and all three are how a 4.4 average becomes a
takedown.

---

## Templates

Reply in the reviewer's storefront language — machine-translate, then read it for
tone. Signed "Andrej" because a solo-built app signing as "The Team" reads false.

### 1–2★ · a real bug (reply < 4h)

```
Thanks for flagging this, [name] — and sorry MotoVault dropped the ball. I'd
rather know than not. [What's actually happening / what I've found]. It's fixed
in [version] / I'm on it now. If you email support@motovault.app with your phone and
bike I can reproduce it faster. I'll come back here when the fix is out.
— Andrej, MotoVault
```

### 1–2★ · data or sync worry (reply < 4h)

```
Let's not lose anything, [name]. Everything you log is on your account, so
signing in on any device brings it back. If something's genuinely missing, email
support@motovault.app now and I'll look at your account myself today.
— Andrej, MotoVault
```

### 1–2★ · billing or paywall (reply < 4h)

```
Sorry for the billing trouble, [name]. To be clear about where the line is:
logging expenses and maintenance is free, always — Pro adds extras on top and
never takes that away. Subscriptions are managed in your Apple ID settings, and
I'll help sort any charge. support@motovault.app reaches me directly.
— Andrej, MotoVault
```

### 1–2★ · hit a free-tier limit they didn't expect

Real and likely: free tier allows **one bike**, **one AI diagnostic per month**,
**three receipt scans per month**. Never claim otherwise, and never pretend the
limit is a bug.

```
Fair hit, [name] — that's a limit, not a bug, and I should have made it clearer
before you ran into it. On the free tier it's one bike, and logging expenses and
services on it is unlimited and free forever. Pro opens the garage up. If the
limit is the wrong shape for how you ride, tell me at support@motovault.app — that's
genuinely how I decide where it sits.
— Andrej, MotoVault
```

### 1–2★ · vague, no detail (reply < 4h, stay gracious)

```
Sorry it didn't click, [name]. If anything specific went wrong I'd like to fix
it — support@motovault.app reaches me directly. Either way, thanks for trying it.
— Andrej, MotoVault
```

### 3★ · "good, but…" (reply < 24h)

```
Thanks, [name] — glad [the thing that works] is earning its keep. Point taken on
[the gripe]; it's on the list and I ship often. Tell me what would make it a five
and I'll tell you straight whether it's coming.
— Andrej, MotoVault
```

### 3★ · confusion or "how do I…" (reply < 24h)

```
Happy to help, [name]. For [the thing]: [one line of actual steps]. If that
wasn't obvious in the app then that's a UX gap and it's mine to close — thanks
for surfacing it. support@motovault.app if you want a hand.
— Andrej, MotoVault
```

### 4–5★ · general praise (reply < 72h)

```
This made my day, [name] — thanks for riding with MotoVault. If there's one
thing that'd make it better for you, I'm listening at support@motovault.app. Ride safe.
— Andrej, MotoVault
```

### 4–5★ · praise for a specific feature

```
Love that [expenses / service reminders / the ride log] is pulling its weight,
[name] — that's the part I obsess over. More coming. Thanks for the kind words.
— Andrej, MotoVault
```

### 4–5★ · "great potential" / asking for more

The most common shape of a good MotoVault review so far — the Belgian 5★ was
exactly this. Answer the *potential*, concretely.

```
Thanks, [name] — "potential" is fair, and here's where it's going: [one real
next thing]. You asking for [their thing] moves it up the list. support@motovault.app
if you want a heads-up when it lands.
— Andrej, MotoVault
```

### Feature request, any star count (reply < 24h)

```
Good call, [name]. [Feature] is [on the roadmap / something I'm weighing]. Riders
asking is how I prioritise, so this counts as a vote. support@motovault.app if you want
the detail.
— Andrej, MotoVault
```

### Competitor comparison

```
Fair comparison, [name]. Where MotoVault leans in is expenses and maintenance for
motorcycles specifically — not a car app with a bike mode bolted on. If there's
one thing from [app] you can't ride without, tell me at support@motovault.app and I'll
be honest about whether I'll build it.
— Andrej, MotoVault
```

### Any review naming a price

Never confirm or quote a figure in a reply. Localized listings serve many
territories and the number is wrong in most of them.

```
Fair to push on price, [name]. Logging your expenses and services is free
forever — no limits, no trial clock. Pro is what's on top of that, and the
current price for your region is on the subscription screen in the app. If it's
the wrong shape for you, say so at support@motovault.app; that feedback lands.
— Andrej, MotoVault
```

---

## Rules

1. Reply as a person. Sign "Andrej".
2. Restate the free promise whenever billing or paywalls come up — logging
   maintenance and expenses is free forever and never count-limited.
3. **Never state a price and never state a free-tier number you have not checked
   against `packages/types/src/constants/limits.ts`.** A reply is public metadata
   and the same accuracy rules apply.
4. One clear next step, one address. Never argue in public.
5. Reply in the storefront's language.
6. Log recurring themes. Three reviews naming the same gap jumps the roadmap —
   that is a signal worth more than the reviews themselves at this volume.
7. Never reference the review count or the average in a reply ("our 4.4 stars") —
   it dates instantly and reads as marketing.

---

## Escalation

| Severity | Examples | Reply | Also |
|---|---|---|---|
| Critical | data loss, billing error, crash on open | < 4h | hotfix or account check the same day; a code-only hotfix never contaminates a read window |
| High | feature-blocking bug, sync failure | < 24h | reproduce, patch in the next train |
| Standard | feature request, confusion, praise | < 24–72h | log the theme |

---

## Daily command

```bash
asc reviews --app 6760291360 --only-unresponded --sort -createdDate
asc reviews respond --review-id "<REVIEW_ID>" --response "…"
```

Ratings need no ASC call and no rate-limit budget:

```bash
curl -s "https://itunes.apple.com/lookup?id=6760291360&country=us" \
  | python3 -c "import json,sys;d=json.load(sys.stdin)['results'][0];print(d['averageUserRating'],d['userRatingCount'])"
```

Watch `us` specifically. It is 40% of impressions and it is the only storefront
where the trust problem is real.
