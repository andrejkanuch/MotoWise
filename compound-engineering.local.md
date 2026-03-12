---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
  - code-simplicity-reviewer
---

## Review Context

This is a Turborepo monorepo with three apps:

- **apps/mobile**: Expo 55 (React Native 0.83, React 19) — user-facing mobile app
- **apps/api**: NestJS 11 — GraphQL API (code-first, Apollo Server) with Claude AI integration
- **apps/web**: Next.js 16 — public pages + admin dashboard

### Key Conventions

- TypeScript throughout, strict mode
- Biome for linting/formatting (not ESLint/Prettier)
- `as const` objects instead of TypeScript `enum`
- Zod schemas for validation at API boundaries
- Types flow ONE direction: `packages/` → `apps/` (never reverse)
- Database columns: snake_case; TypeScript/GraphQL: camelCase
- Supabase with RLS policies on all tables
- Auth: Supabase Auth + JWT validation via `jose` in NestJS
- Mobile: TanStack Query v5 + graphql-request, Zustand for local state
- Tokens stored in expo-secure-store (never AsyncStorage)
- RevenueCat for subscriptions, Sentry for crash reporting, PostHog for analytics
