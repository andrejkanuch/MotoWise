const mockGetForeground = jest.fn();
const mockGetBackground = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetForeground(),
  getBackgroundPermissionsAsync: () => mockGetBackground(),
}));

// ride-permissions imports these at module load — stub so no native deps load.
jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));
jest.mock('../ride-storage', () => ({
  rideStorage: { getNumber: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import { hasAllLocationPermissions } from '../ride-permissions';

beforeEach(() => {
  mockGetForeground.mockReset();
  mockGetBackground.mockReset();
});

describe('hasAllLocationPermissions', () => {
  it('returns false when foreground is not granted (and never reads background)', async () => {
    mockGetForeground.mockResolvedValue({ granted: false });
    expect(await hasAllLocationPermissions()).toBe(false);
    expect(mockGetBackground).not.toHaveBeenCalled();
  });

  it('returns false when foreground is granted but background is not', async () => {
    mockGetForeground.mockResolvedValue({ granted: true });
    mockGetBackground.mockResolvedValue({ granted: false });
    expect(await hasAllLocationPermissions()).toBe(false);
  });

  it('returns true only when both foreground and background are granted', async () => {
    mockGetForeground.mockResolvedValue({ granted: true });
    mockGetBackground.mockResolvedValue({ granted: true });
    expect(await hasAllLocationPermissions()).toBe(true);
  });

  it('treats a thrown background read as not-granted so the disclosure is still shown', async () => {
    mockGetForeground.mockResolvedValue({ granted: true });
    mockGetBackground.mockRejectedValue(new Error('ACCESS_BACKGROUND_LOCATION not in manifest'));
    expect(await hasAllLocationPermissions()).toBe(false);
  });

  it('treats a thrown foreground read as not-granted (and never reads background)', async () => {
    mockGetForeground.mockRejectedValue(new Error('foreground permission read failed'));
    expect(await hasAllLocationPermissions()).toBe(false);
    expect(mockGetBackground).not.toHaveBeenCalled();
  });
});
