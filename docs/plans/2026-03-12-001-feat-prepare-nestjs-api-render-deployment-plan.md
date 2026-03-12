---
title: "feat: Prepare NestJS API for Render.com deployment"
type: feat
status: completed
date: 2026-03-12
---

# Prepare NestJS API for Render.com Deployment

## Overview

Deploy the NestJS 11 API (`apps/api`) to Render.com with a multi-stage Docker build, health checks, graceful shutdown, and production hardening. The monorepo uses Turborepo + pnpm workspaces, so the build must handle workspace dependency resolution correctly.

## Problem Statement

The API has no deployment configuration. It runs locally via `nest start --watch --exec tsx` but has no Dockerfile, no health check endpoint, no production start command, and several runtime issues that will cause crashes in a containerized environment.

## Critical Blockers (Must Resolve First)

### 1. `@motovault/types` has no build step

The types package exports raw `.ts` files (`"exports": { ".": "./src/index.ts" }`). Node.js cannot import `.ts` files at runtime. When `nest build` compiles the API, the emitted JS contains `require("@motovault/types")` which resolves to raw TypeScript.

**Fix:** Add a `tsup` build step to `@motovault/types` that emits JS + declaration files, and update its `exports` map to point to compiled output.

```json
// packages/types/package.json (updated)
{
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./constants/*": { "import": "./dist/constants/*.js", "types": "./dist/constants/*.d.ts" },
    "./validators/*": { "import": "./dist/validators/*.js", "types": "./dist/validators/*.d.ts" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean"
  }
}
```

### 2. Verify `dist/` output structure

The current `"start": "node dist/main"` is likely wrong. With `rootDir: "."` in tsconfig, `tsc` outputs to `dist/src/main.js`. Must verify by running `nest build` locally.

- [x] Run `pnpm --filter @motovault/api build` and inspect `apps/api/dist/`
- [x] Update start command to match actual output path
- [x] Update Dockerfile CMD accordingly

### 3. Verify `@/` path aliases resolve at runtime

The API tsconfig has `"paths": { "@/*": ["./src/*"] }`. `tsc` does NOT rewrite path aliases in emitted JS. If any source file uses `@/` imports, they will fail at runtime.

- [x] Search for `@/` imports in `apps/api/src/`: `grep -r "from '@/" apps/api/src/`
- [x] If found: add `tsc-alias` as a post-build step, or convert to relative imports

## Phase 1: Build Infrastructure

### 1.1 Add build step to `@motovault/types`

**File:** `packages/types/package.json`

- [x] Add `tsup` as devDependency
- [x] Add `"build"` script: `tsup src/index.ts --format esm --dts --clean`
- [x] Update `exports` map to point to `./dist/` output
- [x] Verify `turbo build` compiles types before API (dependency order)
- [x] Update turbo.json if needed to include types in API's `dependsOn`

### 1.2 Create `.dockerignore`

**File:** `.dockerignore` (repo root)

```
node_modules
.git
.github
**/dist
**/.next
**/.turbo
**/.expo
**/coverage
**/ios
**/android
*.md
.env*
.claude/
todos/
docs/
```

### 1.3 Create Dockerfile

**File:** `apps/api/Dockerfile`

Multi-stage build with 4 stages:
1. **base** — Node 20-slim + corepack + pnpm
2. **prune** — `turbo prune @motovault/api --docker` generates minimal monorepo
3. **installer** — `pnpm install --frozen-lockfile` + `pnpm turbo build --filter=@motovault/api`
4. **runner** — Node 20-slim + `dumb-init` + non-root user + compiled output only

Key decisions:
- Use `dumb-init` as PID 1 for proper signal forwarding (SIGTERM → graceful shutdown)
- Use `--mount=type=cache,id=pnpm,target=/pnpm/store` for pnpm store caching
- Run as non-root `nestjs:1001` user
- Pin pnpm version from `packageManager` field in root `package.json`

### 1.4 Create `render.yaml`

**File:** `render.yaml` (repo root)

```yaml
services:
  - type: web
    name: motovault-api
    runtime: docker
    plan: starter
    region: frankfurt
    dockerfilePath: ./apps/api/Dockerfile
    dockerContext: .
    healthCheckPath: /health
    maxShutdownDelaySeconds: 30
    autoDeploy: true
    buildFilter:
      paths:
        - apps/api/**
        - packages/types/**
        - packages/tsconfig/**
        - pnpm-lock.yaml
        - turbo.json
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "10000"
      - fromGroup: motovault-secrets

envVarGroups:
  - name: motovault-secrets
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: REVENUECAT_SECRET_API_KEY
        sync: false
      - key: REVENUECAT_WEBHOOK_SECRET
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: CORS_ORIGINS
        sync: false
```

## Phase 2: NestJS Production Hardening

### 2.1 Health check endpoint

**New files:**
- `apps/api/src/modules/health/health.module.ts`
- `apps/api/src/modules/health/health.controller.ts`

- [x] Install `@nestjs/terminus`
- [x] Create `HealthModule` with `HealthController`
- [x] `GET /health` returns 200 with memory checks (heap < 250MB, RSS < 512MB)
- [x] Add lightweight Supabase connectivity check (select 1 via admin client)
- [x] Register `HealthModule` in `AppModule` imports
- [x] Health endpoint is a REST controller (not GraphQL) — Render hits it directly

### 2.2 Harden `main.ts`

**File:** `apps/api/src/main.ts`

- [x] Add `app.enableShutdownHooks()` for graceful shutdown on SIGTERM
- [x] Bind to `'0.0.0.0'` (required by Render — `app.listen(port, '0.0.0.0')`)
- [x] Enable `trust proxy` for correct client IP behind Render's load balancer: `app.getHttpAdapter().getInstance().set('trust proxy', 1)` — critical for rate limiting
- [x] Switch `autoSchemaFile` to in-memory for production: `autoSchemaFile: process.env.NODE_ENV === 'production' ? true : join(process.cwd(), 'schema.graphql')`

### 2.3 Fix start command

**File:** `apps/api/package.json`

- [x] Verify actual `dist/` structure after `nest build`
- [x] Update `"start:prod"` to correct path (likely `node dist/src/main.js`)
- [x] Dockerfile CMD matches this path

## Phase 3: Environment & Configuration

### 3.1 Environment variables

**Required (crash if missing):**

| Variable | Source | Notes |
|----------|--------|-------|
| `SUPABASE_URL` | Supabase dashboard | Project URL |
| `SUPABASE_ANON_KEY` | Supabase dashboard | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | Service role (NEVER expose to clients) |
| `SUPABASE_JWT_SECRET` | Supabase dashboard | For JWT validation via `jose` |
| `ANTHROPIC_API_KEY` | Anthropic dashboard | Claude API key |

**Required in production (have wrong defaults):**

| Variable | Default | Production Value |
|----------|---------|-----------------|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `4000` | `10000` (Render provides) |
| `CORS_ORIGINS` | `localhost:8081,localhost:3000` | Actual mobile/web origins |

**Optional (have sensible defaults):**

| Variable | Default | Notes |
|----------|---------|-------|
| `REVENUECAT_SECRET_API_KEY` | — | Subscription cancellation on account deletion |
| `REVENUECAT_WEBHOOK_SECRET` | — | Webhook signature verification |
| `RESEND_API_KEY` | — | Email sending |
| `GRAPHQL_PLAYGROUND` | disabled | Enable with `true` for debugging |
| `THROTTLE_TTL` | `60000` | Rate limit window (ms) |
| `THROTTLE_LIMIT` | `100` | Requests per window |
| `THROTTLE_AI_LIMIT` | `10` | AI requests per window |

### 3.2 Validate undocumented env vars

- [x] Add `GRAPHQL_PLAYGROUND`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, `THROTTLE_AI_LIMIT` to the Zod validation schema in `env.validation.ts` with their defaults
- [x] Ensure `CORS_ORIGINS` is validated (currently read directly from `process.env`)

## Phase 4: Verification

### 4.1 Local Docker build test

- [x] `docker build -t motovault-api -f apps/api/Dockerfile .`
- [x] `docker run -p 10000:10000 --env-file apps/api/.env motovault-api`
- [x] Verify `/health` returns 200
- [x] Verify `/graphql` accepts a query
- [x] Verify SIGTERM triggers graceful shutdown (`docker stop`)

### 4.2 Deploy runbook

1. Apply any pending Supabase migrations: `npx supabase db push`
2. Merge to `main` (or push to deploy branch)
3. Render auto-detects change, triggers Docker build
4. Render hits `/health` — if 200, routes traffic to new container
5. Old container receives SIGTERM, drains for 30s, then dies
6. Smoke-test: `curl https://motovault-api.onrender.com/health`

## Technical Considerations

### Performance
- Multi-stage Docker build with `turbo prune` minimizes image size (~150MB vs ~1GB naive)
- pnpm store cache persists between builds (faster installs)
- Health check adds ~2ms overhead per probe (memory checks only)

### Security
- Non-root user in container (`nestjs:1001`)
- Helmet enabled with default CSP in production
- GraphQL introspection disabled in production
- `trust proxy` enabled for correct IP-based rate limiting
- Secrets managed via Render env groups (never in code)
- `NODE_ENV=production` explicitly set (not relying on default)

### Graceful shutdown
- `dumb-init` forwards SIGTERM to Node process
- `enableShutdownHooks()` triggers NestJS lifecycle hooks
- 30s grace period in `render.yaml` accommodates most requests
- Long-running AI requests (10-30s) may be interrupted during deploys — acceptable tradeoff
- RevenueCat webhook idempotency (ON CONFLICT DO NOTHING) handles duplicate deliveries after restart

### autoSchemaFile
- Production: `autoSchemaFile: true` (in-memory, no filesystem write)
- Development: `autoSchemaFile: join(process.cwd(), 'schema.graphql')` (for codegen)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/types/package.json` | Modify | Add tsup build step + update exports |
| `packages/types/tsup.config.ts` | Create | tsup configuration |
| `.dockerignore` | Create | Docker build exclusions |
| `apps/api/Dockerfile` | Create | Multi-stage Docker build |
| `render.yaml` | Create | Render blueprint |
| `apps/api/src/modules/health/health.module.ts` | Create | Terminus health module |
| `apps/api/src/modules/health/health.controller.ts` | Create | /health endpoint |
| `apps/api/src/main.ts` | Modify | Shutdown hooks, 0.0.0.0, trust proxy |
| `apps/api/src/app.module.ts` | Modify | Import HealthModule, conditional autoSchemaFile |
| `apps/api/package.json` | Modify | Fix start:prod command |
| `apps/api/src/config/env.validation.ts` | Modify | Add undocumented env vars to Zod schema |

## Acceptance Criteria

- [x] `docker build` succeeds from repo root
- [x] Container starts and `/health` returns 200
- [x] GraphQL queries work via `/graphql`
- [x] `SIGTERM` triggers graceful shutdown (verified via `docker stop`)
- [x] No raw `.ts` files imported at runtime
- [x] `render.yaml` validates (Render blueprint spec)
- [x] All required env vars documented
- [x] Rate limiting works correctly behind proxy (uses real client IPs)
- [x] `pnpm turbo build` compiles types package before API

## Out of Scope (Follow-up)

- Sentry integration for API (separate ticket)
- CI/CD pipeline (GitHub Actions)
- Custom domain + SSL (Render handles TLS termination)
- Horizontal scaling / multiple instances (circuit breaker already flagged)
- CDN / caching layer
- Staging environment

## Sources

- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker)
- [NestJS Terminus Health Checks](https://docs.nestjs.com/recipes/terminus)
- [pnpm Docker Documentation](https://pnpm.io/docker)
- Existing patterns: `apps/api/src/main.ts`, `apps/api/src/config/env.validation.ts`
