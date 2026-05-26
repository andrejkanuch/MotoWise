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
  version: '3.8.0',
  orientation: 'portrait',
  icon: './src/assets/images/MotoVault.png',
  userInterfaceStyle: 'automatic',
  scheme: 'motovault',
  experiments: {
    reactCompiler: true,
  },
  owner: 'andykeny',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/359ae282-329d-455d-b9f3-64919afad0b4',
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
        imageWidth: 100,
        backgroundColor: '#1a1510',
        dark: {
          image: './src/assets/images/MotoVaultDark.png',
          backgroundColor: '#1a1510',
        },
      },
    ],
    [
      'expo-tracking-transparency',
      {
        userTrackingPermission:
          'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
      },
    ],
    ...(process.env.EXPO_PUBLIC_META_APP_ID
      ? ([
          [
            'react-native-fbsdk-next',
            {
              appID: process.env.EXPO_PUBLIC_META_APP_ID,
              clientToken: process.env.EXPO_PUBLIC_META_CLIENT_TOKEN ?? '',
              displayName: 'MotoVault',
              scheme: `fb${process.env.EXPO_PUBLIC_META_APP_ID}`,
              advertiserIDCollectionEnabled: false,
              autoLogAppEventsEnabled: false,
              isAutoInitEnabled: false,
            },
          ],
        ] as [string, Record<string, unknown>][])
      : []),
    [
      'expo-media-library',
      {
        photosPermission: 'Allow MotoVault to save ride share cards to your photo library.',
        savePhotosPermission: 'Allow MotoVault to save ride share cards to your photo library.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    './plugins/remove-activity-recognition',
    [
      'expo-widgets',
      {
        bundleIdentifier: 'com.motovault.app.widgets',
        groupIdentifier: 'group.com.motovault.app',
        widgets: [
          {
            name: 'NextServiceWidget',
            displayName: 'Next Service',
            description: 'Shows your next upcoming maintenance task',
            supportedFamilies: ['systemSmall', 'accessoryRectangular'],
          },
          {
            name: 'ExpenseTrackerWidget',
            displayName: 'Expenses',
            description: 'Shows your monthly motorcycle expenses',
            supportedFamilies: ['systemSmall'],
          },
          {
            name: 'LastRideWidget',
            displayName: 'Last Ride',
            description: 'Shows your most recent ride stats',
            supportedFamilies: ['systemMedium'],
          },
          {
            name: 'RideStatsWidget',
            displayName: 'Ride Stats',
            description: 'Shows your weekly and monthly riding distance',
            supportedFamilies: ['systemMedium'],
          },
        ],
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
          minSdkVersion: 24,
          kotlinVersion: '2.1.20',
          usePrecompiledHeaders: true,
        },
        ios: {
          deploymentTarget: '16.4',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.motovault.app',
    supportsTablet: true,
    usesAppleSignIn: true,
    entitlements: {
      'com.apple.security.application-groups': ['group.com.motovault.app'],
    },
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
      NSPhotoLibraryAddUsageDescription:
        'Allow MotoVault to save ride share cards to your photo library.',
      LSApplicationQueriesSchemes: [
        'maps',
        'comgooglemaps',
        'waze',
        'instagram-stories',
        'instagram',
        'whatsapp',
      ],
      // Meta SKAdNetwork identifiers for iOS install attribution
      SKAdNetworkItems: [
        { SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork' },
        { SKAdNetworkIdentifier: 'n38lu8286q.skadnetwork' },
      ],
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.motovault.app',
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './src/assets/images/MotoVault.png',
      monochromeImage: './src/assets/images/MotoVaultDark.png',
      backgroundColor: '#0F1B2D',
    },
    permissions: ['READ_MEDIA_IMAGES', 'NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/t/' },
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/r/' },
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/ride/' },
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/routes/' },
          { scheme: 'https', host: 'motovault.app', pathPrefix: '/route/' },
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
    posthogHost: process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  },
});
