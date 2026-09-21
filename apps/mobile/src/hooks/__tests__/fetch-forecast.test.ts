/**
 * Pins the THROW-SITE contract the global query handler depends on: the
 * handler downgrades only a typed `UpstreamHttpError`, never a message match,
 * so a refactor back to `throw new Error(\`Open-Meteo ${status}\`)` must fail
 * here rather than silently re-open Sentry MOTO-VAULT-REACT-NATIVE-35.
 */

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Low: 1 },
}));

// react-query is imported by the hook module; stub so importing doesn't pull native deps.
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

import { isUpstreamHttpError, UPSTREAM_SERVICE } from '../../lib/upstream-http-error';
import { fetchForecast } from '../use-weather-forecast';

const COORDS = { lat: 48.2, lon: 16.4 };

function mockFetchStatus(status: number) {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchForecast', () => {
  it.each([503, 400])('rejects with a typed UpstreamHttpError on HTTP %i', async (status) => {
    mockFetchStatus(status);

    // A 400 must be just as typed as a 503 — the HANDLER, not the throw site,
    // decides which statuses are the provider's fault.
    await expect(fetchForecast(COORDS)).rejects.toMatchObject({
      service: UPSTREAM_SERVICE.OPEN_METEO,
      status,
    });
  });

  it('throws an error the global handler recognises by type, with the pinned message', async () => {
    mockFetchStatus(503);

    const error = await fetchForecast(COORDS).catch((e: unknown) => e);
    expect(isUpstreamHttpError(error)).toBe(true);
    expect((error as Error).message).toBe('Open-Meteo 503');
  });
});
