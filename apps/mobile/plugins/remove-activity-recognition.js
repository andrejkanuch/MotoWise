const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Remove ACTIVITY_RECOGNITION permission added by expo-sensors.
 * We only use DeviceMotion for lean angle (not health features),
 * so this permission triggers unnecessary Google Play health policy review.
 */
module.exports = function removeActivityRecognition(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];

    manifest['uses-permission'] = permissions.filter(
      (perm) => perm.$?.['android:name'] !== 'android.permission.ACTIVITY_RECOGNITION',
    );

    return config;
  });
};
