# Prompt for Andrej — Meta Ads launch readiness

Paste the block below into Claude Code (or Cursor) at the MotoVault repo root.

---

## Prompt to paste

```
I need to make Meta Ads install tracking production-ready for a campaign launching May 8, 2026. Valentina is running the campaign at €400/month, US-only, optimized for App Promotion. The mobile app and API both already have the Meta SDK and Conversions API wired up — but two specific fixes are needed plus a production verification pass.

What's already been done in code (do NOT redo these):
- apps/mobile/src/lib/meta-analytics.ts — renamed trackCompleteTutorial → trackCompleteRegistration, changed event from fb_mobile_tutorial_completion to fb_mobile_complete_registration, added optional eventId param for future dedup.
- apps/mobile/src/app/(onboarding)/personalizing.tsx line 144 — call site updated to match.

What I need you to do, in order:

1. PRODUCTION ENV VAR AUDIT
   - Confirm these four env vars are populated in production (NOT just .env.example):
     • API: META_DATASET_ID, META_ACCESS_TOKEN  (referenced in apps/api/src/modules/meta/meta-events.service.ts lines 27–28)
     • Mobile EAS build: EXPO_PUBLIC_META_APP_ID, EXPO_PUBLIC_META_CLIENT_TOKEN  (referenced in apps/mobile/app.config.ts lines 85–100)
   - For the mobile vars, run `eas env:list --environment production` and report.
   - For the API vars, check whichever hosting platform we use (Vercel/fly.io/etc — check apps/api for deployment config) and report whether values are set. Don't echo the values.
   - If any are missing, tell me which and STOP — I'll add them before you proceed.

2. CLIENT-SERVER DEDUP (recommended before launch)
   Currently the mobile fires fb_mobile_complete_registration via SDK, and the API fires CompleteRegistration via CAPI when onboarding completes — but they don't share an event_id, so Meta may double-count.

   Wire up event_id deduplication:
   a. In personalizing.tsx, generate a UUID before calling completeOnboarding, pass it to MetaAnalytics.trackCompleteRegistration(eventId), and pass it as a new field on the completeOnboarding mutation input.
   b. In the GraphQL completeOnboarding mutation/resolver in apps/api, accept the new eventId field on the input.
   c. In apps/api/src/modules/users/users.service.ts around line 204 where sendAppEvent is called, pass eventId through to params.
   d. In apps/api/src/modules/meta/meta-events.service.ts, accept eventId in sendAppEvent params and add it to the payload.data[0].event_id field.
   e. Run `pnpm generate` after the .graphql / resolver change.
   f. Run `pnpm precheck` and confirm green.

3. EAS BUILD + STORE SUBMIT
   - Trigger an EAS build for production (both iOS and Android) so the corrected event-name change actually ships:
     `eas build --profile production --platform all`
   - Once the build completes, run `eas submit --profile production --platform all` to push to App Store Connect / Play Console.
   - Report the build IDs and submission status. Note that App Store review is typically 24–48 hours — flag this since the launch is May 8.

4. SMOKE TEST PLAN
   After the production build is live in TestFlight / Play Internal Testing:
   - Install on a physical device
   - Open Meta Events Manager → MotoVault dataset → Test Events tab
   - Add the device as a test device
   - Complete onboarding in the app
   - Confirm BOTH events appear in Test Events:
     • fb_mobile_app_install (auto-fired by SDK on first open)
     • fb_mobile_complete_registration (from mobile, with event_id)
     • CompleteRegistration (from CAPI, with same event_id — should show as deduplicated)
   - Report what you saw, with screenshots if possible.

Constraints / preferences:
- Read CLAUDE.md before writing code — follow the type-flow and naming conventions.
- This is a marketing-driven launch, so prefer fewer changes over more. Don't refactor the other event mappings in meta-analytics.ts (trackStartDiagnostic, trackLogMaintenance etc) even though some look semantically wrong — separate sprint.
- If anything is genuinely broken or risky, STOP and explain. Don't ship a hack.

Report back when each numbered step is complete. I'd rather you ask for clarification than guess.
```

---

## What this prompt assumes

- Andrej runs Claude Code or Cursor at the repo root
- He has `eas` CLI authenticated to the MotoVault Expo project
- He has access to whichever platform hosts the API (Vercel/fly.io/etc) for the env audit
- He has access to Meta Events Manager for the smoke test

If any of those aren't true, the prompt still works — Claude Code will surface the gap rather than silently fail.
