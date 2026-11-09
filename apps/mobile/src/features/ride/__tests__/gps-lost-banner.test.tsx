// When location permission is revoked mid-ride the HUD says so and offers the two
// ways out (recovery itself: use-gps-permission-recovery.test).

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('../use-gps-permission-recovery', () => ({ useGpsPermissionRecovery: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useRideStore } from '@/stores/ride.store';
import { GpsLostBanner } from '../gps-lost-banner';

beforeEach(() => {
  jest.clearAllMocks();
  useRideStore.setState({ gpsPermissionLost: true });
});

describe('GpsLostBanner', () => {
  it('renders nothing while permission is fine', async () => {
    useRideStore.setState({ gpsPermissionLost: false });
    await render(<GpsLostBanner onEndRide={jest.fn()} />);
    expect(screen.queryByText('rideHud.gpsLostTitle')).toBeNull();
  });

  it('offers Settings and End ride when permission was lost', async () => {
    const onEndRide = jest.fn();
    await render(<GpsLostBanner onEndRide={onEndRide} />);
    fireEvent.press(screen.getByText('startRide.openSettings'));
    // React Native's jest preset already mocks Linking.
    expect(Linking.openSettings).toHaveBeenCalled();
    fireEvent.press(screen.getByText('rideHud.actionEndRide'));
    expect(onEndRide).toHaveBeenCalled();
  });
});
