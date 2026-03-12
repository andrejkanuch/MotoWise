---
title: "feat: Initialize RevenueCat SDK and wire subscription system"
type: feat
status: completed
date: 2026-03-12
deepened: 2026-03-12
linear: MOT-117
priority: P0 — Launch Blocker
---

# Initialize RevenueCat SDK and Wire Subscription System

## Enhancement Summary

**Deepened on:** 2026-03-12
**Review agents used:** TypeScript Reviewer, Security Sentinel, Performance Oracle, Architecture Strategist, Frontend Races Reviewer, Data Integrity Guardian, Pattern Recognition Specialist, Context7 SDK Docs, Expo Skills, Learnings Researcher

### Critical Improvements from Review

1. **Race condition fix:** `loginRevenueCat()` can outrun `Purchases.configure()` — must gate through a shared init promise
2. **Webhook processing:** Remove `setImmediate` fire-and-forget — process synchronously, return 200 only on success
3. **Transaction boundary:** Idempotency check + user upsert must be atomic (single transaction)
4. **Timing-safe auth:** Use `crypto.timingSafeEqual` for webhook secret comparison
5. **Zod validation:** Define Zod schema for webhook payload DTO
6. **PremiumGuard caching:** Per-request DB query on every premium resolver — cache in JWT or per-request context
7. **Listener cleanup:** `customerInfoUpdateListener` must be removable (React strict mode + cleanup)
8. **Store hydration race:** Persisted `isPro: true` can show stale state — add `isVerified` flag

### Institutional Learnings Applied

- **GraphQL contract drift:** Define resolver signatures + `.graphql` operations first, run `pnpm generate`, commit generated output before parallel work (from `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`)
- **Module registration checklist:** Register enums via `graphql-enums.ts`, wire ZodValidationPipe immediately, RLS with both USING + WITH CHECK (from `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`)

---

## Overview

`initRevenueCat()` is defined in `apps/mobile/src/lib/subscription.ts` but **never called**. The subscription Zustand store exists but is never hydrated. The paywall screen is cosmetic — no subscription revenue is possible. This plan wires the full subscription lifecycle: SDK init → user identification → purchase flow → server-side webhook sync → feature gating.

## Problem Statement

- `initRevenueCat()` defined but never invoked from `_layout.tsx` or any entry point
- `Purchases.logIn(supabaseUserId)` never called — RevenueCat users are anonymous, no cross-device restore
- `useSubscriptionStore` is never consumed by any screen — subscription state never reaches UI
- No RevenueCat webhook endpoint on the API — server has no knowledge of purchases
- Free tier limits defined in `packages/types` but never enforced
- `react-native-purchases` missing from `app.config.ts` plugins array
- Zero monetization capability at launch

## Proposed Solution

### Phase 0: Shared Constants & Contract

#### 0.1 Extract entitlement constant

**File:** `packages/types/src/constants/subscription.ts`

The magic string `'MotoWise Pro'` appears in `subscription.ts` line 34 and would be duplicated in hydration code. Extract once:

```typescript
export const REVENUECAT_ENTITLEMENT_PRO = 'MotoWise Pro' as const;
```

Export from `packages/types/src/index.ts`.

#### 0.2 Define GraphQL contract first

Per institutional learning on contract drift: before building API webhook handler and mobile SDK integration in parallel, define resolver signatures and `.graphql` operation files, run `pnpm generate`, and commit generated output. Both tracks code against committed `TypedDocumentNode` types.

### Phase 1: Mobile SDK Initialization & User Identification

#### 1.1 Add Expo config plugin

**File:** `apps/mobile/app.config.ts`

Add `react-native-purchases` to the plugins array and ensure Android Kotlin version meets minimum:

```typescript
plugins: [
  'expo-router',
  // ... existing plugins ...
  'react-native-purchases', // <-- ADD
  [
    'expo-build-properties',
    {
      android: {
        compileSdkVersion: 35,
        targetSdkVersion: 35,
        minSdkVersion: 24,
        kotlinVersion: '1.9.0', // <-- ADD (react-native-purchases v9 requires >= 1.8.0)
      },
      ios: {
        deploymentTarget: '16.0',
      },
    },
  ],
],
```

> **Note:** Adding/changing plugins requires a new EAS native build. OTA updates won't pick it up. Run `eas build -p ios --profile development` after this change.

#### 1.2 Rewrite subscription.ts with promise-based init

**File:** `apps/mobile/src/lib/subscription.ts`

**CRITICAL:** The current `isConfigured` boolean guard does NOT prevent `loginRevenueCat()` from racing ahead of `Purchases.configure()`. The `getSession()` callback can resolve before the dynamic import finishes, causing `logIn()` on an unconfigured SDK — purchases attributed to anonymous users that can never be restored.

Replace the module-level boolean with a **shared promise gate**:

```typescript
import Constants from 'expo-constants';
import { REVENUECAT_ENTITLEMENT_PRO } from '@motolearn/types';
import { useSubscriptionStore } from '../stores/subscription.store';

// Module-level cached import — resolve once, reuse everywhere
let PurchasesModule: typeof import('react-native-purchases') | null = null;

async function getPurchases() {
  if (!PurchasesModule) {
    PurchasesModule = await import('react-native-purchases');
  }
  return PurchasesModule.default;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// Shared init promise — loginRevenueCat awaits this before calling logIn
let initPromise: Promise<(() => void) | null> | null = null;

export function initRevenueCat(): Promise<(() => void) | null> {
  if (isExpoGo()) {
    return Promise.resolve(null);
  }
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

async function doInit(): Promise<(() => void) | null> {
  try {
    const Purchases = await getPurchases();

    const apiKey =
      process.env.EXPO_OS === 'ios'
        ? process.env.EXPO_PUBLIC_RC_IOS_KEY
        : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

    if (!apiKey) {
      console.warn('[RevenueCat] No API key configured');
      return null;
    }

    await Purchases.configure({ apiKey });
    useSubscriptionStore.getState().setAvailable(true);

    // Set up listener — store the reference for cleanup
    const listener = (info: any) => {
      const store = useSubscriptionStore.getState();
      const isPro = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
      store.setPro(isPro);

      const proEntitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
      if (proEntitlement?.periodType === 'TRIAL') {
        const expirationDate = proEntitlement.expirationDate;
        if (expirationDate) {
          const daysLeft = Math.ceil(
            (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          store.setTrialing(true, daysLeft);
        }
      } else {
        store.setTrialing(false);
      }
      store.setVerified(true);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    // Hydrate store with initial state
    const customerInfo = await Purchases.getCustomerInfo();
    listener(customerInfo); // reuse same logic

    // Return cleanup function for useEffect
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  } catch (e) {
    console.error('[RevenueCat] Init failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function loginRevenueCat(userId: string) {
  if (isExpoGo()) return;
  // CRITICAL: wait for configure() to complete before calling logIn()
  const cleanup = await initRevenueCat();
  if (!cleanup) return; // init failed or no API key
  try {
    const Purchases = await getPurchases();
    await Purchases.logIn(userId);
  } catch (e) {
    console.error('[RevenueCat] logIn failed:', e instanceof Error ? e.message : e);
  }
}

export async function logoutRevenueCat() {
  if (isExpoGo()) return;
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.logOut();
  } catch (e) {
    console.error('[RevenueCat] logOut failed:', e instanceof Error ? e.message : e);
  }
}
```

**Key improvements:**
- Shared `initPromise` prevents race between `configure()` and `logIn()`
- Cached dynamic import via `getPurchases()` — resolve once, no redundant async overhead
- `isExpoGo()` extracted — single guard point
- Listener cleanup returned for `useEffect` teardown (React strict mode safe)
- Logs only `e.message`, not full error object (prevents PII leakage in device logs)
- `isVerified` flag set after first successful `getCustomerInfo()`

#### 1.3 Update subscription store with `isVerified`

**File:** `apps/mobile/src/stores/subscription.store.ts`

Add `isVerified` to prevent stale `isPro: true` from showing pro features before fresh data arrives:

```typescript
interface SubscriptionState {
  // ... existing fields ...
  isVerified: boolean;
  setVerified: (verified: boolean) => void;
}

// In the store:
isVerified: false,
setVerified: (isVerified) => set({ isVerified }),

// In partialize — do NOT persist isVerified (always starts false on cold launch)
```

UI gating pattern:
```typescript
const { isPro, isVerified } = useSubscriptionStore();
// Show loading/skeleton for premium features until isVerified === true
// After verification, isPro is trustworthy
```

#### 1.4 Wire into root layout

**File:** `apps/mobile/src/app/_layout.tsx`

```typescript
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '../lib/subscription';

// Inside RootLayout — add useEffect with cleanup:
useEffect(() => {
  let cleanup: (() => void) | null = null;
  initRevenueCat().then((c) => { cleanup = c; });
  return () => { cleanup?.(); };
}, []);

// Modify the EXISTING onAuthStateChange listener (don't add a second one):
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
  if (session?.user) {
    loginRevenueCat(session.user.id); // safe — awaits initPromise internally
  } else {
    logoutRevenueCat();
    queryClient.clear();
    cancelAllNotifications();
  }
});

// Remove the duplicate loginRevenueCat from getSession().then() —
// onAuthStateChange fires INITIAL_SESSION which covers this case.
// Having both causes a redundant network round-trip.
```

### Phase 2: Server-Side Webhook & Subscription Sync

#### 2.1 Add env vars to validation schema

**File:** `apps/api/src/config/env.validation.ts`

```typescript
REVENUECAT_WEBHOOK_SECRET: z.string().min(1).optional(), // optional so API starts without it
REVENUECAT_SECRET_API_KEY: z.string().startsWith('sk_').optional(),
```

Log a warning at module init if not set.

#### 2.2 Remove rawBody (not needed)

The webhook auth uses a header comparison, not HMAC body signing. `rawBody: true` is NOT needed — skip the `main.ts` change. This avoids unnecessary memory overhead on every request.

#### 2.3 Create RevenueCat webhook module

**New files:**
- `apps/api/src/modules/webhooks/webhooks.module.ts`
- `apps/api/src/modules/webhooks/revenuecat.controller.ts` (not `revenuecat-webhook.controller.ts` — avoids redundancy since it's already in `webhooks/`)
- `apps/api/src/modules/webhooks/revenuecat.service.ts`
- `apps/api/src/modules/webhooks/dto/revenuecat-event.dto.ts`

**DTO with Zod validation** (`dto/revenuecat-event.dto.ts`):

```typescript
import { z } from 'zod';

export const revenueCatEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  app_user_id: z.string().uuid(),
  product_id: z.string().optional(),
  entitlement_ids: z.array(z.string()).optional(),
  period_type: z.string().optional(),
  expiration_at_ms: z.number().optional(),
  purchased_at_ms: z.number().optional(),
  environment: z.string().optional(),
  store: z.string().optional(),
});

export const revenueCatWebhookPayloadSchema = z.object({
  api_version: z.string(),
  event: revenueCatEventSchema,
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;
export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;
```

**Controller** (`revenuecat.controller.ts`):

```typescript
import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RevenueCatWebhookPayload, revenueCatWebhookPayloadSchema } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('webhooks')
export class RevenueCatWebhookController {
  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(
    private readonly service: RevenueCatService,
    private readonly config: ConfigService,
  ) {}

  @Post('revenuecat')
  @HttpCode(200)
  async handle(
    @Headers('authorization') authHeader: string,
    @Body() rawBody: unknown,
  ) {
    // Validate auth — timing-safe comparison
    const secret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret || !authHeader || !safeCompare(authHeader, secret)) {
      throw new UnauthorizedException('Invalid webhook authorization');
    }

    // Validate payload with Zod
    const parsed = revenueCatWebhookPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      this.logger.warn(`Invalid webhook payload: ${parsed.error.message}`);
      return { status: 'invalid_payload' };
    }

    // Process SYNCHRONOUSLY — return 200 only on success, 500 triggers RC retry
    await this.service.processEvent(parsed.data.event);
    return { status: 'processed' };
  }
}
```

**Key improvements over original plan:**
- `crypto.timingSafeEqual` for secret comparison (prevents timing attacks)
- `ConfigService` instead of `process.env` (matches codebase convention)
- Zod validation on the incoming payload (not just a TypeScript interface)
- **Synchronous processing** — no `setImmediate`. RevenueCat allows 60s timeout. A DB upsert takes <50ms. Return 200 only on success; return 500 to trigger RC retry (5x backoff).
- `@Throttle` rate limiting (30 req/min — generous for RevenueCat's event rate)
- `Logger` instance per codebase convention
- Validate `app_user_id` is a valid UUID before processing

**Service** (`revenuecat.service.ts`):

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async processEvent(event: RevenueCatEvent): Promise<void> {
    // Atomic: idempotency check + user upsert in a single RPC call
    const { error } = await this.adminClient.rpc('process_revenuecat_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_app_user_id: event.app_user_id,
      p_expiration_at: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
      p_period_type: event.period_type ?? null,
    });

    if (error) {
      // If it's a duplicate event, that's fine — not an error
      if (error.message?.includes('already_processed')) {
        this.logger.log(`Event ${event.id} already processed, skipping`);
        return;
      }
      this.logger.error(`Failed to process event ${event.id}: ${error.message}`);
      throw error; // Triggers 500 → RevenueCat retries
    }

    this.logger.log(`Processed ${event.type} for user ${event.app_user_id}`);
  }
}
```

**Key improvements:**
- Uses `SUPABASE_ADMIN` constant token import (not string literal)
- Atomic transaction via Supabase RPC function (see migration below)
- Logger instance per codebase convention
- Throws on failure → 500 response → RevenueCat retries

#### 2.4 Database migration

**New file:** `supabase/migrations/00031_revenuecat_webhook_processing.sql`

```sql
-- Idempotency table for webhook event deduplication
CREATE TABLE public.revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries and GDPR deletion
CREATE INDEX idx_rc_events_app_user_id ON public.revenuecat_webhook_events (app_user_id);
CREATE INDEX idx_rc_events_processed_at ON public.revenuecat_webhook_events (processed_at);

-- Intentionally no policies: only service-role (SUPABASE_ADMIN) accesses this table.
-- RLS enabled to ensure authenticated/anon clients cannot read webhook event data.
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

-- Fix: add NOT NULL to subscription_status (was missing from migration 00023)
UPDATE public.users SET subscription_status = 'free' WHERE subscription_status IS NULL;
ALTER TABLE public.users ALTER COLUMN subscription_status SET NOT NULL;

-- Fix: re-protect trial_started_at in RLS (dropped in migration 00023 regression)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND subscription_status IS NOT DISTINCT FROM
        (SELECT subscription_status FROM public.users WHERE id = auth.uid())
    AND subscription_tier IS NOT DISTINCT FROM
        (SELECT subscription_tier FROM public.users WHERE id = auth.uid())
    AND subscription_expires_at IS NOT DISTINCT FROM
        (SELECT subscription_expires_at FROM public.users WHERE id = auth.uid())
    AND trial_started_at IS NOT DISTINCT FROM
        (SELECT trial_started_at FROM public.users WHERE id = auth.uid())
    AND revenuecat_id IS NOT DISTINCT FROM
        (SELECT revenuecat_id FROM public.users WHERE id = auth.uid())
    AND role IS NOT DISTINCT FROM
        (SELECT role FROM public.users WHERE id = auth.uid())
    AND email IS NOT DISTINCT FROM
        (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Atomic webhook processing function (SECURITY DEFINER = runs as owner, not caller)
CREATE OR REPLACE FUNCTION public.process_revenuecat_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_app_user_id UUID,
  p_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_period_type TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN;
  v_tier TEXT;
  v_status TEXT;
BEGIN
  -- Step 1: Idempotency check — atomic INSERT OR SKIP
  INSERT INTO revenuecat_webhook_events (event_id, event_type, app_user_id)
  VALUES (p_event_id, p_event_type, p_app_user_id)
  ON CONFLICT (event_id) DO NOTHING;

  -- Check if we actually inserted (= new event)
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    RAISE EXCEPTION 'already_processed';
  END IF;

  -- Step 2: Derive tier and status from event type
  CASE p_event_type
    WHEN 'INITIAL_PURCHASE' THEN
      v_tier := 'pro';
      v_status := CASE WHEN p_period_type = 'TRIAL' THEN 'trialing' ELSE 'active' END;
    WHEN 'RENEWAL' THEN
      v_tier := 'pro';
      v_status := 'active';
    WHEN 'CANCELLATION' THEN
      v_tier := 'pro'; -- keep access until expiration
      v_status := 'cancelled';
    WHEN 'UNCANCELLATION' THEN
      v_tier := 'pro';
      v_status := 'active';
    WHEN 'EXPIRATION' THEN
      v_tier := 'free';
      v_status := 'expired';
    WHEN 'BILLING_ISSUE' THEN
      v_tier := 'pro'; -- keep access during grace period
      v_status := 'past_due';
    ELSE
      -- Unknown event type — log but don't modify subscription
      RETURN;
  END CASE;

  -- Step 3: Atomic user update
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = COALESCE(p_expiration_at, subscription_expires_at),
    revenuecat_id = p_app_user_id::TEXT
  WHERE id = p_app_user_id;
END;
$$;

-- Cleanup: schedule via pg_cron (if extension available) or NestJS cron
-- DELETE FROM revenuecat_webhook_events WHERE processed_at < now() - interval '7 days';
```

**Key improvements over original plan:**
- `app_user_id` is `UUID` with FK to `users(id) ON DELETE CASCADE` (GDPR compliant)
- Both operations (idempotency + upsert) are atomic in a single PL/pgSQL function
- `SECURITY DEFINER` function callable from service-role only
- Fixes `subscription_status` NOT NULL constraint (regression from migration 00023)
- Re-protects `trial_started_at` in RLS policy (regression from migration 00023)
- Uses existing `revenuecat_id` column from migration 00023
- Index on `app_user_id` for debugging and GDPR deletion queries

#### 2.5 Register webhook module

**File:** `apps/api/src/app.module.ts`

Add `WebhooksModule` to imports. Verify that `GqlThrottlerGuard` (global APP_GUARD) covers REST controllers — if not, register a separate `ThrottlerGuard` for the webhook module.

### Phase 3: Feature Gating

#### 3.1 Server-side premium guard

**New file:** `apps/api/src/common/guards/premium.guard.ts`

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../modules/supabase/supabase-admin.provider';
import type { AuthUser } from '../types/auth-user';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const user = gqlContext.getContext().user as AuthUser | undefined;

    // Defensive check — PremiumGuard must run AFTER GqlAuthGuard
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // Check per-request cache first (avoid duplicate DB queries in same request)
    const req = gqlContext.getContext().req;
    if (req._subscriptionTier !== undefined) {
      if (req._subscriptionTier !== 'pro') {
        throw new ForbiddenException('MotoWise Pro subscription required');
      }
      return true;
    }

    const { data, error } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to verify subscription status');
    }

    // Cache on request context for subsequent guards in same request
    req._subscriptionTier = data.subscription_tier;

    if (data.subscription_tier !== 'pro') {
      throw new ForbiddenException('MotoWise Pro subscription required');
    }
    return true;
  }
}
```

**Key improvements over original plan:**
- Uses `SUPABASE_ADMIN` constant import (not string literal)
- Defensive null check on `user` (guards against wrong ordering)
- Distinguishes "not pro" from "failed to check" (`ForbiddenException` vs `InternalServerErrorException`)
- Per-request context cache (`req._subscriptionTier`) — if multiple resolvers use PremiumGuard in one request, DB is hit only once
- **Future optimization:** Embed `subscription_tier` in JWT `app_metadata` via Supabase auth hook to eliminate DB query entirely

Usage on resolvers: `@UseGuards(GqlAuthGuard, PremiumGuard)`

#### 3.2 Client-side feature gating helper

**File:** `apps/mobile/src/lib/subscription.ts`

```typescript
import { FREE_TIER_LIMITS } from '@motolearn/types';

type FeatureAccess =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; limit: number; remaining: number }
  | { allowed: false; unlimited: false; limit: number; remaining: number };

export function checkFeatureAccess(
  feature: keyof typeof FREE_TIER_LIMITS,
  currentCount: number,
  isPro: boolean,
): FeatureAccess {
  if (isPro) return { allowed: true, unlimited: true };
  const limit = FREE_TIER_LIMITS[feature];
  const remaining = Math.max(0, limit - currentCount);
  return {
    allowed: currentCount < limit,
    unlimited: false,
    limit,
    remaining,
  };
}
```

**Improvement:** Discriminated union return type instead of `Infinity` (which serializes to `null` in JSON).

**Important:** Client-side gating is UI-only. Server-side enforcement via `PremiumGuard` is the actual access control. Document which resolvers require PremiumGuard:
- AI diagnostics (> 3/month for free)
- Motorcycle creation (> 1 for free)
- Maintenance task creation (> 5/bike for free)

### Phase 4: Post-Onboarding Paywall Access

#### 4.1 Upgrade paywall sheet

**New file:** `apps/mobile/src/app/(tabs)/(profile)/upgrade.tsx`

- Reuse the same `PricingCard` component from the onboarding paywall
- Present as `formSheet` modal
- Triggered from profile screen or when hitting a free tier limit

**File:** `apps/mobile/src/app/(tabs)/(profile)/_layout.tsx`

Must add the Stack.Screen declaration for formSheet presentation:

```typescript
<Stack.Screen name="upgrade" options={{ presentation: 'formSheet' }} />
```

### Phase 5: Post-Implementation

#### 5.1 Run codegen pipeline

Per CLAUDE.md update sequence:
1. `npx supabase db push` (push migration)
2. `pnpm generate:types` (update database.types.ts)
3. `pnpm generate` (regenerate GraphQL types)
4. `pnpm typecheck` (verify all imports)

#### 5.2 Build development client

```bash
# Must rebuild after adding react-native-purchases plugin
eas build -p ios --profile development
npx expo start --dev-client
```

## Acceptance Criteria

- [ ] `initRevenueCat()` called in root `_layout.tsx` on app mount with cleanup
- [ ] `loginRevenueCat()` awaits init promise before calling `Purchases.logIn()`
- [ ] `Purchases.logOut()` called on sign-out
- [ ] Subscription store hydrated with initial customer info + `isVerified` flag
- [ ] `customerInfoUpdateListener` properly added AND removed (cleanup function)
- [ ] `react-native-purchases` added to `app.config.ts` plugins
- [ ] `REVENUECAT_ENTITLEMENT_PRO` constant extracted to `@motolearn/types`
- [ ] RevenueCat webhook endpoint at `POST /webhooks/revenuecat` with timing-safe auth
- [ ] Webhook payload validated with Zod schema
- [ ] Webhook processing is synchronous (200 on success, 500 on failure for retry)
- [ ] Idempotency + user upsert are atomic (single DB transaction via RPC)
- [ ] `PremiumGuard` available with per-request caching + error handling
- [ ] `checkFeatureAccess()` returns discriminated union type
- [ ] `subscription_status` has NOT NULL constraint
- [ ] `trial_started_at` re-protected in RLS policy
- [ ] Env vars added to `env.validation.ts`
- [ ] Paywall correctly displays offerings from RevenueCat dashboard
- [ ] Restore purchases works
- [ ] Subscription state persists across app restarts
- [ ] Expo Go gracefully skips all RevenueCat calls
- [ ] `pnpm generate` run after all changes

## System-Wide Impact

### Interaction Graph

- `initRevenueCat()` → `Purchases.configure()` → `addCustomerInfoUpdateListener()` → `getCustomerInfo()` → updates Zustand store with `isVerified: true`
- `onAuthStateChange(session)` → `loginRevenueCat(session.user.id)` → awaits `initPromise` → `Purchases.logIn()` → triggers listener with merged customer info
- RevenueCat purchase → webhook POST → Zod validation → timing-safe auth → `process_revenuecat_event()` RPC → atomic idempotency check + user upsert
- `PremiumGuard` reads `users.subscription_tier` (cached per-request on `req._subscriptionTier`)

### Error Propagation

- `initRevenueCat()` catches all errors — app continues as free tier if SDK fails. Promise resolves to `null`.
- `loginRevenueCat()` awaits init promise — if init failed, returns immediately (no SDK calls on unconfigured SDK)
- Webhook failures: controller returns 500 → RevenueCat retries 5x (5, 10, 20, 40, 80 min). No silent data loss.
- `PremiumGuard` DB failure → `InternalServerErrorException` (not `ForbiddenException` — don't punish paying users for DB issues)

### State Lifecycle Risks

- **Race condition:** `loginRevenueCat()` awaits shared `initPromise` — cannot outrun `configure()`. ✅ FIXED
- **Webhook atomicity:** Idempotency check + user upsert in single RPC transaction — no partial state. ✅ FIXED
- **Stale Zustand cache:** `isVerified` starts `false`, set to `true` only after fresh `getCustomerInfo()`. UI shows loading until verified. ✅ FIXED
- **Listener leak:** `initRevenueCat()` returns cleanup function, wired into useEffect return. ✅ FIXED
- **Double login:** Removed `loginRevenueCat` from `getSession().then()` — rely on `onAuthStateChange(INITIAL_SESSION)`. ✅ FIXED

### API Surface Parity

- Mobile client uses `useSubscriptionStore` for UI gating (cache, overridden by fresh SDK data)
- API uses `PremiumGuard` + DB check for server-side gating (source of truth for access control)
- Both derive from RevenueCat (client via SDK, server via webhooks)

## Dependencies & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| RevenueCat API keys not configured | High | Graceful fallback — log warning, app works as free tier |
| Expo Go can't run purchases | Medium | `isExpoGo()` guard, dynamic import |
| Webhook endpoint brute-force | Medium | Timing-safe auth + @Throttle(30/min) |
| RevenueCat REST API rate limits | Low | Use event payload data directly; REST API only for reconciliation |
| Development build required for testing | Medium | EAS development build profile |
| Out-of-order webhook events | Low | RPC function derives state from event type directly |
| Stale Zustand isPro cache | Medium | `isVerified` flag + fresh getCustomerInfo on launch |

## Implementation Order

1. **Phase 0**: Extract `REVENUECAT_ENTITLEMENT_PRO` constant
2. **Phase 1.1**: Config plugin + Kotlin version
3. **Phase 1.2**: Rewrite `subscription.ts` with promise-based init
4. **Phase 1.3**: Update subscription store with `isVerified`
5. **Phase 1.4**: Wire into root layout (init + auth hooks)
6. **Phase 2.1**: Add env vars to `env.validation.ts`
7. **Phase 2.3**: Create webhook module (controller + service + DTO)
8. **Phase 2.4**: Database migration (idempotency table + RPC + RLS fixes)
9. **Phase 2.5**: Register webhook module in AppModule
10. **Phase 3.1-3.2**: Feature gating (server + client)
11. **Phase 4.1**: Post-onboarding upgrade sheet
12. **Phase 5.1-5.2**: Codegen + development build

## Files to Create

- `packages/types/src/constants/subscription.ts`
- `apps/api/src/modules/webhooks/webhooks.module.ts`
- `apps/api/src/modules/webhooks/revenuecat.controller.ts`
- `apps/api/src/modules/webhooks/revenuecat.service.ts`
- `apps/api/src/modules/webhooks/dto/revenuecat-event.dto.ts`
- `apps/api/src/common/guards/premium.guard.ts`
- `apps/mobile/src/app/(tabs)/(profile)/upgrade.tsx`
- `supabase/migrations/00031_revenuecat_webhook_processing.sql`

## Files to Modify

- `packages/types/src/index.ts` — export `REVENUECAT_ENTITLEMENT_PRO`
- `apps/mobile/app.config.ts` — add RC plugin + Kotlin version
- `apps/mobile/src/app/_layout.tsx` — add init call with cleanup + logIn/logOut in auth listener
- `apps/mobile/src/lib/subscription.ts` — full rewrite with promise-based init
- `apps/mobile/src/stores/subscription.store.ts` — add `isVerified` field
- `apps/mobile/src/app/(tabs)/(profile)/_layout.tsx` — add upgrade Stack.Screen
- `apps/api/src/config/env.validation.ts` — add RC env vars
- `apps/api/src/app.module.ts` — register WebhooksModule

## Sources & References

- [RevenueCat Expo Installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat REST API v1](https://www.revenuecat.com/docs/api-v1)
- [RevenueCat Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements)
- [RevenueCat Error Handling](https://www.revenuecat.com/docs/getting-started/making-purchases)
- Linear: [MOT-117](https://linear.app/lominic/issue/MOT-117/initialize-revenuecat-sdk-and-wire-subscription-system)
- Prior plans: `docs/plans/2026-03-09-feat-onboarding-redesign-paywall-monetization-plan.md`
- Learning: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- Learning: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
