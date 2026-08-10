const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Moves `apply plugin: "io.sentry.android.gradle"` below
 * `apply plugin: "com.android.application"` in android/app/build.gradle.
 *
 * @sentry/react-native's own config plugin (withSentryAndroidGradlePlugin)
 * PREPENDS its apply line to the top of the file, so it lands above the Android
 * application plugin. The Sentry AGP then can't see the `android` extension at
 * apply time and prints, on every build:
 *
 *   WARNING: Using 'io.sentry.android.gradle' is only supported for the app
 *   module. Please make sure that you apply the Sentry gradle plugin alongside
 *   'com.android.application' on the _module_ level, and not on the root project
 *   level.
 *
 * That warning is a false alarm — we *are* at module level, and the release
 * tasks (generateSentryProguardUuidRelease, uploadSentryProguardMappingsRelease,
 * injectSentryDebugMetaPropertiesIntoAssetsRelease) all register and run
 * correctly either way. It is reordered purely so nobody has to re-derive that
 * it is harmless, which is the documented order anyway.
 *
 * Must run AFTER Sentry's mod, which means being registered BEFORE it: Expo
 * executes mods in reverse registration order (see with-android-manifest-hygiene).
 * No-ops if either line is missing, so a change in Sentry's injection can only
 * revert to the vendor's own behaviour, never corrupt the file.
 */

const SENTRY_APPLY = 'apply plugin: "io.sentry.android.gradle"';
const ANDROID_APPLY = 'apply plugin: "com.android.application"';

module.exports = function withSentryAgpOrder(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;

    const contents = config.modResults.contents;
    const sentryAt = contents.indexOf(SENTRY_APPLY);
    const androidAt = contents.indexOf(ANDROID_APPLY);
    // Nothing to do if either is absent, or Sentry is already below Android.
    if (sentryAt === -1 || androidAt === -1 || sentryAt > androidAt) return config;

    // Strip the trailing newline too, tolerating CRLF: on a CRLF file a plain
    // `SENTRY_APPLY\n` removal silently fails, and we would then ADD a second
    // apply line while leaving the original above com.android.application.
    const withoutSentry = contents.replace(
      new RegExp(`${SENTRY_APPLY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n`),
      '',
    );
    if (withoutSentry === contents) return config; // removal failed — leave as-is
    config.modResults.contents = withoutSentry.replace(
      ANDROID_APPLY,
      `${ANDROID_APPLY}\n${SENTRY_APPLY}`,
    );
    return config;
  });
};
