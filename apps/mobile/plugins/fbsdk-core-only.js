const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Limit react-native-fbsdk-next to its `Core` subspec (Facebook App Events only).
 *
 * We only use `AppEventsLogger` + `Settings.initializeSDK` for Meta ad attribution
 * (see src/lib/meta-analytics.ts, src/app/_layout.tsx) — never Facebook Login or
 * Share. The library's podspec declares Core / Login / Share subspecs but sets no
 * `default_subspecs`, so CocoaPods links ALL of them, pulling in FBSDKLoginKit,
 * FBSDKShareKit and FBSDKGamingServicesKit (~2.9 MB of native frameworks we never call).
 *
 * This patches the podspec to default to `Core` before `pod install` runs during
 * prebuild. Idempotent, and re-applies on every (re)prebuild — including EAS, where
 * node_modules is reinstalled fresh each build.
 */
module.exports = function fbsdkCoreOnly(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      let podspecPath;
      try {
        // Resolve through node so pnpm symlinks / monorepo hoisting are handled.
        const pkgJson = require.resolve('react-native-fbsdk-next/package.json', {
          paths: [config.modRequest.projectRoot],
        });
        podspecPath = path.join(path.dirname(pkgJson), 'react-native-fbsdk-next.podspec');
      } catch {
        return config;
      }

      if (!fs.existsSync(podspecPath)) return config;

      const src = fs.readFileSync(podspecPath, 'utf8');
      if (src.includes('default_subspecs')) return config; // already patched

      const patched = src.replace(
        "s.dependency      'React-Core'",
        "s.dependency      'React-Core'\n  s.default_subspecs = 'Core'",
      );
      if (patched !== src) {
        fs.writeFileSync(podspecPath, patched);
      }
      return config;
    },
  ]);
};
