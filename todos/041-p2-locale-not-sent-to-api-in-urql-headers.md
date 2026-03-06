# P2: Mobile app does not send locale to API in GraphQL request headers

## Location
- `apps/mobile/src/stores/auth.store.ts`
- `apps/mobile/src/lib/urql.ts` (not modified in this PR)

## Problem
The API's `LocaleInterceptor` reads `x-locale` or `Accept-Language` headers to determine the request locale. However, the mobile app never sends either header. The urql client setup was not modified in this PR to include the locale from the auth store.

This means the API will always fall back to the device's `Accept-Language` (if the HTTP client sends it) or default to `'en'`. The user's explicit language selection in the profile screen has no effect on API responses.

## Fix
Modify the urql client configuration (likely in `apps/mobile/src/lib/urql.ts`) to include the current locale in request headers:
```ts
headers: {
  'x-locale': useAuthStore.getState().locale,
}
```
This should be done in a `fetchExchange` options or via a custom exchange that reads from the store on each request.
