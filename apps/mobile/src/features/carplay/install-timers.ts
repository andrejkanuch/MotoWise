// MUST be the bundle's first import (index.ts). With the phone locked and only CarPlay
// on screen, React Native's own timers stop firing — the armed-Stop auto-disarm, the
// panel's trailing flush, request timeouts and Supabase token refresh all freeze.
// Library 0.7.0 replaces the global timer functions with native-backed ones that keep
// running; they have to be in place before any other module captures setTimeout.
//
// iOS only, and guarded: the library is excluded from Android autolinking, and its
// timer module creates a native HybridObject at evaluation — which throws where the
// native side is absent. `process.env.EXPO_OS` is inlined at build time, so this file
// imports nothing (not even react-native) ahead of the swap.
if (process.env.EXPO_OS === 'ios') {
  try {
    require('@iternio/react-native-auto-play/installTimers');
  } catch {
    // A build without the native pod keeps React Native's timers.
  }
}
