// CarPlay config plugin — injects the UIApplicationSceneManifest so iOS launches
// a CPTemplateApplicationScene alongside the normal window scene. The Swift scene
// delegate (CarPlaySceneDelegate) and the bridge module ship in the autolinked
// Expo module at apps/mobile/modules/carplay/ios, so no source copy is needed
// here — the manifest just points UIKit at the delegate class by name.
//
// Precedent: plugins/fbsdk-core-only.js (config-plugin shape) and the expo-widgets
// target (custom Swift in the build). Idempotent; re-applied every prebuild.
//
// ⚠️ ON-MACHINE VERIFICATION REQUIRED: Expo SDK 56's prebuild UIScene lifecycle is
// in flux (expo/expo #46663/#46664). After `expo prebuild`, confirm the generated
// AppDelegate keeps the phone window scene working with this manifest present; if
// the window scene regresses, the AppDelegate window/scene bootstrap must be
// reconciled by hand. Neither CI nor the agent can run prebuild/build to check this.

const { withInfoPlist } = require('expo/config-plugins');

const WINDOW_SCENE_ROLE = 'UIWindowSceneSessionRoleApplication';
const CARPLAY_SCENE_ROLE = 'CPTemplateApplicationSceneSessionRoleApplication';

/** @param {import('expo/config').ExpoConfig} config */
const withCarPlay = (config) =>
  withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    const manifest = plist.UIApplicationSceneManifest ?? {};
    manifest.UIApplicationSupportsMultipleScenes = true;

    const configs = manifest.UISceneConfigurations ?? {};

    // Preserve the default phone window scene if the prebuild template already
    // declared one; otherwise declare the standard UIKit window scene so adding
    // the CarPlay scene doesn't strip the phone UI.
    if (!configs[WINDOW_SCENE_ROLE]) {
      configs[WINDOW_SCENE_ROLE] = [
        {
          UISceneConfigurationName: 'Phone',
          UISceneClassName: 'UIWindowScene',
        },
      ];
    }

    // CarPlay template scene → our Swift delegate (autolinked from the module).
    configs[CARPLAY_SCENE_ROLE] = [
      {
        UISceneConfigurationName: 'CarPlay',
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneDelegateClassName: 'CarPlaySceneDelegate',
      },
    ];

    manifest.UISceneConfigurations = configs;
    plist.UIApplicationSceneManifest = manifest;
    return cfg;
  });

module.exports = withCarPlay;
