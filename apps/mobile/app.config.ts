import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_PRODUCTION = process.env.APP_VARIANT === 'production';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_PRODUCTION) return 'MotoWise';
  if (IS_PREVIEW) return 'MotoWise (Preview)';
  return 'MotoWise (Dev)';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: 'motowise',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './src/assets/images/MotoWise.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'motowise',
  owner: 'andykeny',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/359ae282-329d-455d-b9f3-64919afad0b4',
  },
  splash: {
    image: './src/assets/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1b2e4b',
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'MotoWise needs camera access for diagnostic photo capture.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'MotoWise needs photo library access to upload diagnostic images.',
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-localization',
    [
      'expo-notifications',
      {
        color: '#FF6B35',
      },
    ],
    'react-native-purchases',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: '1.9.0',
        },
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.motolearn.app',
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      CFBundleDisplayName: 'MotoWise',
      NSCameraUsageDescription: 'MotoWise needs camera access for diagnostic photo capture.',
      NSPhotoLibraryUsageDescription:
        'MotoWise needs photo library access to upload diagnostic images.',
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.motolearn.app',
    adaptiveIcon: {
      foregroundImage: './src/assets/adaptive-icon.png',
      backgroundColor: '#1b2e4b',
    },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES', 'NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
  },
  extra: {
    eas: {
      projectId: '359ae282-329d-455d-b9f3-64919afad0b4',
    },
  },
});
