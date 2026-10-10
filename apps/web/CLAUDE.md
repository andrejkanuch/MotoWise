# Web — Next.js 16

## Commands
- `pnpm --filter @motovault/web dev` — start dev server (port 3000)
- `pnpm --filter @motovault/web build` — production build
- `pnpm --filter @motovault/web test` — Vitest tests

## Architecture
- Next.js 16 with App Router and Turbopack
- Supabase SSR auth via @supabase/ssr
- `graphql-request` + TanStack Query for the GraphQL client
- Public pages at root, admin pages under /admin (protected in `src/proxy.ts`; Next 16 has no `middleware.ts` here)
- Admin access requires role='admin' from public.users

## Patterns
- Server components by default; 'use client' only when needed
- Admin role check in `src/proxy.ts` for /admin/* routes
- Security headers configured in next.config.ts
- Import types from @motovault/types and @motovault/graphql

## Common Mistakes
- Forgetting 'use client' on components using hooks
- Not checking admin role before rendering admin pages
- Using client-side Supabase where server-side should be used
- Mapbox: `MAPBOX_ACCESS_TOKEN` is server-only (static previews). **Interactive** `mapbox-gl` needs `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` (see `.env.example`)
