jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  getClient: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  reactNavigationIntegration: jest.fn().mockReturnValue({}),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('posthog-react-native', () => jest.fn());
jest.mock('react-native-fbsdk-next', () => ({
  Settings: { setAdvertiserTrackingEnabled: jest.fn() },
}));
jest.mock('../meta-attribution', () => ({ getStoredUtmProperties: jest.fn() }));

import type { ErrorEvent as SentryEvent } from '@sentry/react-native';
import { sentryBeforeSend } from '../analytics';

function makeEvent(overrides: Partial<SentryEvent> = {}): SentryEvent {
  return {
    exception: { values: [] },
    ...overrides,
  } as SentryEvent;
}

describe('sentryBeforeSend', () => {
  describe('Fabric RetryableMountingLayerException filter', () => {
    it('drops events with "Unable to find viewState for tag" in value', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'RetryableMountingLayerException',
              value: 'Unable to find viewState for tag 494. Surface stopped: false',
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('drops events with different tag numbers', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'RetryableMountingLayerException',
              value: 'Unable to find viewState for tag 123',
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('passes unrelated exceptions through', () => {
      const event = makeEvent({
        exception: {
          values: [{ type: 'Error', value: 'Something else went wrong' }],
        },
      });
      expect(sentryBeforeSend(event)).toBe(event);
    });
  });

  describe('Hermes VM internal crash filter', () => {
    it('drops crashes where all frames are Hermes/RN internal', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'EXC_BAD_ACCESS',
              value: 'EXC_BAD_ACCESS: Exception 1, Code 1',
              stacktrace: {
                frames: [
                  { function: 'hermes::vm::JSObject::defineOwnPropertyInternal', in_app: false },
                  { function: 'hermes::vm::BoundFunction::create', in_app: false },
                  { function: 'facebook::react::RCTMessageThread::runAsync', in_app: false },
                ],
              },
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('drops crashes with only in_app:false frames (no function names)', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'EXC_BAD_ACCESS',
              value: 'KERN_INVALID_ADDRESS',
              stacktrace: {
                frames: [
                  { function: undefined, in_app: false },
                  { function: undefined, in_app: false },
                ],
              },
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('keeps crashes that include app JS frames', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'Some crash',
              stacktrace: {
                frames: [
                  { function: 'hermes::vm::Runtime::interpretFunctionImpl', in_app: false },
                  { function: 'myAppFunction', in_app: true },
                ],
              },
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBe(event);
    });

    it('keeps events with no stacktrace frames', () => {
      const event = makeEvent({
        exception: {
          values: [{ type: 'Error', value: 'No stack' }],
        },
      });
      expect(sentryBeforeSend(event)).toBe(event);
    });

    it('keeps events with empty exception values', () => {
      const event = makeEvent({ exception: { values: [] } });
      expect(sentryBeforeSend(event)).toBe(event);
    });
  });

  describe('RevenueCat anonymous logOut filter', () => {
    it('drops the iOS phrasing "LogOut was called but the current user is anonymous."', () => {
      const event = makeEvent({
        exception: {
          values: [
            { type: 'Error', value: 'LogOut was called but the current user is anonymous.' },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('drops the Android phrasing "Called logOut but the current user is anonymous."', () => {
      const event = makeEvent({
        exception: {
          values: [{ type: 'Error', value: 'Called logOut but the current user is anonymous.' }],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });
  });

  describe('regular errors pass through', () => {
    it('passes JS application errors', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'TypeError',
              value: 'Cannot read property of undefined',
              stacktrace: {
                frames: [
                  { function: 'handlePress', in_app: true },
                  { function: 'onCallback', in_app: true },
                ],
              },
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBe(event);
    });

    it('passes GraphQL errors', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'ClientError',
              value: 'Please check your input and try again.',
              stacktrace: {
                frames: [
                  { function: 'runRequest', in_app: false },
                  { function: 'mutationFn', in_app: true },
                ],
              },
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBe(event);
    });
  });
});
