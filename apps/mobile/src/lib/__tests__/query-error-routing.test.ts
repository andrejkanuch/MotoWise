/**
 * Routing for failures that reach the GLOBAL TanStack Query error handler:
 * which ones become a Sentry error, which become a breadcrumb, and which are
 * allowed to interrupt the rider with a modal.
 *
 * Group B is the load-bearing one — it is the executable form of the
 * NEVER-FILTER list. A "simplification" that silences a real bug must fail
 * here. (Sentry MOTO-VAULT-REACT-NATIVE-35 / -3D)
 */

jest.mock('../analytics', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import type { Query } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { addBreadcrumb, captureException } from '../analytics';
import { GRAPHQL_ERROR_CODE } from '../graphql-error-classification';
import { DOWNGRADE_REASON, downgradeReasonFor, queryClient } from '../query-client';
import { QUERY_CRITICALITY, type QueryCriticality, resolveCriticality } from '../query-criticality';
import { UPSTREAM_SERVICE, UpstreamHttpError } from '../upstream-http-error';

// Spy on the real Alert rather than replacing `react-native` wholesale — the
// jest-expo preset needs the module's other members.
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockAddBreadcrumb = addBreadcrumb as jest.Mock;
const mockCaptureException = captureException as jest.Mock;

/** A graphql-request ClientError carrying a given `extensions.code`. */
function clientError(code: string) {
  const response = { data: null, errors: [{ message: 'boom', path: ['x'], extensions: { code } }] };
  return Object.assign(new Error('boom'), { response });
}

function openMeteo(status: number) {
  return new UpstreamHttpError(UPSTREAM_SERVICE.OPEN_METEO, status);
}

describe('downgradeReasonFor', () => {
  describe('expected third-party noise IS downgraded', () => {
    it('downgrades an Open-Meteo 503 on an ENHANCEMENT query (the reported bug)', () => {
      expect(downgradeReasonFor(openMeteo(503), QUERY_CRITICALITY.ENHANCEMENT)).toBe(
        DOWNGRADE_REASON.PROVIDER_OUTAGE_NON_CRITICAL,
      );
    });

    it.each([
      500, 502, 503, 504, 429, 408,
    ])('downgrades a provider-side %i on an ENHANCEMENT query', (status) => {
      expect(downgradeReasonFor(openMeteo(status), QUERY_CRITICALITY.ENHANCEMENT)).toBe(
        DOWNGRADE_REASON.PROVIDER_OUTAGE_NON_CRITICAL,
      );
    });

    it('still downgrades transport failures (rule 1 unchanged)', () => {
      expect(
        downgradeReasonFor(new TypeError('Network request failed'), QUERY_CRITICALITY.CRITICAL),
      ).toBe(DOWNGRADE_REASON.TRANSPORT);
    });

    it('still downgrades GraphQL SERVICE_UNAVAILABLE (rule 2 unchanged)', () => {
      expect(
        downgradeReasonFor(
          clientError(GRAPHQL_ERROR_CODE.SERVICE_UNAVAILABLE),
          QUERY_CRITICALITY.CRITICAL,
        ),
      ).toBe(DOWNGRADE_REASON.UPSTREAM_OUTAGE);
    });
  });

  describe('a real error STILL reports (NEVER-FILTER list)', () => {
    it('reports a provider outage on a query that did not declare ENHANCEMENT [N7]', () => {
      expect(downgradeReasonFor(openMeteo(503), QUERY_CRITICALITY.CRITICAL)).toBeNull();
    });

    it.each([
      400, 401, 403, 404, 422,
    ])('reports a %i from the provider even on an ENHANCEMENT query — that status is our bug [N6]', (status) => {
      expect(downgradeReasonFor(openMeteo(status), QUERY_CRITICALITY.ENHANCEMENT)).toBeNull();
    });

    it('reports OUR OWN exception thrown inside an ENHANCEMENT query [N5]', () => {
      expect(
        downgradeReasonFor(
          new TypeError("Cannot read property 'map' of undefined"),
          QUERY_CRITICALITY.ENHANCEMENT,
        ),
      ).toBeNull();
    });

    it('reports a BARE Error with an identical message — the filter keys on the type, not the string', () => {
      expect(
        downgradeReasonFor(new Error('Open-Meteo 503'), QUERY_CRITICALITY.ENHANCEMENT),
      ).toBeNull();
    });

    it('reports GraphQL INTERNAL_SERVER_ERROR even on a mislabelled ENHANCEMENT query [N1]', () => {
      expect(
        downgradeReasonFor(
          clientError(GRAPHQL_ERROR_CODE.INTERNAL_SERVER_ERROR),
          QUERY_CRITICALITY.ENHANCEMENT,
        ),
      ).toBeNull();
    });

    it('reports GraphQL FORBIDDEN even on an ENHANCEMENT query [N3]', () => {
      expect(
        downgradeReasonFor(
          clientError(GRAPHQL_ERROR_CODE.FORBIDDEN),
          QUERY_CRITICALITY.ENHANCEMENT,
        ),
      ).toBeNull();
    });
  });

  describe('rule ordering', () => {
    it('lets the transport rule win over the provider rule on an ENHANCEMENT query', () => {
      // Rule 1 must stay first so the offline-silent path in onError is reached.
      expect(
        downgradeReasonFor(new TypeError('Network request failed'), QUERY_CRITICALITY.ENHANCEMENT),
      ).toBe(DOWNGRADE_REASON.TRANSPORT);
    });
  });
});

describe('resolveCriticality', () => {
  it('defaults to CRITICAL — silence is opt-in', () => {
    expect(resolveCriticality(undefined)).toBe(QUERY_CRITICALITY.CRITICAL);
  });
});

describe('queryCache.onError', () => {
  const onError = queryClient.getQueryCache().config.onError;

  function fakeQuery(options: { criticality?: QueryCriticality; data?: unknown }) {
    return {
      queryKey: ['weather-forecast', -18.87, 47.5],
      meta: options.criticality ? { criticality: options.criticality } : undefined,
      state: { data: options.data },
    } as unknown as Query<unknown, unknown, unknown>;
  }

  beforeEach(() => {
    alertSpy.mockClear();
    mockAddBreadcrumb.mockClear();
    mockCaptureException.mockClear();
  });

  it('shows no modal and no Sentry error for a provider outage on an ENHANCEMENT query', () => {
    onError?.(openMeteo(503), fakeQuery({ criticality: QUERY_CRITICALITY.ENHANCEMENT }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      'Open-Meteo 503',
      expect.any(String),
      expect.objectContaining({ reason: DOWNGRADE_REASON.PROVIDER_OUTAGE_NON_CRITICAL }),
    );
  });

  it('still alerts AND reports the same error on a query that did not declare ENHANCEMENT', () => {
    onError?.(openMeteo(503), fakeQuery({}));

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached-data guard: reports but does not alert when data is already present', () => {
    onError?.(openMeteo(503), fakeQuery({ data: { headline: 'cached' } }));

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('reports our own TypeError inside an ENHANCEMENT query [N5]', () => {
    onError?.(
      new TypeError("Cannot read property 'map' of undefined"),
      fakeQuery({ criticality: QUERY_CRITICALITY.ENHANCEMENT }),
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
    // The modal is still suppressed: the surface renders nothing either way.
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
