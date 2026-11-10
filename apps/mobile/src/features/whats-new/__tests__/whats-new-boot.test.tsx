// The instrument boot: the odometer shows the season distance, else the bike's
// odometer, else nothing; the closing line counts only current-release pages as
// new; a tap skips; reduced motion shows the final frame without animating; and
// every colour comes from the theme in both schemes.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
let mockColorScheme = 'dark';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));
const mockReducedMotion = jest.fn(() => false);
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion(),
}));
// Every svg element renders as a View carrying its props, so stroke and fill
// show up in the tree.
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const element = (props: { children?: ReactNode }) => <View {...props} />;
  const names = ['Svg', 'G', 'Path', 'Line', 'Circle', 'Rect', 'Polyline', 'Polygon', 'Ellipse'];
  return {
    __esModule: true,
    default: element,
    ...Object.fromEntries(names.map((name) => [name, element])),
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { WHATS_NEW_TIMING } from '@/config/whats-new';
import '@/i18n';
import { HUB_UNIT } from '@/lib/bike-hub/constants';
import { EDITORIAL_SCHEME, editorialThemes } from '@/theme/editorial';
import { BOOT_KIND, type BootData } from '../build-boot-snapshot';
import { WhatsNewBoot } from '../whats-new-boot';

const SEASON: BootData = {
  kind: BOOT_KIND.SEASON,
  value: 2507,
  figure: '2,507',
  unitLabel: 'km',
  rides: 36,
};
const ODO: BootData = {
  kind: BOOT_KIND.ODO,
  value: 18240,
  figure: '18,240',
  unitLabel: HUB_UNIT.KM,
  bikeName: 'Africa Twin',
};
const NONE: BootData = { kind: BOOT_KIND.NONE };

async function boot(data: BootData, counts: { newCount: number; catchUpCount: number }) {
  const onDone = jest.fn();
  await render(<WhatsNewBoot boot={data} {...counts} onDone={onDone} />);
  return onDone;
}

/** The instruments are hidden from screen readers; the visual queries look anyway. */
const HIDDEN = { includeHiddenElements: true } as const;

function summary(): string {
  return screen.getByTestId('whats-new-boot-summary').props.accessibilityLabel;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockColorScheme = EDITORIAL_SCHEME.DARK;
  mockReducedMotion.mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('WhatsNewBoot', () => {
  it('rolls to the season distance and counts new and catch-up pages apart', async () => {
    await boot(SEASON, { newCount: 1, catchUpCount: 2 });

    expect(screen.getByText('SEASON', HIDDEN)).toBeTruthy();
    expect(screen.getByText('36 rides this season', HIDDEN)).toBeTruthy();
    expect(screen.getByText('All systems OK', HIDDEN)).toBeTruthy();
    expect(screen.getByText('1 new for your bike + 2 you may have missed', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('whats-new-boot-odometer', HIDDEN)).toBeTruthy();
    expect(summary()).toContain('SEASON 2,507 km');
    expect(summary()).toContain('1 new for your bike + 2 you may have missed');
    // A screen reader hears the summary, not each instrument.
    expect(screen.queryByText('SEASON')).toBeNull();
  });

  it('says only the catch-up part, never "new", when no page is from this release', async () => {
    await boot(SEASON, { newCount: 0, catchUpCount: 2 });

    expect(screen.getByText('2 you may have missed', HIDDEN)).toBeTruthy();
    expect(screen.queryByText(/\bnew\b/i, HIDDEN)).toBeNull();
    expect(summary()).not.toMatch(/\bnew\b/i);
  });

  it("falls back to the bike's odometer with the bike's name", async () => {
    await boot(ODO, { newCount: 3, catchUpCount: 0 });

    expect(screen.getByText('ODO', HIDDEN)).toBeTruthy();
    expect(screen.getByText('Africa Twin · from your garage', HIDDEN)).toBeTruthy();
    expect(screen.getByText('3 new for your bike', HIDDEN)).toBeTruthy();
    expect(summary()).toContain('ODO 18,240 km');
  });

  it('leaves the odometer out when there is no figure', async () => {
    await boot(NONE, { newCount: 1, catchUpCount: 0 });

    expect(screen.queryByTestId('whats-new-boot-odometer', HIDDEN)).toBeNull();
    expect(screen.queryByText('SEASON', HIDDEN)).toBeNull();
    expect(screen.queryByText('ODO', HIDDEN)).toBeNull();
    expect(screen.getByText('1 new for your bike', HIDDEN)).toBeTruthy();
  });

  it('ends early with skipped: true when tapped anywhere', async () => {
    const onDone = await boot(SEASON, { newCount: 1, catchUpCount: 0 });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await fireEvent.press(screen.getByTestId('whats-new-boot'));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ skipped: true, elapsedMs: 500 });
    await act(async () => {
      jest.advanceTimersByTime(WHATS_NEW_TIMING.BOOT_DURATION_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('has a labelled Skip button for screen readers that also ends it', async () => {
    const onDone = await boot(SEASON, { newCount: 1, catchUpCount: 0 });

    const skip = screen.getByRole('button', { name: 'Skip' });
    await fireEvent.press(skip);

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ skipped: true }));
  });

  it('ends by itself after the boot duration', async () => {
    const onDone = await boot(SEASON, { newCount: 1, catchUpCount: 0 });
    await act(async () => {
      jest.advanceTimersByTime(WHATS_NEW_TIMING.BOOT_DURATION_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledWith({
      skipped: false,
      elapsedMs: WHATS_NEW_TIMING.BOOT_DURATION_MS,
    });
  });

  it('shows the final frame without animating under reduced motion', async () => {
    mockReducedMotion.mockReturnValue(true);
    const onDone = await boot(SEASON, { newCount: 1, catchUpCount: 2 });

    expect(screen.queryByTestId('whats-new-boot-needle-sweep', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('whats-new-boot-odometer-wheel', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('whats-new-boot-lamp', HIDDEN)).toBeNull();
    expect(screen.getByTestId('whats-new-boot-odometer', HIDDEN)).toBeTruthy();
    expect(screen.getByText('1 new for your bike + 2 you may have missed', HIDDEN)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(WHATS_NEW_TIMING.BOOT_DURATION_MS);
    });
    expect(onDone).toHaveBeenCalledWith({
      skipped: false,
      elapsedMs: WHATS_NEW_TIMING.BOOT_DURATION_MS,
    });
  });

  it('animates the needle, the lamps and the odometer wheels with motion on', async () => {
    await boot(SEASON, { newCount: 1, catchUpCount: 0 });

    expect(screen.getByTestId('whats-new-boot-needle-sweep', HIDDEN)).toBeTruthy();
    expect(screen.getAllByTestId('whats-new-boot-odometer-wheel', HIDDEN).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId('whats-new-boot-lamp', HIDDEN).length).toBeGreaterThanOrEqual(2);
  });
});

// ── colours ──────────────────────────────────────────────────────────────────

const COLOR_PROPS = ['color', 'backgroundColor', 'borderColor', 'stroke', 'fill'] as const;
const NOT_A_COLOR = new Set(['none', 'transparent', 'currentColor']);

function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(h.substring(i, i + 2), 16)).join(',');
}

type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };

function colorsIn(node: Node | string | null, out: string[] = []): string[] {
  if (!node || typeof node === 'string') return out;
  const style = StyleSheet.flatten(node.props.style as never) as Record<string, unknown> | null;
  for (const source of [node.props, style ?? {}]) {
    for (const prop of COLOR_PROPS) {
      const value = source[prop];
      if (typeof value === 'string' && !NOT_A_COLOR.has(value)) out.push(value);
    }
  }
  for (const child of node.children ?? []) colorsIn(child, out);
  return out;
}

describe.each([
  EDITORIAL_SCHEME.DARK,
  EDITORIAL_SCHEME.LIGHT,
])('WhatsNewBoot colours (%s)', (scheme) => {
  it('uses only theme tokens and tints of them', async () => {
    mockColorScheme = scheme;
    await boot(SEASON, { newCount: 1, catchUpCount: 2 });
    const tokens = Object.values(editorialThemes[scheme]);
    const tintable = new Set(tokens.map(rgbOf));

    const colors = colorsIn(screen.toJSON() as Node);

    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) {
      const rgba = /^rgba\((\d+,\d+,\d+),[\d.]+\)$/.exec(color);
      expect(tokens.includes(color) || (rgba !== null && tintable.has(rgba[1] ?? ''))).toBe(true);
    }
    expect(colors).toContain(editorialThemes[scheme].bg);
    expect(colors).toContain(editorialThemes[scheme].warm);
  });
});
