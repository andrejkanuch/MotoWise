# Admin — Next.js 16

## Commands
- `pnpm --filter admin dev` — start dev server (port 3000)
- `pnpm --filter admin build` — production build
- `pnpm --filter admin test` — Vitest tests

## Architecture
- Next.js 16 with App Router and Turbopack
- Supabase SSR auth via @supabase/ssr
- urql for GraphQL client
- Admin-only access (checks role='admin' from public.users)

## Patterns
- Server components by default; 'use client' only when needed
- Admin role check in middleware/proxy
- Security headers configured in next.config.ts
- Import types from @motolearn/types and @motolearn/graphql

## Common Mistakes
- Forgetting 'use client' on components using hooks
- Not checking admin role before rendering admin pages
- Using client-side Supabase where server-side should be used
