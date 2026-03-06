# P3: LocaleInterceptor does not guard against oversized header values

## Location
`apps/api/src/common/interceptors/locale.interceptor.ts` line 11-12

## Problem
The interceptor reads `Accept-Language` and `x-locale` headers directly and passes them through `.split()` before Zod validation. While Zod's `z.enum()` with `.catch('en')` prevents any invalid value from being used (so there is no injection risk), the code does not limit the input length before processing.

An attacker could send a multi-megabyte `Accept-Language` header. The `.split(',')[0]?.split('-')[0]` operations would first create a large array in memory before extracting the first element. This is a low-severity DoS vector since NestJS/Express has default header size limits (~8KB), but adding a `.slice(0, 10)` or similar guard before splitting would be a defense-in-depth measure.

## Fix
Add a length check: `const raw = (acceptLang ?? xLocale ?? 'en').slice(0, 5);` since valid locale codes are 2-3 characters.
