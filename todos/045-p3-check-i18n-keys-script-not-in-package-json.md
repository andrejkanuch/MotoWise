# P3: check-i18n-keys script not registered in package.json

## Location
`scripts/check-i18n-keys.ts`

## Problem
The i18n key sync checker script exists but is not registered as a script in the root `package.json` or in a CI step. Developers must know to run `npx tsx scripts/check-i18n-keys.ts` manually. This means translation key mismatches can easily be committed without detection.

## Fix
Add to root `package.json` scripts:
```json
"check:i18n": "tsx scripts/check-i18n-keys.ts"
```
Ideally also add it to the CI pipeline as a lint check, or integrate it into the `pnpm lint` task.
