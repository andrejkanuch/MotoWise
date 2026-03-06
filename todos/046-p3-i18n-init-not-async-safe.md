# P3: i18n initialization is synchronous but i18next.init() returns a Promise

## Location
`apps/mobile/src/i18n/index.ts` line 15

## Problem
`i18n.use(initReactI18next).init({...})` returns a Promise, but the result is not awaited. The module is imported at the top of `_layout.tsx` as a side-effect import (`import '../i18n'`), which means the init may not be complete before the first render.

In practice, this works because:
1. `react: { useSuspense: false }` is set, so components won't suspend
2. The resources are bundled (not loaded from network), so init is effectively synchronous
3. i18next handles this case gracefully by queuing translations

However, it is technically a race condition. If resources were ever loaded asynchronously (e.g., lazy-loaded translations for bundle size), this would break.

## Fix
Low priority. Either:
- Add `.then()` error handling: `.init({...}).catch(console.error)`
- Or document that this is intentionally fire-and-forget because resources are bundled
