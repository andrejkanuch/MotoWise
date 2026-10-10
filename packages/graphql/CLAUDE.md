# GraphQL Package — @motovault/graphql

## Purpose
Generated GraphQL client types (TypedDocumentNode) consumed by the mobile and web apps (TanStack Query + graphql-request).

## Pipeline
1. NestJS API generates `schema.graphql` (code-first, `autoSchemaFile`)
2. Apps define `.graphql` operation files in `apps/mobile/src/graphql/` and `apps/web/src/graphql/`
3. `graphql-codegen` reads schema + operations and generates TypedDocumentNode types here

## Commands
- `pnpm generate` — full pipeline (DB types + schema + codegen); run it after changing any resolver or `.graphql` file
- Files in `src/generated/` are auto-generated — do NOT edit manually

## Rules
- Never import from this package in the API (circular dependency)
- GraphQL operations live in each app, not here
- Every `.graphql` document must validate against the schema (pre-commit runs codegen)
- Scalar mappings: UUID->string, DateTime->string, JSON->Record<string, unknown>

## Type safety (in the apps)
- ALWAYS use generated types from @motovault/graphql — NEVER use `any` for GraphQL query/mutation data
- Import result types: `import { type MyRidesQuery, MyRidesDocument } from '@motovault/graphql'`; extract nested ones: `type RideEdge = MyRidesQuery['myRides']['edges'][number]`
- `gqlFetcher(Document)` returns the typed result — use `useQuery<MyRidesQuery>(...)` or `useInfiniteQuery<MyRidesQuery>(...)`
- TypedDocumentNode carries result AND variables types — no manual annotations on variables
