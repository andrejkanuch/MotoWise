---
title: "Metro can't resolve zod from @motovault/types dist/ output"
category: build-errors
date: 2026-04-08
tags: [metro, monorepo, pnpm, zod, workspace, expo, bundler]
components: [apps/mobile, packages/types]
---

# Metro can't resolve `zod` from workspace package dist/

## Problem

Red screen on iOS simulator:
```
Unable to resolve module zod from /Users/.../packages/types/dist/chunk-OZTGK3L7.mjs:
zod could not be found within the project or in these directories:
  node_modules
  ../../node_modules
```

Metro bundler fails to resolve `zod` when importing from `@motovault/types`. The built `dist/` chunks contain `import { z } from "zod"` but Metro can't find `zod` relative to the `dist/` directory.

## Root Cause

Three factors combine:

1. **`package.json` exports field** points to `./dist/` (built output), not `./src/` (source)
2. **`disableHierarchicalLookup: true`** in `metro.config.js` restricts module resolution to explicit paths
3. **pnpm hoists `zod`** to the root `node_modules/`, not `packages/types/node_modules/`

Metro resolves `@motovault/types` → `packages/types/dist/index.mjs` (via exports field) → encounters `import { z } from "zod"` → searches from `dist/` directory → can't find `zod` because hierarchical lookup is disabled and `zod` is hoisted to root.

## Solution

Add a custom `resolveRequest` to `metro.config.js` that redirects all `@motovault/*` imports to their `src/` entry points, bypassing the `dist/` output entirely:

```js
// metro.config.js
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@motovault/')) {
    const fs = require('node:fs');
    const parts = moduleName.split('/');
    const pkgName = parts[1];
    const subpath = parts.slice(2).join('/');

    if (subpath) {
      const candidates = [
        path.resolve(monorepoRoot, 'packages', pkgName, 'src', subpath, 'index.ts'),
        path.resolve(monorepoRoot, 'packages', pkgName, 'src', `${subpath}.ts`),
        path.resolve(monorepoRoot, 'packages', pkgName, 'src', `${subpath}.types.ts`),
      ];
      for (const candidate of candidates) {
        try {
          fs.accessSync(candidate);
          return { type: 'sourceFile', filePath: candidate };
        } catch {}
      }
    } else {
      const srcEntry = path.resolve(monorepoRoot, 'packages', pkgName, 'src', 'index.ts');
      try {
        fs.accessSync(srcEntry);
        return { type: 'sourceFile', filePath: srcEntry };
      } catch {}
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

This handles root imports (`@motovault/types`), directory sub-paths (`@motovault/types/validators`), and file sub-paths (`@motovault/types/database`).

## Prevention

- When adding new workspace packages with external dependencies, verify Metro can resolve those deps from the package's `dist/` directory
- Consider always resolving workspace packages from source in Metro (faster HMR too)
- After changing `metro.config.js`, always restart Metro with `--clear` flag
