# GraphQL Package — @motolearn/graphql

## Purpose
Generated GraphQL client types (TypedDocumentNode) consumed by mobile and admin apps via urql.

## Pipeline
1. NestJS API generates `schema.graphql` (code-first, `autoSchemaFile`)
2. Apps define `.graphql` operation files in their `src/graphql/` dirs
3. `graphql-codegen` reads schema + operations and generates TypedDocumentNode types here
4. Mobile and admin import from `@motolearn/graphql`

## Commands
- `pnpm generate` — runs full pipeline (schema + codegen)
- Files in `src/generated/` are auto-generated — do NOT edit manually

## Rules
- Never import from this package in the API (circular dependency)
- GraphQL operations live in each app, not here
- Scalar mappings: UUID->string, DateTime->string, JSON->Record<string, unknown>
