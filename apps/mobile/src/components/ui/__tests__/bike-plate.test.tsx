let mockColorScheme = 'dark';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

const mockReducedMotion = jest.fn(() => false);
const mockWithTiming = jest.fn((value: number, _config?: { duration?: number }) => value);
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion(),
  withTiming: (value: number, config?: { duration?: number }) => mockWithTiming(value, config),
  // The plate's fill is a cross-fade between the three state colours; the mock
  // reads the colour of the state the shared value rests on.
  interpolateColor: (value: number, _input: number[], output: string[]) =>
    output[Math.round(value)],
}));

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { editorialThemes } from '@/theme/editorial';
import { type } from '@/theme/type';
import { BikePlate, type BikePlateProps, PLATE_SIZE, PLATE_STATE } from '../bike-plate';

const BASE: BikePlateProps = {
  state: PLATE_STATE.READY,
  figure: '1,240',
  unit: 'km',
  caption: 'to Oil change',
  stateLabel: 'Due soon',
};

/** The plate panel: the figure row's parent. */
function plateStyle(figure = BASE.figure) {
  const panel = screen.getByText(figure).parent?.parent;
  return StyleSheet.flatten(panel?.props.style);
}

beforeEach(() => {
  mockColorScheme = 'dark';
  mockReducedMotion.mockReturnValue(false);
  mockWithTiming.mockClear();
});

describe('BikePlate — state', () => {
  it.each([
    [PLATE_STATE.READY, editorialThemes.dark.plateReady],
    [PLATE_STATE.DUE, editorialThemes.dark.plateDue],
    [PLATE_STATE.OVERDUE, editorialThemes.dark.plateOverdue],
  ])('%s fills the plate with its triad colour', async (state, fill) => {
    await render(<BikePlate {...BASE} state={state} />);
    expect(plateStyle().backgroundColor).toBe(fill);
  });

  it('prints ink on the plate in every state, and a keyline only on a light ground', async () => {
    await render(<BikePlate {...BASE} />);
    expect(StyleSheet.flatten(screen.getByText('1,240').props.style).color).toBe(
      editorialThemes.dark.onPlate,
    );
    expect(plateStyle().borderWidth).toBe(0);

    mockColorScheme = 'light';
    await render(<BikePlate {...BASE} />);
    expect(plateStyle().borderWidth).toBe(2);
  });
});

describe('BikePlate — size', () => {
  it('hero uses the plate numerals, compact the compact ones', async () => {
    await render(<BikePlate {...BASE} size={PLATE_SIZE.HERO} />);
    expect(StyleSheet.flatten(screen.getByText('1,240').props.style).fontSize).toBe(
      type.plate.fontSize,
    );

    await render(<BikePlate {...BASE} size={PLATE_SIZE.COMPACT} />);
    expect(StyleSheet.flatten(screen.getByText('1,240').props.style).fontSize).toBe(
      type.plateCompact.fontSize,
    );
  });
});

describe('BikePlate — identity edge', () => {
  it('prints the racing number before the identity', async () => {
    await render(<BikePlate {...BASE} identity="Honda Africa Twin · 2022" plateNumber="01" />);
    expect(screen.getByText('01 · Honda Africa Twin · 2022')).toBeOnTheScreen();
  });

  it('prints the identity alone without a number', async () => {
    await render(<BikePlate {...BASE} identity="Honda Africa Twin · 2022" />);
    expect(screen.getByText('Honda Africa Twin · 2022')).toBeOnTheScreen();
    expect(screen.queryByText(/^01/)).toBeNull();
  });

  it('has no edge at all without identity or number', async () => {
    await render(<BikePlate {...BASE} />);
    expect(screen.queryByText(/Honda/)).toBeNull();
  });
});

describe('BikePlate — caption and state word', () => {
  it('a due plate prints the state word before a caption that does not say it', async () => {
    await render(<BikePlate {...BASE} state={PLATE_STATE.DUE} />);
    expect(screen.getByText('Due soon · to Oil change')).toBeOnTheScreen();
  });

  it('ready and overdue captions already say their state', async () => {
    await render(<BikePlate {...BASE} state={PLATE_STATE.OVERDUE} caption="Brakes, past due" />);
    expect(screen.getByText('Brakes, past due')).toBeOnTheScreen();
  });

  it('captionSaysState overrides the default either way', async () => {
    await render(<BikePlate {...BASE} state={PLATE_STATE.DUE} captionSaysState />);
    expect(screen.getByText('to Oil change')).toBeOnTheScreen();

    await render(
      <BikePlate
        {...BASE}
        state={PLATE_STATE.OVERDUE}
        stateLabel="Not ready"
        caption="1 open recall"
        captionSaysState={false}
      />,
    );
    expect(screen.getByText('Not ready · 1 open recall')).toBeOnTheScreen();
  });

  it('is one button whose label always carries the state word', async () => {
    await render(<BikePlate {...BASE} onPress={jest.fn()} testID="plate" />);
    expect(screen.getByTestId('plate').props.accessibilityLabel).toBe(
      'Due soon. 1,240 km to Oil change',
    );
  });
});

describe('BikePlate — motion', () => {
  it('settles in over time by default', async () => {
    await render(<BikePlate {...BASE} />);
    const durations = mockWithTiming.mock.calls.map(([, config]) => config?.duration);
    expect(durations.some((duration) => (duration ?? 0) > 0)).toBe(true);
  });

  it('with Reduce Motion it does not animate: it starts settled and every timing is 0', async () => {
    mockReducedMotion.mockReturnValue(true);
    await render(<BikePlate {...BASE} />);
    expect(plateStyle().opacity).toBe(1);
    const durations = mockWithTiming.mock.calls.map(([, config]) => config?.duration);
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every((duration) => duration === 0)).toBe(true);
  });
});
