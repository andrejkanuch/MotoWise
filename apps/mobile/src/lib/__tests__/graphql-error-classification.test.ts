import {
  describeGraphQLError,
  describeGraphQLErrorFromMessage,
  GRAPHQL_ERROR_CODE,
  graphQLFingerprint,
  HANDLED_GRAPHQL_CAPTURE_SOURCE,
  isExpectedBusinessRuleCode,
  isHandledGraphQLCaptureSource,
  isMissingGqlSessionError,
  MISSING_GQL_SESSION_MESSAGE,
  MissingGqlSessionError,
} from '../graphql-error-classification';

/** A graphql-request ClientError, as it reaches callers. */
function clientError(
  message: string,
  code: string,
  path: string[] = ['maintenanceTasks'],
  query = 'query MaintenanceTasksByMotorcycle($motorcycleId: String!) {\n  maintenanceTasks {\n id }\n}',
) {
  const response = { data: null, errors: [{ message, path, extensions: { code } }] };
  const error = new Error(`${message}: ${JSON.stringify({ response, request: { query } })}`);
  return Object.assign(error, { response, request: { query } });
}

describe('isExpectedBusinessRuleCode', () => {
  it.each([
    GRAPHQL_ERROR_CODE.BAD_REQUEST,
    GRAPHQL_ERROR_CODE.BAD_USER_INPUT,
    GRAPHQL_ERROR_CODE.NOT_FOUND,
    GRAPHQL_ERROR_CODE.CONFLICT,
    GRAPHQL_ERROR_CODE.TOO_MANY_REQUESTS,
  ])('treats %s as expected product behaviour', (code) => {
    expect(isExpectedBusinessRuleCode(code)).toBe(true);
  });

  it.each([
    GRAPHQL_ERROR_CODE.UNAUTHENTICATED,
    GRAPHQL_ERROR_CODE.FORBIDDEN,
    GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR,
    GRAPHQL_ERROR_CODE.SERVICE_UNAVAILABLE,
  ])('keeps %s reportable', (code) => {
    expect(isExpectedBusinessRuleCode(code)).toBe(false);
  });

  it('keeps unknown and missing codes reportable', () => {
    expect(isExpectedBusinessRuleCode(undefined)).toBe(false);
    expect(isExpectedBusinessRuleCode('SOMETHING_NEW')).toBe(false);
  });
});

describe('isHandledGraphQLCaptureSource', () => {
  it('recognises the two global TanStack Query handlers', () => {
    expect(isHandledGraphQLCaptureSource(HANDLED_GRAPHQL_CAPTURE_SOURCE.QUERY_CACHE)).toBe(true);
    expect(isHandledGraphQLCaptureSource(HANDLED_GRAPHQL_CAPTURE_SOURCE.MUTATION_CACHE)).toBe(true);
  });

  it('rejects deliberate capture sites and missing sources', () => {
    expect(isHandledGraphQLCaptureSource('ride-sync-queue.moveToDeadLetter')).toBe(false);
    expect(isHandledGraphQLCaptureSource('carplay-coordinator.loadHeadsUpData')).toBe(false);
    expect(isHandledGraphQLCaptureSource(undefined)).toBe(false);
    expect(isHandledGraphQLCaptureSource(42)).toBe(false);
  });
});

describe('MissingGqlSessionError', () => {
  it('is recognisable by marker and by instance', () => {
    const error = new MissingGqlSessionError('MyMotorcycles');
    expect(isMissingGqlSessionError(error)).toBe(true);
    // Survives the structured-clone / plain-object round trip a Sentry hint can do.
    expect(isMissingGqlSessionError({ isMissingGqlSession: true })).toBe(true);
    expect(isMissingGqlSessionError(new Error('boom'))).toBe(false);
    expect(isMissingGqlSessionError(undefined)).toBe(false);
  });

  it('names the operation in the message while keeping the stable prefix', () => {
    const error = new MissingGqlSessionError('MyMotorcycles');
    expect(error.message).toContain(MISSING_GQL_SESSION_MESSAGE);
    expect(error.message).toContain('MyMotorcycles');
  });

  // Callers (query-client's onError suppression, userFriendlyError) key off the
  // GraphQL shape — the fail-fast error must not change what they see.
  it('carries an UNAUTHENTICATED GraphQL response shape', () => {
    const error = new MissingGqlSessionError();
    expect(error.response.errors[0].extensions.code).toBe(GRAPHQL_ERROR_CODE.UNAUTHENTICATED);
    expect(describeGraphQLError(error)?.code).toBe(GRAPHQL_ERROR_CODE.UNAUTHENTICATED);
  });
});

describe('describeGraphQLError', () => {
  it('reads code, message, field path and operation name off a ClientError', () => {
    const error = clientError('Missing authorization header', GRAPHQL_ERROR_CODE.UNAUTHENTICATED);
    expect(describeGraphQLError(error)).toEqual({
      code: GRAPHQL_ERROR_CODE.UNAUTHENTICATED,
      message: 'Missing authorization header',
      path: 'maintenanceTasks',
      operationName: 'MaintenanceTasksByMotorcycle',
    });
  });

  it('returns null for non-GraphQL failures', () => {
    expect(describeGraphQLError(new Error('Network request failed'))).toBeNull();
    expect(describeGraphQLError({ response: { errors: [] } })).toBeNull();
    expect(describeGraphQLError({ response: {} })).toBeNull();
    expect(describeGraphQLError(undefined)).toBeNull();
    expect(describeGraphQLError('boom')).toBeNull();
  });
});

describe('describeGraphQLErrorFromMessage', () => {
  it('recovers code, message and path from the serialized ClientError message', () => {
    const message = clientError(
      'Your free plan includes 1 motorcycle. Upgrade to Pro for unlimited bikes.',
      GRAPHQL_ERROR_CODE.BAD_REQUEST,
      ['createMotorcycle'],
      'mutation CreateMotorcycle($input: CreateMotorcycleInput!) {\n  createMotorcycle { id }\n}',
    ).message;

    expect(describeGraphQLErrorFromMessage(message)).toEqual({
      code: GRAPHQL_ERROR_CODE.BAD_REQUEST,
      message: 'Your free plan includes 1 motorcycle. Upgrade to Pro for unlimited bikes.',
      path: 'createMotorcycle',
      operationName: 'CreateMotorcycle',
    });
  });

  it('returns null for messages that are not serialized ClientErrors', () => {
    expect(describeGraphQLErrorFromMessage('Please check your input and try again.')).toBeNull();
    expect(describeGraphQLErrorFromMessage(undefined)).toBeNull();
  });
});

describe('graphQLFingerprint', () => {
  it('groups by failing field + code, not by message', () => {
    const a = graphQLFingerprint({
      code: GRAPHQL_ERROR_CODE.BAD_REQUEST,
      message: 'Waypoint limit exceeded. Maximum 10000 per ride.',
      path: 'uploadWaypoints',
    });
    const b = graphQLFingerprint({
      code: GRAPHQL_ERROR_CODE.BAD_REQUEST,
      message: 'Waypoint limit exceeded. Maximum 500 per ride.',
      path: 'uploadWaypoints',
    });
    expect(a).toEqual(b);
  });

  it('separates different fields and different codes', () => {
    const base = { message: 'nope', path: 'uploadWaypoints' };
    expect(graphQLFingerprint({ ...base, code: GRAPHQL_ERROR_CODE.BAD_REQUEST })).not.toEqual(
      graphQLFingerprint({ ...base, code: GRAPHQL_ERROR_CODE.FORBIDDEN }),
    );
    expect(graphQLFingerprint({ ...base, code: GRAPHQL_ERROR_CODE.BAD_REQUEST })).not.toEqual(
      graphQLFingerprint({ ...base, path: 'startRide', code: GRAPHQL_ERROR_CODE.BAD_REQUEST }),
    );
  });

  it('falls back to the operation name, then a placeholder', () => {
    expect(graphQLFingerprint({ message: 'x', operationName: 'StartRide' })).toContain('StartRide');
    expect(graphQLFingerprint({ message: 'x' })).toEqual([
      'graphql-client-error',
      'unknown-operation',
      'no-code',
    ]);
  });
});
