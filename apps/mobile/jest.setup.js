/**
 * Global jest mocks for native modules that have no JS runtime in jest.
 * A test file can still override any of these with its own `jest.mock` call
 * (e.g. bike-hub suites pin `useReducedMotion: () => true`).
 */

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Reanimated's official mock, plus the hooks it doesn't stub.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

// The onboarding shell and every keyboard-aware form need KeyboardProvider-free stubs.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

// TanStack Query's gc timers (5 minutes by default for every query and finished
// mutation) are not cancelled by `queryClient.clear()`, so a suite that never
// unmounts its client kept the Jest worker alive ("A worker process has failed
// to exit gracefully"). Unref'd, they still fire while a test runs but no longer
// hold the process open. `globalThis.setTimeout` is read per call, so fake
// timers keep working.
const { timeoutManager } = require('@tanstack/react-query');
const unref = (timer) => {
  timer?.unref?.();
  return timer;
};
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unref(globalThis.setTimeout(callback, delay)),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
  setInterval: (callback, delay) => unref(globalThis.setInterval(callback, delay)),
  clearInterval: (timer) => globalThis.clearInterval(timer),
});
