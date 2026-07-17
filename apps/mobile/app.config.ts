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
  version: '3.17.0',
  // 'default' (not 'portrait') so Android emits NO android:screenOrientation
  // restriction. Android 16 ignores orientation/resizability locks on large-screen
  // devices (foldables, tablets) and Play Console flags the restriction as a
  // large-screen UX advisory. Removing it clears the advisory and lets Android
  // adapt; core flows are verified in landscape / split-screen (safe-area-context
  // handles insets). iOS is pinned back to portrait via
  // ios.infoPlist.UISupportedInterfaceOrientations below so this is an
  // Android-only change and iPhone UX is unchanged.
  orientation: 'default',
  icon: './src/assets/images/MotoVault.png',
  // Root view color (behind all React views) — matches the splash background
  // so the native-splash → first-frame handoff never flashes white. Requires
  // expo-system-ui on iOS.
  backgroundColor: '#110e0a',
  userInterfaceStyle: 'automatic',
  scheme: 'motovault',
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
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
      // Drop the bundled libdav1d AVIF decoder (~9 MB libavif framework). The app
      // ships no AVIF images and loads only JPEG/PNG/WebP; WebP/SVG coders are
      // unaffected. iOS 16.4+ decodes static AVIF natively if ever needed.
      'expo-image',
      {
        disableLibdav1d: true,
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
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'MotoVault uses your location to record ride routes, show nearby routes, and display local weather for trip planning.',
        // Background recording: keep tracking distance/speed/route while the app is
        // backgrounded or the screen is locked (e.g. riding with CarPlay up). Adds
        // the iOS `location` background mode + Android ACCESS_BACKGROUND_LOCATION +
        // foreground service. Required for Location.startLocationUpdatesAsync.
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
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
        // White MW mark on transparent bg (dedicated asset — MotoVault.png is
        // the app icon, do NOT reuse it here) on the AnimatedSplash overlay
        // color (palette.editorialDarkBg2), so the native→animated splash
        // handoff is seamless in both modes.
        image: './src/assets/images/splash-icon.png',
        imageWidth: 100,
        backgroundColor: '#110e0a',
        dark: {
          image: './src/assets/images/splash-icon.png',
          backgroundColor: '#110e0a',
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
          // Drop unused FBSDK Login/Share/GamingServices subspecs (~2.9 MB) —
          // we only use App Events (Core). Must run after the fbsdk plugin.
          './plugins/fbsdk-core-only',
        ] as (string | [string, Record<string, unknown>])[])
      : []),
    [
      'expo-media-library',
      {
        photosPermission: 'Allow MotoVault to save ride share cards to your photo library.',
        savePhotosPermission: 'Allow MotoVault to save ride share cards to your photo library.',
        isAccessMediaLocationEnabled: false,
        // We only SAVE share cards (write-only) — never read the library through
        // this module. Empty granular permissions stops expo-media-library from
        // injecting READ_MEDIA_IMAGES/READ_MEDIA_VIDEO/READ_MEDIA_AUDIO, which
        // violate Google Play's Photo and Video Permissions policy.
        granularPermissions: [],
      },
    ],
    './plugins/remove-activity-recognition',
    // CarPlay: injects the UIApplicationSceneManifest pointing the window + CarPlay
    // scenes at @iternio/react-native-auto-play's autolinked scene delegates.
    './plugins/with-carplay',
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
    // Must run after expo-widgets: forces the widget extension's MARKETING_VERSION
    // to match the app version so device/store builds don't fail the
    // CFBundleShortVersionString parent/extension match check.
    './plugins/widget-marketing-version',
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
          // R8 minification + resource shrinking for smaller release APKs and a
          // deobfuscation mapping file (EAS auto-uploads it to Play, fixing the
          // "no deobfuscation file" warning + deobfuscating Android Vitals crashes).
          // NOTE: SDK 54 renamed enableProguardInReleaseBuilds → enableMinifyInReleaseBuilds.
          // R8 can strip reflection-accessed classes — smoke-test a production build
          // (Mapbox, fbsdk, RevenueCat, Google Sign-In, Sentry) before shipping.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '16.4',
          // Build React Native from source (disables the prebuilt React.xcframework
          // and its `-ivfsoverlay React-VFS.yaml` clang overlay). That overlay hides
          // Pods/Headers/Public while clang builds the GTMSessionFetcher module for
          // GTMAppAuth's `import GTMSessionFetcher` (via @react-native-google-signin),
          // so its framework-style self-import fails to build. Trade-off: slower iOS
          // builds. Precompiled Expo modules require prebuilt React, so they're off too.
          buildReactNativeFromSource: true,
          // AppCheckCore (a Swift pod pulled in by @react-native-google-signin)
          // depends on GoogleUtilities + RecaptchaInterop, which don't define
          // modules — so they can't be imported from Swift when built as static
          // libraries and `pod install` fails. Opt those two into modular header
          // generation (the per-dependency fix CocoaPods suggests) instead of
          // flipping the whole project to use_modular_headers!/static frameworks,
          // which would conflict with rnmapbox's dynamic-framework setup.
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
          ],
        },
      },
    ],
    // Must run after expo-build-properties: raises the Gradle daemon's JVM
    // heap/metaspace so local release builds don't die with "GC thrashing /
    // ran out of JVM Metaspace". expo-build-properties has no jvmargs field.
    './plugins/with-gradle-memory',
    // Must run after expo-build-properties: enables R8 full-mode + optimized
    // resource shrinking (gradle.properties flags with no expo-build-properties
    // field) to clear the Play Console R8 advisory. Smoke-test reflection-heavy
    // libs on a release build — see the plugin header.
    './plugins/with-r8-optimization',
  ],
  ios: {
    bundleIdentifier: 'com.motovault.app',
    supportsTablet: true,
    usesAppleSignIn: true,
    entitlements: {
      'com.apple.security.application-groups': ['group.com.motovault.app'],
      // CarPlay Driving Task — granted by Apple (Case-ID 20710293). Required in
      // the build for the CarPlay scene to launch on a head unit / simulator.
      'com.apple.developer.carplay-driving-task': true,
    },
    associatedDomains: ['applinks:motovault.app', 'applinks:www.motovault.app'],
    icon: {
      light: './src/assets/images/MotoVault.png',
      dark: './src/assets/images/MotoVaultDark.png',
      tinted: './src/assets/images/MotoVault.png',
    },
    infoPlist: {
      CFBundleDisplayName: 'MotoVault',
      // Keep iPhone portrait-only. The top-level `orientation: 'default'` exists
      // solely to drop Android's screenOrientation lock for the Android 16
      // large-screen advisory; it would otherwise also unlock iPhone rotation.
      // iOS reads this base key for iPhone, so pin it to portrait to preserve the
      // existing iPhone UX. (iPad reads UISupportedInterfaceOrientations~ipad,
      // which Expo's orientation plugin sets to all orientations for
      // supportsTablet:true — acceptable and Apple-encouraged; not overridden here
      // because Expo's mod runs last and wins.)
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      NSLocationWhenInUseUsageDescription:
        'MotoVault uses your location to record ride routes, show nearby routes, and display local weather for trip planning.',
      NSCameraUsageDescription: 'MotoVault needs camera access for diagnostic photo capture.',
      NSPhotoLibraryUsageDescription:
        'MotoVault needs photo library access to upload diagnostic images.',
      NSPhotoLibraryAddUsageDescription:
        'Allow MotoVault to save ride share cards to your photo library.',
      // Required because the bundled CarPlay library (@iternio/react-native-auto-play)
      // references the Speech + microphone voice-input APIs. Apple mandates these
      // purpose strings whenever the binary references the APIs, even though we do
      // not yet surface voice input (ITMS-90683). Voice input is a CarPlay
      // hands-free capability.
      NSSpeechRecognitionUsageDescription:
        'MotoVault uses speech recognition for hands-free voice commands while connected to CarPlay.',
      NSMicrophoneUsageDescription:
        'MotoVault uses the microphone for hands-free voice commands while connected to CarPlay.',
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
      // `location` keeps GPS recording alive while backgrounded / screen-locked
      // (background ride recording — pairs with Location.startLocationUpdatesAsync
      // and the expo-location background flags above).
      // NOTE: `audio` is intentionally NOT declared yet. App Review guideline 2.5.4
      // rejects a background mode the app doesn't actively exercise, and the CarPlay
      // confirmation earcon (plan U5 / carplay-earcon) has not shipped. Re-add
      // `'audio'` in the same PR that lands the earcon's background playback.
      UIBackgroundModes: ['location'],
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
    permissions: ['NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
    // Force-remove every media-read permission from the FINAL merged manifest
    // (tools:node="remove"), regardless of what expo-media-library or any
    // transitive library declares. We only save share cards (write-only) and
    // pick images via the system photo picker, so the app needs no persistent
    // media access — these would violate Google Play's Photo and Video
    // Permissions policy. Belt-and-suspenders with granularPermissions: [].
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      // react-native-fbsdk-next auto-injects AD_ID whenever the Meta SDK is
      // configured (EXPO_PUBLIC_META_APP_ID set). We never collect the Android
      // advertising ID — advertiserIDCollectionEnabled/autoInit are all false and
      // PostHog is not configured for ad-id — so strip it from the final manifest.
      // This keeps the build honest with the Play Console "Advertising ID: No"
      // declaration regardless of whether Meta is present in a given build.
      'com.google.android.gms.permission.AD_ID',
    ],
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
