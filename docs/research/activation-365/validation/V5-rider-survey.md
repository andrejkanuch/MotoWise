# V5 — Hearing from riders who leave (survey prep, nothing sent)

> **Nothing here has been sent, scheduled or built.** Sending the email, or shipping the in-app card, needs the owner's explicit approval. The email below is a draft, and so is the card copy. No email address, name or message text was read into this file. Every database figure is an aggregate count.

Run 2026-11-12 on the clean checkout `a clean origin/main checkout` (HEAD `7e29f7c0`, origin/main). Read-only throughout:
- Supabase production through the Management API. Each query ran inside `BEGIN READ ONLY; … COMMIT;`.
- PostHog project 155556 through `execute-sql`.

## 0. Bottom line

1. **No one can be emailed under the current consent.** 21 riders in the 2026-08-14..11-04 cohort are inactive since day 1, still have an account and ticked the contact box. None of them has ever sent feedback (V5-A). The box says "The developer may contact me about my feedback" (`apps/mobile/src/i18n/locales/en.json:1627`). Without feedback there is nothing for it to cover. Read narrowly, the email pool is **0**. Read loosely, it is **21**. Either way, a realistic number of replies is **0–4**. Confidence: high on the counts; the consent reading is mine and is not legal advice.
2. **The in-app card is the channel that can actually produce answers.** About 19% of onboarding completers open the app again on a later day within 14 days (11/59, V5-P2). That is about 5 riders a week who could see a card shown on a later day. I expect **about 10–20 answers over 8 weeks**, which is enough to spot a dominant reason and not enough for exact shares. Confidence: medium. The answer rate is an assumption.
3. **The store-build-only rule drives the timing.** The card has to ship in a binary, and the board wants it shown to both Exp 1 arms equally. In practice it goes in **a store build released before 2026-12-15**, or it waits until after 2027-03-31.

## 1. Who could be emailed (task 1)

### Where consent is stored
- The only contact consent is `public.users.preferences.feedbackContact = {enabled, email, decidedAt, wordingVersion, locale, source}` (`packages/types/src/validators/feedback.ts:43-50`). It can be set in two places:
  - the onboarding notifications screen (`apps/mobile/src/app/(onboarding)/notifications.tsx:224-231`, label key `feedback.contactOptIn`);
  - the feedback form (`apps/api/src/modules/feedback/feedback.service.ts:153-185`, source `form`).
- No marketing-email consent exists. `seasonalTips` is a silent default and is not consent (board/04 F11, `board/04-lifecycle-crm.md:77-78`).
- The only way to withdraw is to send feedback again with the box unticked (`feedback.service.ts:168-180`). There is no stand-alone toggle, so an unsubscribe has to be honoured by hand (see §2).

### Counts (Supabase prod, read-only)

The cohort is sign-ups from 2026-08-14 to 2026-11-04. Excluded: `is_synthetic`, `@motovault.app`, `@priorises.com`, `cloudtestlabaccounts.com` and `test@test.com`. That leaves **443** sign-ups; board/04 had 445. I could not apply the q00 list of owner/junk emails because it is kept outside the repo. That explains the gap of 2.

| Query | Measure | Result |
|---|---|---|
| V5-A | sign-ups in cohort | 443 (17 deleted or scheduled for deletion) |
| V5-A | `feedbackContact.enabled = true` / `false` / absent | **22 / 0 / 421** |
| V5-A | no core action (ride ≥ 500 m, expense, completed task) on any day after sign-up day | 407 of 443 |
| V5-A | ticked and no core action on a later day | 22 |
| V5-B | stricter: ticked, and no ride, expense, task or bike **created** (or task completed) ≥ 1 day after sign-up | **21** |
| V5-A | ticked, inactive (strict, row-touch version), account live | **21** |
| V5-A | …of whom sent any feedback (`feedback_messages`) | **0** |
| V5-A | …Apple private-relay address (bounces unless motovault.app is registered as a Sign in with Apple email source) | 1 |
| V5-B | source of all 22 ticks; wording version | `onboarding` 22/22; `wordingVersion = 1` 22/22 |
| V5-B | sign-up dates of the 22; first `decidedAt` | 2026-10-14..11-03; 2026-10-14T03:23Z, so the box went live on 10-14 |
| V5-B | cohort sign-ups since 10-14 / of them ticked | 100 / 22 (22%) |
| V5-B | `feedback_messages` all time: messages / riders / with contact allowed | 3 / 3 / 1 (2026-10-13 .. 11-11) |
| V5-A | cohort riders who sent feedback | 1 (active, so not in the target group) |
| V5-B | live non-synthetic users anywhere with the box ticked / unticked | 34 / 0 |
| V5-C | the 21 by consent locale | **es 11, en 9, tr 1** |
| V5-C | the 21: has a live bike / any ride ≥ 500 m / any expense | 19 / 0 / 0 |
| V5-C | the 21 by first listed `ridingGoals` value | maintain_bike 9, track_rides 10, manage_expenses 1, other 1 |

Note on V5-A versus V5-B. The "row-touch" version also counts `updated_at` on bikes and tasks. Server jobs and backfills move `updated_at`, so that version marks only 203 of 443 as inactive. The created-only version (V5-B) gives 360 of 443. For the consent pool both versions give 21, so the gap does not matter here.

### Reading
- **Narrow reading, which I recommend and which board/04 Responses item 3 and board/99 §"No email…" also take:** the 21 agreed to replies *about their feedback*, and none of them sent any. Pool = **0**. [UNBACKED — own reading, not legal advice]
- **Loose reading, the owner's call:** "contact me about my feedback" covers a question that asks for feedback. Pool = **21**: 11 Spanish, 9 English, 1 Turkish. All 21 have zero rides and zero expenses, and 19 have a bike.
- **The 2026-10-12 outreach is not a precedent for this group.** It went to the 20 *most active* riders, before the checkbox existed (memory `project_rider_outreach_test_1012`). These 21 are inactive, and the only basis for contacting them is a checkbox with narrow wording. The 10-12 reply rate was never recorded in the memory file, so it cannot calibrate the estimate below.
- **A broader consent would need a new checkbox:** a separate, plainly worded "You may email me with questions about the app" (wording v2) with its own `source`. Per board/04 Responses item 3 (iii), it should come after the onboarding A/B, so that it does not change the notifications screen that both `onboarding_paywall_2026q4` arms share.

## 2. Draft email (task 2) — DRAFT, needs owner approval to send

Who it would go to: only the riders the owner decides the consent covers. It is sent by hand from support@motovault.app, one rider at a time, as on 10-12. No bulk tool, no tracking pixel, no link tracking.

Locales needed for the 21: **English and Spanish**. For the one Turkish rider, use English with a neutral "answer in your own language" line, following the owner's 10-12 rule of not revealing an inferred nationality. Do not machine-translate the Spanish version without a native read.

House style from the 10-12 outreach:
- name and bike only;
- no stats or dates about the rider;
- no call requests;
- no incentive (a gift card or free Pro would pull in answers from people who want the reward, and it would bias them toward pleasing us).

```
Subject: One quick question about MotoVault

Hi {first name},

I'm Andrej, I build MotoVault on my own. You set up {bike} in the app a few
weeks ago and ticked that I may contact you, so I wanted to ask you
directly. There is no right or wrong answer, and a one-line reply is plenty.

1. What did you hope MotoVault would do for you when you installed it?
2. What stopped you from using it after the first day? (Not riding right
   now, it didn't do what you needed, too much setup, something broke,
   anything at all.)

Your answer goes only to me and I'll use it to decide what to fix next.
I won't add you to any list.

You can answer in your own language.

If you'd rather not hear from me again, just reply "stop" and I won't
contact you again.

Thanks for giving it a try,
Andrej
MotoVault
```

Spanish lines: per the owner's 10-12 rule, Spanish speakers get "(Hablo español — puedes responder en español.)" at the top. Have a native speaker check the full Spanish version before sending.

GDPR and consent handling (my reading, not legal advice):
- **Purpose limitation.** Use replies only to improve the product. Don't paste reply text into PostHog. If the owner keeps a summary, it should hold categories only (§3 mapping), with no names or emails.
- **Withdrawal (GDPR Art. 7(3)).** On "stop", the owner adds the rider to a suppression note **and** (owner action, not done here) sets `preferences.feedbackContact.enabled = false`, so no later script picks them up. Today no screen lets a rider withdraw without sending feedback (§1). That is a small product gap to log, not to fix now.
- **Data minimisation.** Pull email addresses only at send time, by the owner, and never into a repo file. This document holds counts only.
- **Accuracy.** "a few weeks ago" stays vague on purpose (owner rule: no dates).

## 3. In-app "why did you install?" card (task 3, P05.3)

### When and where
- An inline card on Home, using theme tokens (check light and dark, per house rule `feedback_light_and_dark_required`).
- It is shown once, on the **first cold start on a calendar day after onboarding completion**. "Second app open" (P05.3) also counts same-day reopens, which mostly belong to the first session.
- It is dismissible, and it is never shown in a session where a modal sheet showed (D11).
- In the Exp 1 test arm the plan card is also an inline Home card (D11 / T32). The two must not stack: show this card only when the plan card is not shown. That condition is the same in both arms only if the card is gated on "no other inline Home card" in **both** arms. Otherwise the card is itself a both-arm difference and must be logged in the T02 ledger.

### Copy (English source; 13 locale files)

> **Quick question**
> What did you want MotoVault to do when you installed it?
>
> ◯ Track my rides
> ◯ Keep my bike's service on schedule
> ◯ Track what my bike costs
> ◯ Find roads and routes to ride
> ◯ I was just looking around
> ◯ Something else
>
> [Not now]

- After an answer: "Thanks — that helps decide what we build next." The card closes, and there is no upsell (board/05 "What I'd NOT do").
- "Something else" opens the existing feedback form (`apps/(tabs)/(profile)/feedback.tsx`). Its text stays in `public.feedback_messages`, never in PostHog (R2.7).
- **Change from P05.3's option list.** I map the options 1:1 to the five onboarding goals (`apps/mobile/src/app/(onboarding)/goals.tsx:27-58`: `track_rides`, `maintain_bike`, `manage_expenses`, `discover_routes`, `just_exploring`) plus `other`. P05.3 had "track my rides, but I wasn't riding yet". That option mixes a *reason* with a *blocker*. Keeping the two apart lets the answer be compared directly with the stored goal. The "not riding yet" blocker is better asked in the email (Q2), or from the existing Exp 1 chip "Not sure yet" (T32).

### Events (category only, no free text)

| Event | Properties | Why |
|---|---|---|
| `install_reason_card_shown` | `days_since_onboarding` (int), `activation_arm` (super property, already planned in T30) | denominator for the answer rate |
| `install_reason_answered` | `answer`: `track_rides` \| `maintain_bike` \| `manage_expenses` \| `discover_routes` \| `just_exploring` \| `other`; `matches_primary_goal` (bool, computed on device from the stored primary goal); `days_since_onboarding` | the distribution, and the stated-versus-chosen gap |
| `install_reason_dismissed` | `days_since_onboarding` | separates "not now" from "never saw it" |

- Add the events to `AnalyticsEvent` as `as const` constants (repo rule), next to `FEEDBACK_SENT`.
- They are consent-gated like every client event (`lib/analytics.ts:55-66`). EEA decliners are invisible (evidence pack §1). No server event is needed.
- **Check:** `install_reason%` does not exist in PostHog today. V5-P1 found 0 events from 2026-08-14 to 11-12, so there is no name clash.

## 4. How many responses, and what they can change (task 4)

| Channel | Pool | Assumed response | Realistic responses | Source |
|---|---|---|---|---|
| Email, narrow consent reading | 0 | — | **0** | V5-A |
| Email, loose reading | 21 (1 relay address) | 10–20% reply to a personal plain-text email from a lapsed user [UNBACKED] | **2–4** | V5-A/C |
| In-app card | completers who open on a later day within 14 days: **11 of 59** (19%) for completions 2026-10-13..10-28 → ≈ 0.7/day ≈ 5/week | answer 30–50% of those shown [UNBACKED] | **≈ 1.5–2.5/week → 12–20 in 8 weeks** | V5-P2; matches evidence pack §2 (167/793 ever returned, 21%) |
| Feedback form, unchanged | 3 messages in a month, all time | — | ≈ 0–1 from the target group | V5-B |

What this volume can and cannot do:
- With 15 answers, a single category share has a 95% interval of roughly ±25 points. The card can show that a reason **dominates** (for example, ≥ 10 of 15 say `maintain_bike`). It cannot rank close reasons.
- **The card hears only riders who come back.** The 81% who never reopen, the group #365 is about, are reached only by email, and the email pool is 0–21. So neither channel measures *why the never-returners left*. That still rests on forum evidence (board/05 F1–F7) and replays (R6). I can't close this gap with the data and consent we have. Confidence: high.
- The email pool leans toward `maintain_bike` among Spanish-locale riders (7 of 11 Spanish riders; V5-C). Two to four replies from that group would speak to Exp 2 / S4 (the day-0 service schedule) more than to rides.

## Queries

```sql
-- V5-A / V5-B / V5-C: Supabase prod, each wrapped in BEGIN READ ONLY; … COMMIT; (2026-11-12)
-- cohort: users created 2026-08-14 ≤ t < 2026-11-05, not is_synthetic, internal domains and test@test.com excluded
-- consent: preferences->'feedbackContact'->>'enabled' ('true' | 'false' | null)
-- inactive (core): no day > sign-up day with a ride ≥ 500 m, expense, or completed maintenance task (q08 definition)
-- inactive (created-only): no ride/expense/bike/task created, and no task completed, ≥ created_at + 1 day
-- sent feedback: exists in public.feedback_messages
-- locale/goal splits: feedbackContact.locale, preferences->'ridingGoals'->>0
-- Results as in the §1 table. Scripts: session scratchpad v5a.sql, v5b.sql, v5c.sql (not committed; they contain no PII).
```

```sql
-- V5-P1: PostHog execute-sql, 2026-08-14..11-12, internal-domain persons excluded by email
SELECT countIf(event ILIKE 'install_reason%'), countIf(event='feedback_sent'),
       uniqIf(person_id, event='feedback_sent'), uniqIf(person_id, event='onboarding_completed')
FROM events WHERE timestamp >= '2026-08-14' AND timestamp < '2026-11-12' AND <email exclusions>
-- → 0 | 1 | 1 | 421
-- V5-P2: completers 2026-10-13..10-28 with an Application Opened/Became Active on a later calendar day < done_at + 14 d
-- → 59 completers, 11 reopened on a later day (19%)
```

Limits:
- The PostHog queries excluded internal persons by email domain, not by the full q00 person list (kept outside the repo). The q00 list has 11 persons over 90 days, so it moves V5-P2 by 0–1 at most.
- `ridingGoals->>0` is the first stored goal. I did not confirm that it equals `primary_goal`.

## Effect on plan confidence

**Confirms**
- board/04 Responses item 3 and board/99 ("No email to riders without contact consent"). The consenting pool is tiny: 22 ticked, 21 inactive and live. **0** of them sent feedback, so the "email only riders who sent feedback" route (P05.3 (ii)) reaches **nobody** in this cohort. No explicit "no" is ever stored (0 `false` values across all 34 ticks).
- P05.3 "expect tens of answers, not hundreds". The card's reach is about 5 riders a week (V5-P2), which gives about 12–20 answers in 8 weeks.
- T40 / D13: "qualitative signals are reported beside the decision but do not gate it". At this volume they cannot gate anything.

**Corrects**
- **P05.3 (ii) as written yields 0 contacts.** Change the plan's ledger entry for P05.3 (§10 post-slot queue, `EXECUTION_PLAN.md:1639`; and `:807` in T41 if it is kept as history) from "card + replies to riders who sent feedback" to: "Card only. The email channel is empty (0 of 21 consenting inactive riders sent feedback; V5). A broader email needs a new wording-v2 opt-in after the onboarding A/B."
- **P05.3 option list.** Replace "track my rides, but I wasn't riding yet / service schedule / costs / something else" with the five onboarding goals plus `other` (§3). Add `matches_primary_goal`, plus the events `install_reason_card_shown` and `install_reason_dismissed`. Without them the answer rate cannot be computed.
- **Timing under the store-build-only rule.** board/99 :237 says "before the slot starts or after it ends". With no OTA, the card must be in a **store binary released before the Exp 1 start (2026-12-15, D16)**, or it moves to after 2027-03-31. If it ships during the slot, it must be gated identically in both arms and logged as a both-arm change in the T02 ledger, so the T40 readout can be cut. Add this sentence to the ledger note.
- **D11 / T32 interaction.** The install-reason card and the Exp 1 plan card are both inline Home cards. Add to D11: "at most one inline Home card per session. The plan card (test arm) wins. The install-reason card waits for the next later-day open, in both arms."
- **Locale count (to verify).** Several tasks say "7 app locales" (e.g. `EXECUTION_PLAN.md:447,466,481,487`). On origin/main, `SUPPORTED_LOCALES` has **13** entries (`packages/types/src/constants/enums.ts:342-356`), and `apps/mobile/src/i18n/locales/` has 14 files (including `es-ES`). Any new string, including this card, needs every file that `pnpm check:i18n` enforces. Either confirm the "7" refers to reviewed locales, or change the wording to "all app locale files".

**Leaves open, not invalidated**
- The core question of #365 is **why never-returners leave**, and with today's consent and volume neither channel can answer it (§4). The plan's diagnosis keeps resting on funnel data, replays (R6, FS-PO9 / FS-PO14) and forum evidence. No T## or FS-* confidence should be raised on the strength of this survey. If the card shows a dominant `maintain_bike` reason among returners, that supports the S4 / T07a / FS-PO1H direction (Experiment 2). A dominant `track_rides` supports FS-EXP1 / T30–T32. Each is a hint, not a test.
- Product gap to log (not a plan task): there is no way to withdraw `feedbackContact` without sending feedback (`feedback.service.ts:153-185`). Fix it before any wording-v2 email opt-in ships.
