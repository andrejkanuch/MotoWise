import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_PRODUCTION = process.env.APP_VARIANT === 'production';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_PRODUCTION) return 'MotoVault';
  if (IS_PREVIEW) return 'MotoVault (Preview)';
  return 'MotoVault (Dev)';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: 'motowise',
  description: 'AI-powered motorcycle maintenance, diagnostics & expense tracking',
  version: '2.5.0',
  orientation: 'portrait',
  icon: './src/assets/images/MotoVault.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'motovault',
  owner: 'andykeny',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/359ae282-329d-455d-b9f3-64919afad0b4',
  },
  splash: {
    backgroundColor: '#04070e',
  },
  plugins: [
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? '',
        project: process.env.SENTRY_PROJECT ?? '',
      },
    ],
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'MotoVault needs camera access for diagnostic photo capture.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'MotoVault needs photo library access to upload diagnostic images.',
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-localization',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.276412017775-u00mgu2n51d8kuhfkgkcpetj9bhin6ps',
      },
    ],
    '@react-native-community/datetimepicker',
    '@rnmapbox/maps',
    [
      'expo-notifications',
      {
        color: '#FF6B35',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './src/assets/images/MotoVault.png',
        imageWidth: 200,
        backgroundColor: '#04070e',
        dark: {
          image: './src/assets/images/MotoVault.png',
          backgroundColor: '#04070e',
        },
      },
    ],
    './plugins/remove-activity-recognition',
    [
      'expo-tracking-transparency',
      {
        userTrackingPermission:
          'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
      },
    ],
    [
      'react-native-fbsdk-next',
      {
        appID: '950678714025532',
        clientToken: process.env.FACEBOOK_CLIENT_TOKEN ?? '',
        displayName: 'MotoVault',
        scheme: 'fb950678714025532',
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: false,
        iosUserTrackingPermission:
          'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: '2.1.20',
        },
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.motovault.app',
    supportsTablet: true,
    usesAppleSignIn: true,
    associatedDomains: ['applinks:motovault.app', 'applinks:www.motovault.app'],
    icon: {
      light: './src/assets/images/MotoVault.png',
      dark: './src/assets/images/MotoVaultDark.png',
      tinted: './src/assets/images/MotoVault.png',
    },
    infoPlist: {
      CFBundleDisplayName: 'MotoVault',
      NSCameraUsageDescription: 'MotoVault needs camera access for diagnostic photo capture.',
      NSPhotoLibraryUsageDescription:
        'MotoVault needs photo library access to upload diagnostic images.',
      NSUserTrackingUsageDescription:
        'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.motovault.app',
    adaptiveIcon: {
      foregroundImage: './src/assets/images/MotoVault.png',
      monochromeImage: './src/assets/images/MotoVaultDark.png',
      backgroundColor: '#0F1B2D',
    },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES', 'NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/t/' },
          { scheme: 'https', host: 'www.motovault.app', pathPrefix: '/t/' },
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/r/' },
          { scheme: 'https', host: 'www.motovault.app', pathPrefix: '/r/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  extra: {
    eas: {
      projectId: '359ae282-329d-455d-b9f3-64919afad0b4',
    },
    sentryDsn: process.env.SENTRY_DSN ?? '',
    posthogApiKey: process.env.POSTHOG_API_KEY ?? '',
    posthogHost: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  },
});
