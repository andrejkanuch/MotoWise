# Signup reconciliation — baseline, and the open gate

**Date:** 2026-08-24
**Gate for:** U2 of `docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md`
**Status:** ⚠️ **OPEN — but the event is now live.** Shipped to production
2026-08-24 (see "Deployment record" below). The gate cannot be evaluated until
September is over. U2 is not done until the number below is filled in.

**Gate month: September 2026.** The sweep went live on 2026-08-24, so August is
a partial month and unusable. Evaluate from **2026-10-01**, once September is
complete.

Reproduce the denominator with `pnpm reconcile:signup`. It applies the same
`role = 'user' AND deleted_at IS NULL` filters as `claim_pending_signup_events`,
and refuses to report the current month as if it were complete.

---

## Why this is the gate and a test suite is not

The 2026-06-09 fix for this same bug class
(`docs/solutions/integration-issues/posthog-onboarding-funnel-instrumentation.md`)
shipped with 18 passing unit tests and set the criterion *"`user_signed_up`
unique users ≈ new `auth.users` rows for that month."* It was marked resolved.
It is still failing.

A unit test proves the code emits what the code intends. Only a count against
the database proves the event **means** what we think it means. That is why the
acceptance gate is a number and not a green suite.

## Baseline, verified 2026-08-24

Denominator from production `public.users` (service-role REST, read-only).
Numerator from PostHog project 155556.

| Month | DB signups | `user_signed_up` | `account_created` | Either | Either ÷ DB |
|---|---|---|---|---|---|
| 2026-04 | 56 | 4 | 0 | 4 | **7%** |
| 2026-05 | 167 | 37 | 0 | 37 | **22%** |
| 2026-06 | 106 | 31 | 15 | 46 | **43%** |
| 2026-07 | 54 | 10 | 52 | 56 | **104%** |
| 2026-08 (partial) | 98 | 11 | 87 | 96 | 98% |

Row totals for context: 577 rows in `public.users`, of which **2 are `admin`**
and **24 are soft-deleted**, leaving **551 eligible**. Getting those filters
wrong is the difference between 577, 553 and 551 — and it looks exactly like an
emitter bug.

## Correction to the plan's diagnosis

The plan describes this as an undercount: *"`account_created` fires from a single
onboarding screen (154 events) and `user_signed_up` from the auth screens (62)
against 320 real signups."* The event totals are right — 15+52+87 = 154 for the
90-day window — but the characterisation is not.

**`account_created` OVER-counted.** July is at **104%** of real signups and
August at 98%. It was emitted from a `useEffect` that fired whenever a Supabase
session appeared on the account screen, and that screen explicitly accepts
returning users — its own comment says so, because Apple and Google do not
separate sign-up from sign-in. So every returning sign-in was recorded as an
account creation. `docs/onboarding-ab-event-schema.md` even documents it as
*"account created **or signed in**"*.

So the two legacy events fail in **opposite** directions:

- `user_signed_up` **under**-counts — 10 and 11 in the last two months against
  54 and 98 real signups, because it only fires on paths someone instrumented.
- `account_created` **over**-counts — it conflates sign-in with sign-up.

That the union happens to land near 100% in recent months is a coincidence of
two errors partially cancelling, not a working measurement. Anyone reading
"either event" as a signup count in July would have been within 4% by luck, and
in May would have been out by 78%.

This matters for more than tidiness: it is why *both* events had to go rather
than one being promoted. A screen cannot distinguish a new account from a
returning session; the row insert can, because a returning user does not create
one. The over-count is structurally impossible in the new design.

It is also the clearest example of what an independent review of the plan would
have been for. The plan's remedy (one canonical server-side event) is correct and
unchanged — but it was justified with half the diagnosis.

## Deployment record — 2026-08-24

All three parts are live and verified end-to-end:

| Part | State | Evidence |
|---|---|---|
| Migration `00174` | Applied to production | 577 rows seeded into `signup_event_log`, 0 pending, RLS on, 3 functions present, recorded in `supabase_migrations.schema_migrations` as version `00174` |
| Vault secret `signup_event_secret` | Created | sha256 fingerprint matches Render byte-for-byte |
| Render env (`SIGNUP_EVENT_SECRET`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`) | Set + deployed | deploy `dep-da6al6bm8hqs73eptfc0`, status `live` |
| pg_cron job `signup-events` | Active, `*/10 * * * *` | jobid 10 |

End-to-end proof: invoking `public.cron_trigger_signup_events()` produced
`net._http_response` id 548 — **HTTP 200**,
`{"claimed":0,"identified":0,"anonymous":0,"released":0,"status":"ok"}`. `claimed:0`
is the correct result, because the migration's seed deliberately suppresses the
~577-user backfill. The endpoint also returns **401** for a missing or wrong
secret, so it fails closed.

The seed is why August cannot be the gate month: every user existing on
2026-08-24 was marked as already-claimed, so only signups from that moment
forward emit an event.

## The gate

Fill this in for the **first full calendar month after the sweep is live**. The
sweep went live **2026-08-24**, so the gate month is **September 2026**, and it
can first be evaluated on **2026-10-01**.

| | Value |
|---|---|
| Gate month | **2026-09** |
| `signup_completed` unique users (PostHog) | _(fill in)_ |
| New `public.users` rows, `role='user'`, not deleted (`pnpm reconcile:signup`) | _(fill in)_ |
| Ratio | _(fill in)_ |
| Verdict, PASS = within ±10% | _(fill in)_ |

Two failure modes that are **not** bugs in the emitter — check both before
investigating one:

1. **A partial month.** Comparing three weeks of events against a full month of
   rows reads as a 25% undercount. `pnpm reconcile:signup` marks the current
   month `INCOMPLETE` for this reason.
2. **A mismatched denominator.** Dropping the `role`/`deleted_at` filters
   inflates it and reads as an undercount.

### If it fails high (numerator > denominator)

Suspect the consent path. A user who declined analytics is deliberately still
counted, but under a single shared `distinct_id` (`signup-no-consent`), so those
users collapse to **one** unique person, not zero and not N. If a large share of
signups decline analytics, expect the numerator to sit slightly *below* the
denominator for that reason, never above it. A numerator above the denominator
means something is emitting more than once per user — which the primary key on
`signup_event_log` should make impossible, so check for a restored backup or
hand-deleted log rows before anything else.

### If it fails low

Check, in order:

1. Is `POSTHOG_PROJECT_TOKEN` set on Render? Without it the sweep **refuses to
   claim**, so signups queue rather than being consumed. `SELECT count(*) FROM
   public.users u LEFT JOIN public.signup_event_log l ON l.user_id = u.id WHERE
   l.user_id IS NULL AND u.role = 'user' AND u.deleted_at IS NULL` — a large
   number here means the sweep never ran successfully.
2. Is the cron job scheduled? `SELECT * FROM cron.job WHERE jobname =
   'signup-events'`.
3. Did the Vault secret and `SIGNUP_EVENT_SECRET` match? A mismatch returns 401
   and the sweep silently does nothing. Compare sha256 fingerprints; never print
   the secret.
4. Was the log seeded and then not un-seeded for a backfill? Migration 00174
   deliberately seeds every existing user so the first tick does not emit ~577
   backdated events.
