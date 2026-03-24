---
title: Redis-backed infrastructure and backend hardening
category: runtime-errors
date: 2026-03-22
tags: [redis, upstash, circuit-breaker, rate-limiting, throttler, fire-and-forget, correlation-id, constants, nestjs, zod]
affected_modules: [ai-budget, redis, articles, diagnostics, insights, rides, webhooks, waitlist, share-links, config]
---

## Problem

Multiple backend anti-patterns identified during maintenance review:

1. **In-memory circuit breaker** (`AiBudgetService.circuitBreakerOpen`) — state lost on restart, invisible across instances
2. **In-memory rate limiting** (`@nestjs/throttler` default storage) — per-instance counters, ineffective under load balancing
3. **Fire-and-forget DB writes** — 7 `.then()` calls with no `.catch()`, silently losing AI cost logs and view counts
4. **No request tracing** — no correlation IDs in logs, impossible to trace requests end-to-end
5. **Magic numbers scattered** — 30+ hardcoded limits, costs, timeouts, and model names duplicated across services
6. **Zod env validation crash on empty strings** — `z.string().min(1).optional()` fails when env var is set but empty (`VAR=`)

## Root Cause

- Circuit breaker and throttler used NestJS defaults (in-memory `Map`) with no shared state store
- Fire-and-forget pattern was intentional (non-blocking logging) but lacked any error observation
- No interceptor existed for request tracing
- Constants were defined locally in each service file, leading to duplication and drift risk
- Zod's `.optional()` only handles `undefined`, not empty strings — env vars are always strings, so `""` passes optional but fails `min(1)`

## Solution

### 1. Upstash Redis module (`modules/redis/`)

- `redis.constants.ts` — `REDIS` DI token
- `redis.module.ts` — `@Global()` module, creates `@upstash/redis` REST client, returns `null` if env vars missing
- `redis-throttler.storage.ts` — implements `ThrottlerStorage` interface with Redis INCR/EXPIRE, falls back to in-memory Map

### 2. Circuit breaker on Redis (`ai-budget.service.ts`)

```typescript
// Reads from Redis key 'ai:circuit_breaker', falls back to in-memory boolean
private async isCircuitBreakerOpen(): Promise<boolean> {
  if (!this.redis) return this.circuitBreakerFallback;
  const value = await this.redis.get<string>(CIRCUIT_BREAKER_KEY);
  return value === 'open';
}

// 24h auto-expire safety net
await this.redis.set(CIRCUIT_BREAKER_KEY, 'open', { ex: DURATIONS.CIRCUIT_BREAKER_EXPIRE_SECONDS });
```

### 3. Fire-and-forget error handling (7 fixes)

All `.then()` calls now observe errors:

```typescript
.then(({ error }) => {
  if (error) this.logger.error('Failed to log diagnostic generation', error);
});
```

Applied to: `diagnostic-ai.service.ts` (2), `article-generator.service.ts` (3), `articles.service.ts` (2)

### 4. Correlation ID interceptor

```typescript
// Extracts x-request-id or generates UUID, logs operation + duration
req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
req.res?.setHeader('x-request-id', requestId);
// Logs: [abc-123] generateArticle 450ms
```

### 5. Centralized constants (`config/constants.ts`)

Single source of truth for: `AI_MODELS`, `AI_CLIENT`, `AI_TOKEN_LIMITS`, `AI_COSTS`, `THROTTLE_PRESETS`, `QUERY_LIMITS`, `DURATIONS`, `VALIDATION`, `CONTENT`

### 6. Zod empty string fix (`config/env.validation.ts`)

```typescript
const optionalString = z.string().min(1).optional().or(z.literal('').transform(() => undefined));
const optionalUrl = z.string().url().optional().or(z.literal('').transform(() => undefined));
```

## Prevention

- When adding new optional env vars, always use the `optionalString`/`optionalUrl` helpers — never raw `z.string().min(1).optional()`
- When adding new AI models/costs/limits, add them to `config/constants.ts` rather than defining locally
- When writing fire-and-forget Supabase calls, always add `.then(({ error }) => { if (error) this.logger.error(...) })`
- Before horizontal scaling, verify Redis is configured (circuit breaker + throttler both require it)
