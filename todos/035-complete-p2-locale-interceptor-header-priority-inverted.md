# P2: LocaleInterceptor header priority is inverted

## Location
`apps/api/src/common/interceptors/locale.interceptor.ts` line 11-13

## Problem
The interceptor prefers `Accept-Language` over `x-locale`:
```ts
const raw = acceptLang ?? xLocale ?? 'en';
```

This is backwards for this use case. `x-locale` is the explicit user preference (set when the user picks a language in their profile). `Accept-Language` is the browser/device default and is often sent automatically. A user who explicitly selects German in the app but whose device sends `Accept-Language: en` will always get English.

The test at line 39-44 ("should prefer Accept-Language over x-locale") encodes this wrong priority as intended behavior.

## Fix
Swap priority: `const raw = xLocale ?? acceptLang ?? 'en';`
Update the corresponding test to expect `x-locale` to win.
