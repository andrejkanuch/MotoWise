import {
  isProviderSideFailure,
  isUpstreamHttpError,
  UPSTREAM_SERVICE,
  UpstreamHttpError,
} from '../upstream-http-error';

describe('UpstreamHttpError', () => {
  it('builds the "<service> <status>" message the Sentry issue title is grouped on', () => {
    // Pinned so the existing issue title (MOTO-VAULT-REACT-NATIVE-35
    // "Error: Open-Meteo 503") and any log grepping stay valid.
    expect(new UpstreamHttpError(UPSTREAM_SERVICE.OPEN_METEO, 503).message).toBe('Open-Meteo 503');
    expect(new UpstreamHttpError(UPSTREAM_SERVICE.MAPBOX, 429).message).toBe('Mapbox 429');
  });

  it('carries the service and status as structured fields', () => {
    const error = new UpstreamHttpError(UPSTREAM_SERVICE.OPEN_METEO, 503);
    expect(error.service).toBe(UPSTREAM_SERVICE.OPEN_METEO);
    expect(error.status).toBe(503);
    expect(error.name).toBe('UpstreamHttpError');
  });
});

describe('isUpstreamHttpError', () => {
  it('is true for an instance', () => {
    expect(isUpstreamHttpError(new UpstreamHttpError(UPSTREAM_SERVICE.OPEN_METEO, 503))).toBe(true);
  });

  it('is true for a structurally cloned / re-thrown copy carrying the brand', () => {
    expect(
      isUpstreamHttpError({ isUpstreamHttpError: true, service: 'Open-Meteo', status: 503 }),
    ).toBe(true);
  });

  it('is FALSE for a bare Error with an identical message', () => {
    // The load-bearing assertion: the filter keys on the type, never the string.
    expect(isUpstreamHttpError(new Error('Open-Meteo 503'))).toBe(false);
  });

  it.each([
    null,
    undefined,
    'Open-Meteo 503',
    503,
    {},
    { isUpstreamHttpError: false },
  ])('is false for %p', (value) => {
    expect(isUpstreamHttpError(value)).toBe(false);
  });
});

describe('isProviderSideFailure', () => {
  it.each([500, 502, 503, 504, 429, 408])('treats %i as the provider failing', (status) => {
    expect(isProviderSideFailure(status)).toBe(true);
  });

  it.each([200, 400, 401, 403, 404, 418, 422])('treats %i as OUR bug, never filtered', (status) => {
    expect(isProviderSideFailure(status)).toBe(false);
  });
});
