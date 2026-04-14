## Summary

<!-- What changed and why (1–3 sentences) -->

## Checklist

- [ ] **GraphQL**: If you changed resolvers, `schema.graphql`, or any `*.graphql` file — ran `pnpm generate` and included `packages/graphql/src/generated/**` if it changed
- [ ] **DB**: If you changed Supabase schema — migration in `supabase/migrations/` and did not hand-edit `database.types.ts`
- [ ] **Types**: Shared shapes / validation live in `@motovault/types` (Zod + inferred types), not duplicated in apps
- [ ] **Lint**: `pnpm lint` passes (or scoped fixes only — avoid widening unrelated Biome changes in the same PR)
- [ ] **Env**: Documented new env vars in the relevant `apps/*/.env.example` (no secrets committed)
