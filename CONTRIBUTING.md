# Contributing

## GraphQL schema and clients

The mobile and web apps consume a **generated** client from `packages/graphql`. The schema file used for codegen is `apps/api/schema.graphql`.

After you change any of the following, run **`pnpm generate`** from the repo root and commit the updated generated output:

- `apps/api/schema.graphql` (usually produced by `pnpm --filter @motovault/api generate:schema` after resolver changes)
- `apps/mobile/src/graphql/**/*.graphql`
- `apps/web/src/graphql/**/*.graphql`

Typical flow when adding a field or operation:

1. Implement or update the Nest resolver and DTOs in `apps/api`.
2. Regenerate the schema: `pnpm --filter @motovault/api generate:schema` (or let CI catch drift—`pnpm generate` depends on this in Turbo).
3. Run `pnpm generate` so `packages/graphql/src/generated/` updates for mobile and web.
4. Typecheck: `pnpm typecheck` and run tests as needed.

If you commit `.graphql` or `schema.graphql` changes, the **pre-commit** hook verifies that running codegen does not leave `packages/graphql/src/generated` dirty.

## TypeScript versions

The repo root and several packages use TypeScript **~5.7**. **`apps/mobile` uses ~5.9** because `tsc` against Expo’s dependency graph currently fails on **5.7** (for example `expo-file-system` `ReadableStream` typings). Keep mobile on 5.9 until Expo aligns; treat **5.7 everywhere else + 5.9 on mobile** as the intentional split.

## Monorepo commands

| Command | Purpose |
| --- | --- |
| `pnpm precheck` | Lint, typecheck, and test (also runs on `git push` via `.githooks/pre-push`) |
| `pnpm generate` | GraphQL client + related codegen via Turbo |
