---
title: "zod 3 -> 4: validators that kept passing tests but changed what they accept or return"
category: integration-issues
date: 2026-11-03
tags: [zod, zod-4, validation, partial, default, uuid, datetime, renovate, dependency-upgrade]
modules: [packages/types, apps/api]
symptom: "After the zod 4 bump, a partial update parsed { id } into create-time defaults and would overwrite omitted fields; UUID fixtures like 11111111-1111-1111-1111-111111111111 started failing"
---

# zod 3 -> 4: validators that kept passing tests but changed behavior

## Problem

The zod 4 upgrade (PR #355, GHSA-mrhx-c7xc-m3w5) compiled and every suite passed, but three zod 4 semantics changed what our schemas accept or return:

1. **`.partial()` (and any `.optional()` wrapping a `.default()`) now applies the default.** zod 3 returned `undefined` for a missing key; zod 4 fills the default. `UpdateBlogPostInputSchema = BlogPostInputObject.partial()` turned `updateBlogPost({ id, coverImage })` into `specData: false, isSafetyCritical: false, categoryIds: [], keywordIds: []`. `BlogService.update` writes every key that is not `undefined`, so a partial update would have reset both flags and wiped the post's taxonomy. No test noticed, because the only caller (the admin editor) sends every field.
2. **A `.transform()` after `.optional()` makes the object key required in the inferred type.** `nullishToUndefined` had to move `.optional()` after the transform to keep `T | undefined` keys.
3. **`z.string().uuid()` checks the RFC 9562 version and variant nibbles.** Placeholder ids like `11111111-1111-1111-1111-111111111111` are rejected (the nil and max UUIDs are still accepted). It also runs on env at boot: `REVENUECAT_SANDBOX_ALLOWED_USER_IDS` must hold real UUIDs, or the API will not start.

Also stricter, and harmless for our clients: `z.string().datetime()` rejects times without seconds and offsets without a colon (`+0200`).

## Solution

- Build update schemas from a base object **without** defaults, and add the defaults only for create (`packages/types/src/validators/blog-post.ts`: `BlogPostBaseObject` -> `BlogPostInputObject` -> `CreateBlogPostInputSchema`; `UpdateBlogPostInputSchema = BlogPostBaseObject.partial()`).
- Pin it with a test: `UpdateBlogPostInputSchema.parse({ id })` must equal `{ id }` (`packages/types/src/validators/__tests__/blog-post.test.ts`).
- Put `.optional()` last when a field also transforms (`packages/types/src/validators/nullish.ts`).
- Use real v4 UUIDs in fixtures (`xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx`).

## Prevention

- After a validator-library major, scan the exported schemas, not only the call sites the compiler flags: walk every exported zod schema and list each `optional` whose inner type (through `pipe`, `nullable`, `readonly`) is a `default` or `prefault`. After the fix that list was empty for `@motovault/types`.
- For every `Update*` schema, test that parsing `{ id }` returns `{ id }`.
- Treat env validators as boot-time validators: a stricter schema can stop the API from starting, so check the live values before merging.
