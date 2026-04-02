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

// withSentryConfig wraps the Metro serializer for source map debug IDs.
// Temporarily disabled due to a crash in determineDebugIdFromBundleSource
// with @sentry/react-native 7.2.0 during `eas update` exports.
// TODO: Re-enable after upgrading Sentry or when the bug is fixed.
module.exports = withNativeWind(config);
