# P2: Duplicate SupportedLocale type export causes ambiguity

## Location
- `packages/types/src/constants/enums.ts` line 52
- `packages/types/src/validators/locale.ts` line 5

## Problem
`SupportedLocale` is exported as a type from two files:
1. `enums.ts`: `export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];`
2. `locale.ts`: `export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;`

Both are re-exported from `packages/types/src/index.ts`, which creates a duplicate identifier. While they resolve to the same type structurally, this will cause a TypeScript compilation error or at minimum confusing auto-import behavior. Consumers importing `SupportedLocale` from `@motovault/types` will get a "has or is using name from two declarations" warning in some TS configurations.

## Fix
Remove the type export from `validators/locale.ts` and only export the Zod schema from there. The canonical type should come from `enums.ts` (consistent with other enum types in the file). Alternatively, remove it from `enums.ts` and keep only the Zod-inferred version (per the CLAUDE.md rule "always export both Zod schema AND inferred type"), but then consumers needing just the type would pull in Zod.

Recommended: keep the type in `enums.ts`, remove the `export type` line from `locale.ts`.
