# P3: Mixed test runners -- mobile uses Jest mock syntax, API uses Vitest

## Location
- `apps/mobile/src/__tests__/i18n.test.ts` line 1: `jest.mock('expo-localization', ...)`
- `apps/api/src/common/interceptors/locale.interceptor.spec.ts`: imports from `vitest`

## Problem
This is not a bug introduced by this PR (the mobile app already uses Jest per `package.json`), but the test file uses bare `jest.mock()` without importing it, relying on Jest globals. The `describe`/`it`/`expect` functions are also used without imports, relying on Jest's global injection.

The API test correctly imports `{ describe, expect, it, vi }` from `vitest`.

This is consistent with the existing project setup (mobile = Jest, API = Vitest), so it follows conventions. No action required unless the project wants to unify test runners.

## Status
Informational -- no fix needed. The split is intentional per the project's existing configuration.
