// FS-PO8 (issue 365, T29): opening Discover must not raise the OS location
// dialog. On Android the permission controller pauses the app, so 42 of 43
// riders' first Discover visit "backgrounded" within 2 s. The hook may only
// read the current permission on mount; it asks only after the rider taps
// "Use my location".

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetLastKnown = jest.fn();
const mockGetCurrent = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetPermissions(),
  requestForegroundPermissionsAsync: () => mockRequestPermissions(),
  getLastKnownPositionAsync: () => mockGetLastKnown(),
  getCurrentPositionAsync: (opts: unknown) => mockGetCurrent(opts),
  Accuracy: { Low: 1 },
}));

const mockReverseGeocode = jest.fn();
jest.mock('../../utils/mapbox-geocoding', () => ({
  reverseGeocodeCountryCode: (lat: number, lng: number) => mockReverseGeocode(lat, lng),
}));

jest.mock('react-native', () => ({
  Linking: { openSettings: () => mockOpenSettings() },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LOCATION_ACCESS, useUserCountry } from '../use-user-country';

const ROME = { coords: { latitude: 41.9, longitude: 12.5 } };

let queryClient: QueryClient;

function renderUserCountry() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUserCountry(), { wrapper });
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const mock of [
    mockGetPermissions,
    mockRequestPermissions,
    mockGetLastKnown,
    mockGetCurrent,
    mockOpenSettings,
    mockReverseGeocode,
  ]) {
    mock.mockReset();
  }
  mockGetLastKnown.mockResolvedValue(ROME);
  mockReverseGeocode.mockResolvedValue('IT');
});

afterEach(() => {
  queryClient.clear();
});

describe('useUserCountry', () => {
  it('does not request location permission on mount (no OS dialog on Discover open)', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    const { result } = await renderUserCountry();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetLastKnown).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({
      access: LOCATION_ACCESS.NOT_ASKED,
      countryCode: null,
      coords: null,
    });
  });

  it('resolves silently when the rider already granted location', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    const { result } = await renderUserCountry();

    await waitFor(() => expect(result.current.data?.access).toBe(LOCATION_ACCESS.GRANTED));
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(result.current.data).toMatchObject({
      countryCode: 'IT',
      coords: { latitude: 41.9, longitude: 12.5 },
    });
  });

  it('asks only after the rider taps "Use my location", then resolves the country', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    const { result } = await renderUserCountry();
    await waitFor(() => expect(result.current.data?.access).toBe(LOCATION_ACCESS.NOT_ASKED));

    await act(async () => {
      await result.current.requestLocation();
    });

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data?.countryCode).toBe('IT'));
  });

  it('opens system settings when Android will no longer show the dialog', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });
    mockRequestPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const { result } = await renderUserCountry();
    await waitFor(() => expect(result.current.data?.access).toBe(LOCATION_ACCESS.BLOCKED));

    await act(async () => {
      await result.current.requestLocation();
    });

    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });
});
