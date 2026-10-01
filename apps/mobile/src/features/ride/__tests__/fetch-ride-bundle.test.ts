jest.mock('@motovault/graphql', () => ({
  GetRideDocument: 'GetRideDocument',
  GetPublicRideDocument: 'GetPublicRideDocument',
}));
jest.mock('../../../lib/graphql-client', () => ({ gqlFetcher: jest.fn() }));

import { gqlFetcher } from '../../../lib/graphql-client';
import { fetchRideBundle, RIDE_VIEWER } from '../fetch-ride-bundle';

const fetcher = gqlFetcher as jest.Mock;
// graphql-request's ClientError shape: response.errors[].extensions.code
const gqlError = (code: string) =>
  Object.assign(new Error(code), {
    response: { errors: [{ message: code, extensions: { code } }] },
  });

beforeEach(() => fetcher.mockReset());

describe('fetchRideBundle', () => {
  it('returns the owner view when GetRide succeeds', async () => {
    fetcher.mockResolvedValueOnce({ ride: { id: 'r1' } });
    await expect(fetchRideBundle('r1')).resolves.toEqual({
      viewer: RIDE_VIEWER.owner,
      ride: { id: 'r1' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    'NOT_FOUND',
    'UNAUTHENTICATED',
    'FORBIDDEN',
  ])('falls back to the public ride on %s (not yours / signed out)', async (code) => {
    fetcher
      .mockRejectedValueOnce(gqlError(code))
      .mockResolvedValueOnce({ getPublicRide: { id: 'r1' } });
    await expect(fetchRideBundle('r1')).resolves.toEqual({
      viewer: RIDE_VIEWER.public,
      ride: { id: 'r1' },
    });
    expect(fetcher).toHaveBeenLastCalledWith('GetPublicRideDocument', { id: 'r1' });
  });

  // MOTO-VAULT-REACT-NATIVE-1M: the public lookup used to mask these as "Ride not found".
  it('rethrows a network or server failure instead of masking it as not found', async () => {
    const offline = new Error('Network request failed');
    fetcher.mockRejectedValueOnce(offline);
    await expect(fetchRideBundle('r1')).rejects.toBe(offline);

    const serverError = gqlError('INTERNAL_SERVER_ERROR');
    fetcher.mockRejectedValueOnce(serverError);
    await expect(fetchRideBundle('r1')).rejects.toBe(serverError);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
