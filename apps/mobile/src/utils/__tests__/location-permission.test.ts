// MOT-269 code-review gap: requestForegroundLocationPermission coalesces the two
// independent Discover-mount callers onto one native request (expo-location
// rejects a second in-flight request). Pin that the in-flight promise is shared
// and cleared after settling so a later call re-requests.

const mockRequest = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequest(),
}));

import { requestForegroundLocationPermission } from '../location-permission';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requestForegroundLocationPermission', () => {
  it('coalesces concurrent callers onto a single native request', async () => {
    let resolveNative: (v: { status: string }) => void = () => {};
    mockRequest.mockReturnValueOnce(
      new Promise((res) => {
        resolveNative = res;
      }),
    );

    const p1 = requestForegroundLocationPermission();
    const p2 = requestForegroundLocationPermission();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);

    resolveNative({ status: 'granted' });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe('granted');
    expect(r2.status).toBe('granted');
  });

  it('clears the in-flight promise after resolution so a later call re-requests', async () => {
    mockRequest.mockResolvedValueOnce({ status: 'granted' });
    const first = await requestForegroundLocationPermission();
    expect(first.status).toBe('granted');

    mockRequest.mockResolvedValueOnce({ status: 'denied' });
    const second = await requestForegroundLocationPermission();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(second.status).toBe('denied');
  });

  it('clears the in-flight promise after rejection so a retry re-requests', async () => {
    mockRequest.mockRejectedValueOnce(new Error('already in progress'));
    await expect(requestForegroundLocationPermission()).rejects.toThrow('already in progress');

    mockRequest.mockResolvedValueOnce({ status: 'granted' });
    const retry = await requestForegroundLocationPermission();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(retry.status).toBe('granted');
  });
});
