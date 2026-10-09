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
