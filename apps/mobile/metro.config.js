const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
// const { withSentryConfig } = require('@sentry/react-native/metro');
const path = require('node:path');

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
config.resolver.disableHierarchicalLookup = true;

// Resolve workspace packages from source (not dist/) so Metro can
// follow their dependencies through the normal node_modules chain.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Map @motovault/* workspace packages to their src/ entry points
  if (moduleName.startsWith('@motovault/')) {
    const fs = require('node:fs');
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

// withSentryConfig wraps the Metro serializer for source map debug IDs.
// Temporarily disabled due to a crash in determineDebugIdFromBundleSource
// with @sentry/react-native 7.2.0 during `eas update` exports.
// TODO: Re-enable after upgrading Sentry or when the bug is fixed.
module.exports = withNativeWind(config);
