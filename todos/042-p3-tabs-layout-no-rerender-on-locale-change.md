# P3: Tab labels may not update when locale changes

## Location
`apps/mobile/src/app/(tabs)/_layout.tsx`

## Problem
The `TabsLayout` component uses `useTranslation()` which subscribes to i18next language changes, so it should re-render when the language changes. However, Expo Router's `Tabs` component may cache the `options` object. If the tab navigator does not re-render its screen options when `t()` returns new values, the tab labels will remain in the old language until the user navigates away and back.

This is a potential issue rather than a confirmed bug -- it depends on Expo Router's internal caching behavior. Worth verifying manually.

## Fix
Test language switching with the profile language picker and verify tab labels update immediately. If they do not, consider adding a `key={i18n.language}` prop to the `<Tabs>` component to force re-mount on language change, or use the `screenListeners` API to trigger an options update.
