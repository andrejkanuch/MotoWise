const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Removes the `resourceConfigurations += ["b+en", "b+es", …]` line that
 * expo-localization writes into android/app/build.gradle whenever
 * `supportedLocales` is set, and keeps everything else that option does
 * (res/xml/locales_config.xml + android:localeConfig, i.e. the Android 13+
 * per-app language picker in App info → Language).
 *
 * resourceConfigurations makes AAPT drop every string resource outside the
 * listed qualifiers, including the ones bundled by libraries, and it matches
 * qualifiers exactly. Checked with aapt2 36.0.0 (`link -c`, then `dump
 * configurations`) on 2026-11-03:
 * - `b+es` keeps `values-es` only; `values-es-rUS`, `values-es-rMX` and
 *   `values-b+es+419` are dropped. AndroidX ships its Latin American Spanish as
 *   `values-es-rUS`, so LatAm phones would get Spain's library strings.
 * - `b+id` keeps `values-b+id` only; `values-in` is dropped. AndroidX (and most
 *   libraries) ship Indonesian ONLY as `values-in`, so Indonesian phones would
 *   get English library strings inside an Indonesian app.
 * Our own copy is i18next JSON, not Android resources, so the filter saves
 * nothing that matters, and Play ships only the device's languages through AAB
 * language splits. RevenueCat UI is pinned to the app language separately
 * (Purchases.overridePreferredLocale in src/lib/subscription.ts).
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
