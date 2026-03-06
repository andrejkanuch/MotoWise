# P2: GqlSupportedLocale enum values manually duplicated, no sync guard

## Location
`apps/api/src/common/enums/graphql-enums.ts` lines 64-68

## Problem
The `GqlSupportedLocale` enum manually lists `en`, `es`, `de`:
```ts
export enum GqlSupportedLocale {
  en = 'en',
  es = 'es',
  de = 'de',
}
```

This duplicates the values from `SUPPORTED_LOCALES` in `@motolearn/types`. If a new locale is added to `SUPPORTED_LOCALES`, the developer must remember to also update this enum. There is no compile-time or runtime check that they stay in sync.

The existing comment at the top of the file acknowledges this ("string values here MUST stay in sync"), but the other enums in the file have the same problem. For the i18n feature specifically, adding a new locale is a likely future operation.

## Fix
Add a type-level assertion after the enum:
```ts
const _localeSync: Record<SupportedLocale, GqlSupportedLocale> = {
  en: GqlSupportedLocale.en,
  es: GqlSupportedLocale.es,
  de: GqlSupportedLocale.de,
};
```
This will cause a compile error if `SUPPORTED_LOCALES` gains a value not present in the enum.
