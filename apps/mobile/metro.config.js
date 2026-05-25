const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withSentryConfig } = require('@sentry/react-native/metro');
const fs = require('node:fs');
const path = require('node:path');

// TanStack Query: package.json "exports" points Metro at build/modern/*.js, which uses
// import "./foo.js" — Metro fails to resolve those siblings. Prefer published src/*.ts
// (same entry as the package "react-native" field).
const TANSTACK_QUERY_SOURCE_PACKAGES = new Set([
  '@tanstack/query-core',
  '@tanstack/react-query',
  '@tanstack/react-query-persist-client',
]);

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Only watch packages this app depends on (not the whole monorepo)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages', 'types'),
  path.resolve(monorepoRoot, 'packages', 'graphql'),
  path.resolve(monorepoRoot, 'packages', 'design-system'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve workspace packages from source (not dist/) so Metro can
// follow their dependencies through the normal node_modules chain.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (TANSTACK_QUERY_SOURCE_PACKAGES.has(moduleName)) {
    const parts = moduleName.split('/');
    for (const root of [monorepoRoot, projectRoot]) {
      const srcEntry = path.join(root, 'node_modules', ...parts, 'src', 'index.ts');
      try {
        fs.accessSync(srcEntry);
        return { type: 'sourceFile', filePath: srcEntry };
      } catch {
        /* try next root */
      }
    }
  }

  // Map @motovault/* workspace packages to their src/ entry points
  if (moduleName.startsWith('@motovault/')) {
    const parts = moduleName.split('/');
    const pkgName = parts[1]; // e.g. 'types'
    const subpath = parts.slice(2).join('/'); // e.g. 'validators' or ''

    if (subpath) {
      // Sub-path exports like @motovault/types/validators or @motovault/types/database
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
      // Root import like @motovault/types
      const srcEntry = path.resolve(monorepoRoot, 'packages', pkgName, 'src', 'index.ts');
      try {
        fs.accessSync(srcEntry);
        return { type: 'sourceFile', filePath: srcEntry };
      } catch {}
    }
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withSentryConfig(withNativeWind(config));
