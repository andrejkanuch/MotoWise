// CarPlay config plugin — injects the UIApplicationSceneManifest that adopts the
// scene-based lifecycle @iternio/react-native-auto-play requires. It declares two
// scenes, both backed by Swift delegates that ship inside the library's autolinked
// pod (ReactNativeAutoPlay) — no source is copied here, the manifest just points
// UIKit at the delegate classes by name:
//
//   • UIWindowSceneSessionRoleApplication        → WindowApplicationSceneDelegate
//       The phone app's window. The library's delegate re-hosts the AppDelegate's
//       existing rootViewController in a scene-owned window, so Expo's default
//       window/rootViewController bootstrap stays as-is (no AppDelegate patch).
//   • CPTemplateApplicationSceneSessionRoleApplication → HeadUnitSceneDelegate
//       The CarPlay head-unit surface that renders our InformationTemplate.
//
// We render a native InformationTemplate (not a MapTemplate), so the library never
// calls `getRootViewForAutoplay` — that AppDelegate hook is unnecessary here.
//
// Dashboard / Cluster scenes are intentionally omitted (out of scope). The Driving
// Task entitlement (com.apple.developer.carplay-driving-task, granted — Apple
// Case-ID 20710293) is set via `ios.entitlements` in app.config.ts.
//
// Precedent: plugins/fbsdk-core-only.js. Idempotent; re-applied every prebuild.
//
// ⚠️ ON-MACHINE VERIFICATION REQUIRED: Expo SDK 56's prebuild UIScene lifecycle is
// in flux (expo/expo #46663/#46664). After `expo prebuild`, confirm the phone
// window still renders with this manifest present (the library's window delegate
// borrows UIApplication.shared.delegate.window.rootViewController). Neither CI nor
// the agent can run prebuild/build to check this.

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

    // Phone window scene → the library's WindowApplicationSceneDelegate. This
    // REPLACES the default (delegate-less) window scene: switching to a scene
    // lifecycle is required for the CarPlay scene to coexist, and the library's
    // delegate is what re-hosts the RN root view in the scene's window.
    configs[WINDOW_SCENE_ROLE] = [
      {
        UISceneConfigurationName: 'WindowApplication',
        UISceneClassName: 'UIWindowScene',
        UISceneDelegateClassName: 'WindowApplicationSceneDelegate',
      },
    ];

    // CarPlay head-unit scene → the library's HeadUnitSceneDelegate.
    configs[CARPLAY_SCENE_ROLE] = [
      {
        UISceneConfigurationName: 'CarPlayHeadUnit',
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneDelegateClassName: 'HeadUnitSceneDelegate',
      },
    ];

    manifest.UISceneConfigurations = configs;
    plist.UIApplicationSceneManifest = manifest;
    return cfg;
  });

module.exports = withCarPlay;
