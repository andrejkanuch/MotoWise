const { withGradleProperties } = require('expo/config-plugins');

/**
 * Enable R8 full-mode optimization + the optimized (precise) resource shrinker
 * in android/gradle.properties.
 *
 * expo-build-properties (SDK 56) already turns on R8 in COMPATIBILITY mode via
 * `enableMinifyInReleaseBuilds` (shrinking + obfuscation) and
 * `enableShrinkResourcesInReleaseBuilds`. Play Console still reports:
 *   - "Optimization isn't enabled"            -> R8 FULL mode is off
 *   - "Optimized resource shrinking isn't enabled"
 * Neither has a field in expo-build-properties, and the android/ dir is
 * gitignored + regenerated on every prebuild, so we set the gradle flags here
 * with withGradleProperties (same pattern as plugins/with-gradle-memory.js).
 * They survive prebuild regeneration.
 *
 *   android.enableR8.fullMode=true
 *     Full-mode R8 optimizes more aggressively (inlining, class merging, more
 *     reflection-unsafe stripping). Smoke-test a release (minified) build of the
 *     reflection-heavy libs before shipping: @rnmapbox/maps, react-native-purchases
 *     (+ -ui), @react-native-google-signin, react-native-fbsdk-next, @sentry/react-native.
 *     If any breaks, add targeted -keep rules via
 *     expo-build-properties.android.extraProguardRules — do NOT disable full mode.
 *
 *   android.enableNewResourceShrinker.preciseShrinking=true
 *     Uses the precise resource shrinker (removes unused resources more accurately),
 *     which is what Play Console's "optimized resource shrinking" check looks for.
 *     Pairs with enableShrinkResourcesInReleaseBuilds.
 *
 * NOTE: AGP 9.0+ (the third Play Console R8 recommendation) is owned by the Expo
 * SDK toolchain (SDK 56 pins AGP 8.x) and ships with a future Expo SDK upgrade —
 * it is intentionally not set here.
 */
const R8_PROPERTIES = [
  { key: 'android.enableR8.fullMode', value: 'true' },
  { key: 'android.enableNewResourceShrinker.preciseShrinking', value: 'true' },
];

module.exports = function withR8Optimization(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    for (const { key, value } of R8_PROPERTIES) {
      const existing = props.find((item) => item.type === 'property' && item.key === key);

      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    }

    return config;
  });
};
