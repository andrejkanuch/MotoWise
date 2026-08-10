const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Clears the Play Console / `gplay preflight` manifest warnings that no other
 * plugin owns. Must run LAST — every fix here undoes something a library's own
 * config plugin writes, so ordering is the whole point.
 *
 * Why a plugin and not a hand-edit in `android/`: that directory is gitignored,
 * so EAS never uploads it and regenerates it with `expo prebuild`. Manifest
 * edits made there are silently discarded at build time.
 *
 * 1. `android:requestLegacyExternalStorage` — set unconditionally by
 *    expo-media-library's plugin (withMediaLibrary.js, no opt-out prop).
 *    targetSdk 36 ignores it (scoped storage is mandatory from Android 11), so
 *    it is dead config that only earns a warning.
 *
 * 2. READ/WRITE_EXTERNAL_STORAGE `maxSdkVersion` — the Expo bare template
 *    declares both capped at 32, but `react-native-blob-util` (a
 *    react-native-pdf peer) declares them with NO cap. The manifest merger
 *    takes the least-restrictive union for `uses-permission`, so the cap is
 *    dropped from the merged manifest and Play sees an unbounded legacy-storage
 *    request. `tools:replace` cannot fix this — there is no attribute on the
 *    library element to replace — so we assert `tools:node="replace"`, which
 *    substitutes our whole element for every lower-priority declaration.
 */

const LEGACY_STORAGE_ATTRIBUTE = 'android:requestLegacyExternalStorage';

/** Permissions whose merged declaration must stay capped at the API level where they stop having any effect. */
const CAPPED_PERMISSIONS = {
  'android.permission.READ_EXTERNAL_STORAGE': '32',
  'android.permission.WRITE_EXTERNAL_STORAGE': '32',
};

module.exports = function withAndroidManifestHygiene(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    delete application.$[LEGACY_STORAGE_ATTRIBUTE];

    for (const permission of config.modResults.manifest['uses-permission'] ?? []) {
      const maxSdkVersion = CAPPED_PERMISSIONS[permission.$?.['android:name']];
      if (!maxSdkVersion) continue;

      permission.$['android:maxSdkVersion'] = maxSdkVersion;
      // `tools:node="replace"` supersedes the attribute-level directive the
      // template ships; keeping both would be redundant and ambiguous.
      permission.$['tools:node'] = 'replace';
      delete permission.$['tools:replace'];
    }

    return config;
  });
};
