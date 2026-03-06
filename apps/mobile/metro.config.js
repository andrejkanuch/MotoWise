const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
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

module.exports = withNativeWind(config);
