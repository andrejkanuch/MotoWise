const { withXcodeProject } = require('expo/config-plugins');

/**
 * Sync the widget app-extension's MARKETING_VERSION to the app version.
 *
 * expo-widgets writes CFBundleShortVersionString into the extension Info.plist,
 * but the target keeps GENERATE_INFOPLIST_FILE = YES, so Xcode synthesizes
 * CFBundleShortVersionString from MARKETING_VERSION (default 1.0) and that
 * overrides the literal plist value. App Store / device builds then fail with:
 *   "The CFBundleShortVersionString of an app extension ('1.0') must match
 *    that of its containing parent app ('<version>')."
 *
 * This forces MARKETING_VERSION on every widget-extension build config to the
 * app version so parent and extension always agree. Matched by the widgets
 * bundle id suffix so it survives prebuild regeneration.
 */
module.exports = function widgetMarketingVersion(config) {
  return withXcodeProject(config, (config) => {
    const version = config.version;
    if (!version) return config;

    const project = config.modResults;
    const buildConfigs = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(buildConfigs)) {
      const entry = buildConfigs[key];
      const settings = entry?.buildSettings;
      const bundleId = settings?.PRODUCT_BUNDLE_IDENTIFIER;
      if (typeof bundleId === 'string' && bundleId.endsWith('.widgets')) {
        settings.MARKETING_VERSION = version;
      }
    }

    return config;
  });
};
