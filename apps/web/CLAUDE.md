# Web — Next.js 16

## Commands
- `pnpm --filter web dev` — start dev server (port 3000)
- `pnpm --filter web build` — production build
- `pnpm --filter web test` — Vitest tests

## Architecture
- Next.js 16 with App Router and Turbopack
- Supabase SSR auth via @supabase/ssr
- urql for GraphQL client
- Public pages at root, admin pages under /admin (protected by middleware)
- Admin access requires role='admin' from public.users

## Patterns
- Server components by default; 'use client' only when needed
- Admin role check in middleware for /admin/* routes
- Security headers configured in next.config.ts
- Import types from @motolearn/types and @motolearn/graphql

## Common Mistakes
- Forgetting 'use client' on components using hooks
- Not checking admin role before rendering admin pages
- Using client-side Supabase where server-side should be used
