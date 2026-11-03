const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Removes the `resourceConfigurations += ["b+en", "b+es", …]` line that
 * expo-localization writes into android/app/build.gradle whenever
 * `supportedLocales` is set, and keeps everything else that option does
 * (res/xml/locales_config.xml + android:localeConfig, i.e. the Android 13+
 * per-app language picker in App info → Language).
 *
 * resourceConfigurations makes AAPT drop every string resource outside the 13
 * app languages, including the ones bundled by libraries: RevenueCat's paywall
 * and Customer Center, Google sign-in, AndroidX/Material dialogs and pickers.
 * A Dutch or Swedish phone would get those in English instead of its own
 * language, and region-qualified folders (values-es-rUS, b+es+419) are dropped
 * because the filter only lists bare `b+es`. Our own copy lives in i18next JSON,
 * not Android resources, so the filter saves nothing that matters; Play already
 * ships only the device's languages through AAB language splits.
 *
 * Must run AFTER expo-localization's mod, which means being registered BEFORE
 * it: Expo executes mods in reverse registration order (see
 * with-android-manifest-hygiene). No-ops when the line is absent.
 */

const LOCALE_FILTER = /^[ \t]*resourceConfigurations \+= \[(?:\s*"b\+[^"]+",?)+\s*\]\r?\n/m;

function stripLocaleResourceFilter(contents) {
  return contents.replace(LOCALE_FILTER, '');
}

module.exports = function withAllLocaleResources(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;
    config.modResults.contents = stripLocaleResourceFilter(config.modResults.contents);
    return config;
  });
};
module.exports.stripLocaleResourceFilter = stripLocaleResourceFilter;
