jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
let mockColorScheme = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { HUB_UNIT } from '@/lib/bike-hub/constants';
import { ServiceDistanceRow } from '../overview/service-distance-row';

// The English source strings of the row (en.json is updated by the i18n unit).
beforeAll(() => {
  i18n.addResourceBundle(
    'en',
    'translation',
    {
      bikeHub: {
        serviceDistance: {
          since: '{{distance}} {{unit}} since last service',
          servicedAt: 'Last service at {{distance}} {{unit}}',
          none: 'No service logged',
        },
      },
    },
    true,
    true,
  );
});

describe.each(['light', 'dark'])('ServiceDistanceRow (%s)', (scheme) => {
  beforeEach(() => {
    mockColorScheme = scheme;
  });

  it('shows the distance since the last service in the bike unit', async () => {
    await render(
      <ServiceDistanceRow
        since={{ distance: 1_250, serviceOdometer: 12_000 }}
        unit={HUB_UNIT.KM}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('1,250 km since last service')).toBeTruthy();
    expect(screen.getByText('Last service at 12,000 km')).toBeTruthy();
  });

  it('shows miles for a mile-unit bike', async () => {
    await render(
      <ServiceDistanceRow
        since={{ distance: 800, serviceOdometer: 5_000 }}
        unit={HUB_UNIT.MI}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('800 mi since last service')).toBeTruthy();
  });

  it('reads "No service logged" with no service, and opens Service on press', async () => {
    const onPress = jest.fn();
    await render(<ServiceDistanceRow since={null} unit={HUB_UNIT.KM} onPress={onPress} />);
    await fireEvent.press(screen.getByText('No service logged'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
