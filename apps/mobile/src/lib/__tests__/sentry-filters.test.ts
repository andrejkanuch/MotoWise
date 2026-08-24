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
import {
  GRAPHQL_ERROR_CODE,
  HANDLED_GRAPHQL_CAPTURE_SOURCE,
  MissingGqlSessionError,
} from '../graphql-error-classification';

function makeEvent(overrides: Partial<SentryEvent> = {}): SentryEvent {
  return {
    exception: { values: [] },
    ...overrides,
  } as SentryEvent;
}

/**
 * A graphql-request ClientError plus the Sentry event it produces. `source`
 * defaults to the global mutation handler — the path that has already shown the
 * user `userFriendlyError(error)`.
 */
function graphQLFailure(
  message: string,
  code: string,
  path: string[] = ['maintenanceTasks'],
  query = 'query MaintenanceTasksByMotorcycle($motorcycleId: String!) { maintenanceTasks { id } }',
  source: string = HANDLED_GRAPHQL_CAPTURE_SOURCE.MUTATION_CACHE,
) {
  const response = { data: null, errors: [{ message, path, extensions: { code } }] };
  const request = { query };
  const value = `${message}: ${JSON.stringify({ response, request })}`;
  return {
    error: Object.assign(new Error(value), { response, request }),
    event: makeEvent({
      exception: { values: [{ type: 'ClientError', value }] },
      extra: { source },
    }),
  };
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

  describe('missing-session filter (MOTO-VAULT-REACT-NATIVE-1J)', () => {
    it('drops the fail-fast error thrown when nobody is signed in', () => {
      const error = new MissingGqlSessionError('MyMotorcycles');
      const event = makeEvent({
        exception: { values: [{ type: 'MissingGqlSessionError', value: error.message }] },
      });
      expect(sentryBeforeSend(event, { originalException: error })).toBeNull();
    });

    it('drops it from the serialized message alone (no hint available)', () => {
      const event = makeEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: new MissingGqlSessionError('StartRide').message,
            },
          ],
        },
      });
      expect(sentryBeforeSend(event)).toBeNull();
    });
  });

  describe('handled GraphQL business-rule filter (MOTO-VAULT-REACT-NATIVE-1J / -1M)', () => {
    it.each([
      [
        'Your free plan includes 1 motorcycle. Upgrade to Pro for unlimited bikes.',
        'createMotorcycle',
      ],
      [
        "This topic doesn't seem related to motorcycles. Try something like: ...",
        'generateArticle',
      ],
      ['Invalid trip dates. The end date must be on or after the start date.', 'updateTrip'],
      ['trip not found, not published/active, or you are the organiser', 'joinTrip'],
      ['Failed to delete expense', 'deleteExpense'],
    ])('drops the handled rejection "%s"', (message, field) => {
      const { error, event } = graphQLFailure(message, GRAPHQL_ERROR_CODE.BAD_REQUEST, [field]);
      expect(sentryBeforeSend(event, { originalException: error })).toBeNull();
    });

    it('drops handled rejections reported by the global query handler too', () => {
      const { error, event } = graphQLFailure(
        'The requested item could not be found.',
        GRAPHQL_ERROR_CODE.NOT_FOUND,
        ['trip'],
        'query Trip($id: String!) { trip { id } }',
        HANDLED_GRAPHQL_CAPTURE_SOURCE.QUERY_CACHE,
      );
      expect(sentryBeforeSend(event, { originalException: error })).toBeNull();
    });

    // The gate is "the user was already told", not the code alone: a deliberate
    // capture site keeps its signal. A dead-lettered ride op is silent data loss
    // even though the server rejected it with a business-rule code — that is the
    // waypoint-limit signal behind MOTO-VAULT-REACT-NATIVE-1M, and it must survive.
    it('keeps an expected code captured from a deliberate site (dead-letter)', () => {
      const { error, event } = graphQLFailure(
        'Waypoint limit exceeded. Maximum 10000 per ride.',
        GRAPHQL_ERROR_CODE.BAD_REQUEST,
        ['uploadWaypoints'],
        'mutation UploadWaypoints($input: UploadWaypointsInput!) { uploadWaypoints { id } }',
        'ride-sync-queue.moveToDeadLetter',
      );
      expect(sentryBeforeSend(event, { originalException: error })).toBe(event);
    });

    it('keeps an expected code when no capture source is recorded', () => {
      const { error, event } = graphQLFailure(
        'Failed to delete expense',
        GRAPHQL_ERROR_CODE.BAD_REQUEST,
        ['deleteExpense'],
        'mutation DeleteExpense($id: String!) { deleteExpense }',
        '',
      );
      expect(sentryBeforeSend(event, { originalException: error })).toBe(event);
    });

    it('drops handled rejections when only the serialized message is available', () => {
      const { event } = graphQLFailure(
        'Please check your input and try again.',
        GRAPHQL_ERROR_CODE.BAD_USER_INPUT,
        ['createExpense'],
      );
      expect(sentryBeforeSend(event)).toBeNull();
    });

    it('keeps genuine server failures', () => {
      const { error, event } = graphQLFailure(
        'Internal server error',
        GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
        ['startRide'],
      );
      expect(sentryBeforeSend(event, { originalException: error })).toBe(event);
    });

    it('keeps a real UNAUTHENTICATED rejection (a session existed and still failed)', () => {
      const { error, event } = graphQLFailure(
        'Missing authorization header',
        GRAPHQL_ERROR_CODE.UNAUTHENTICATED,
      );
      expect(sentryBeforeSend(event, { originalException: error })).toBe(event);
    });

    it('keeps FORBIDDEN — an authorization anomaly the client should not have offered', () => {
      const { error, event } = graphQLFailure('Forbidden resource', GRAPHQL_ERROR_CODE.FORBIDDEN, [
        'deleteRide',
      ]);
      expect(sentryBeforeSend(event, { originalException: error })).toBe(event);
    });
  });

  describe('GraphQL grouping', () => {
    it('fingerprints on field + code and tags the operation', () => {
      const { error, event } = graphQLFailure(
        'Internal server error',
        GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
        ['startRide'],
        'mutation StartRide($input: StartRideInput!) { startRide { id } }',
      );

      const result = sentryBeforeSend(event, { originalException: error });

      expect(result?.fingerprint).toEqual([
        'graphql-client-error',
        'startRide',
        GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
      ]);
      expect(result?.tags).toMatchObject({
        'graphql.code': GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
        'graphql.field': 'startRide',
        'graphql.operation': 'StartRide',
      });
    });

    it('trims the title to the server message (no serialized response body)', () => {
      const { error, event } = graphQLFailure(
        'Internal server error',
        GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
        ['startRide'],
      );

      const result = sentryBeforeSend(event, { originalException: error });

      expect(result?.exception?.values?.[0]?.value).toBe('Internal server error');
    });

    it('gives two different failing fields two different fingerprints', () => {
      const a = graphQLFailure('Internal server error', GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR, [
        'startRide',
      ]);
      const b = graphQLFailure('Internal server error', GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR, [
        'uploadWaypoints',
      ]);

      expect(sentryBeforeSend(a.event, { originalException: a.error })?.fingerprint).not.toEqual(
        sentryBeforeSend(b.event, { originalException: b.error })?.fingerprint,
      );
    });

    it('leaves non-GraphQL events unfingerprinted', () => {
      const event = makeEvent({
        exception: { values: [{ type: 'TypeError', value: 'x is not a function' }] },
      });
      expect(sentryBeforeSend(event)?.fingerprint).toBeUndefined();
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
