jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { makeMutable } from 'react-native-reanimated';
import '../../../i18n';
import { BIKE_ORIGIN, BIKE_SEGMENT, HUB_UNIT } from '../../../lib/bike-hub/constants';
import { BikeHeader, type BikeHeaderBike } from '../ui/bike-header';
import { SegmentBar } from '../ui/segment-bar';

const AFRICA_TWIN: BikeHeaderBike = {
  make: 'Honda',
  model: 'Africa Twin',
  year: 2022,
  currentMileage: 38_167,
};

function header(overrides: Partial<Parameters<typeof BikeHeader>[0]> = {}) {
  return (
    <BikeHeader
      bike={AFRICA_TWIN}
      origin={BIKE_ORIGIN.GARAGE}
      unit={HUB_UNIT.KM}
      collapse={makeMutable(0)}
      onBack={jest.fn()}
      onOdometerPress={jest.fn()}
      {...overrides}
    />
  );
}

describe('BikeHeader', () => {
  it('renders the name, the eyebrow and "38,167 km"', async () => {
    await render(header());
    expect(screen.getByText('Africa Twin')).toBeOnTheScreen();
    expect(screen.getByText('2022 · Honda')).toBeOnTheScreen();
    expect(screen.getByText('38,167 km')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Odometer 38,167 km, tap to update' }),
    ).toBeOnTheScreen();
  });

  it.each([
    [BIKE_ORIGIN.GARAGE, 'Back to Garage'],
    [BIKE_ORIGIN.HOME, 'Back to Home'],
    [BIKE_ORIGIN.PROFILE, 'Back to Profile'],
  ])('origin %s labels the back button "%s"', async (origin, label) => {
    const onBack = jest.fn();
    await render(header({ origin, onBack }));
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('a miles bike shows mi — the raw value is not converted', async () => {
    await render(header({ unit: HUB_UNIT.MI, bike: { ...AFRICA_TWIN, currentMileage: 23_716 } }));
    expect(screen.getByText('23,716 mi')).toBeOnTheScreen();
  });

  it('shows "Set odometer" when the bike has none, and opens the editor', async () => {
    const onOdometerPress = jest.fn();
    await render(header({ bike: { ...AFRICA_TWIN, currentMileage: null }, onOdometerPress }));
    await fireEvent.press(screen.getByText('Set odometer'));
    expect(onOdometerPress).toHaveBeenCalledTimes(1);
  });

  it('an odometer of 0 is "not set": the chip invites setting it instead of showing "0 km"', async () => {
    await render(header({ bike: { ...AFRICA_TWIN, currentMileage: 0 } }));
    expect(screen.getByText('Set odometer')).toBeOnTheScreen();
    expect(screen.queryByText('0 km')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Odometer not set, tap to set it' }),
    ).toBeOnTheScreen();
  });

  it('without a bike (loading / not found) still offers a working back button', async () => {
    const onBack = jest.fn();
    await render(header({ bike: null, onBack }));
    expect(screen.queryByTestId('bike-header-odometer')).toBeNull();
    await fireEvent.press(screen.getByTestId('bike-header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('SegmentBar', () => {
  it('renders the four segments in order with the selected state', async () => {
    await render(<SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Overview',
      'Service',
      'Costs',
      'Bike',
    ]);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Costs' })).not.toBeSelected();
  });

  it('fires onChange with the typed segment id, and not for the selected one', async () => {
    const onChange = jest.fn();
    await render(<SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Costs' }));
    expect(onChange).toHaveBeenCalledWith(BIKE_SEGMENT.COSTS);
    await fireEvent.press(screen.getByRole('tab', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('hides the badge at 0', async () => {
    await render(
      <SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} serviceBadge={0} />,
    );
    expect(screen.getByRole('tab', { name: 'Service' })).toBeOnTheScreen();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows the badge at 1 and reads it in the Service tab label', async () => {
    await render(
      <SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} serviceBadge={1} />,
    );
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Service, 1 overdue task' })).toBeOnTheScreen();
  });

  it('pluralises the badge label (the count is overdue tasks of any priority)', async () => {
    await render(
      <SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} serviceBadge={5} />,
    );
    expect(screen.getByRole('tab', { name: 'Service, 5 overdue tasks' })).toBeOnTheScreen();
  });
});

describe('largest Dynamic Type: the chrome stops growing at 1.3×', () => {
  it('caps the bike name, the eyebrow and the odometer chip', async () => {
    await render(header());
    for (const text of ['Africa Twin', '2022 · Honda', '38,167 km']) {
      expect(screen.getByText(text).props.maxFontSizeMultiplier).toBe(1.3);
    }
  });

  it('caps the segment labels and the badge, and lets a pill grow instead of clipping its label', async () => {
    await render(
      <SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} serviceBadge={1} />,
    );
    for (const text of ['Overview', 'Service', 'Costs', 'Bike', '1']) {
      expect(screen.getByText(text).props.maxFontSizeMultiplier).toBe(1.3);
    }
    const pill = StyleSheet.flatten(screen.getByTestId('segment-overview').props.style);
    expect(pill.minHeight).toBe(36);
    expect(pill.height).toBeUndefined();
  });

  it('segment labels stay on one line (the bar scrolls instead of wrapping)', async () => {
    await render(<SegmentBar active={BIKE_SEGMENT.OVERVIEW} onChange={jest.fn()} />);
    for (const text of ['Overview', 'Service', 'Costs', 'Bike']) {
      expect(screen.getByText(text).props.numberOfLines).toBe(1);
    }
  });

  it('the odometer chip never gives way to the name: one line, no shrink, unit kept', async () => {
    await render(header());
    expect(screen.getByText('38,167 km').props.numberOfLines).toBe(1);
    const chip = StyleSheet.flatten(screen.getByTestId('bike-header-odometer').props.style);
    expect(chip.flexShrink).toBe(0);
  });
});
