let mockColorScheme = 'dark';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import { palette, withAlpha } from '@motovault/design-system';
import { MaintenancePriority, MaintenanceTaskSource } from '@motovault/graphql';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import '../../../i18n';
import { HUB_UNIT } from '../../../lib/bike-hub/constants';
import { getTaskDue } from '../../../lib/bike-hub/task-due';
import { AIR_FILTER, BRAKE_PADS, KM, TODAY, task } from '../../../test/bike-hub-fixtures';
import { ActionPill } from '../ui/action-pill';
import { DueLine } from '../ui/due-line';
import { PriorityTag } from '../ui/priority-tag';
import { REFRESH_ANNOUNCE_WINDOW_MS, REFRESH_BLOCK, RefreshFailed } from '../ui/refresh-failed';
import { SectionHeader } from '../ui/section-header';
import { Stat } from '../ui/stat';
import { hubDark, hubLight, TAG_VARIANT } from '../ui/tokens';

describe('PriorityTag', () => {
  afterEach(() => {
    mockColorScheme = 'dark';
  });

  it('uses the light, text-safe tag colours in light mode', async () => {
    mockColorScheme = 'light';
    await render(<PriorityTag priority={MaintenancePriority.Critical} />);
    const text = screen.getByText('CRIT');
    expect(StyleSheet.flatten(text.props.style).color).toBe(hubLight.late);
    expect(StyleSheet.flatten(text.parent?.props.style).backgroundColor).toBe(hubLight.tagCritBg);
  });

  it.each([
    [MaintenancePriority.Critical, 'CRIT', palette.hubTagCritBg, palette.hubLate],
    [MaintenancePriority.High, 'HIGH', palette.hubTagHighBg, palette.hubSoon],
    [MaintenancePriority.Medium, 'MED', palette.hubTagMedBg, palette.hubMedium],
    [MaintenancePriority.Low, 'LOW', palette.hubTagLowBg, palette.hubLow],
  ])('%s renders %s in its colours', async (priority, label, bg, fg) => {
    await render(<PriorityTag priority={priority} />);
    const text = screen.getByText(label);
    expect(StyleSheet.flatten(text.props.style).color).toBe(fg);
    expect(StyleSheet.flatten(text.parent?.props.style).backgroundColor).toBe(bg);
  });

  it('renders the SAFETY and DOC variants, critical in the CRIT fill', async () => {
    await render(
      <>
        <PriorityTag variant={TAG_VARIANT.SAFETY} critical />
        <PriorityTag variant={TAG_VARIANT.DOC} />
      </>,
    );
    expect(StyleSheet.flatten(screen.getByText('SAFETY').props.style).color).toBe(palette.hubLate);
    expect(StyleSheet.flatten(screen.getByText('DOC').props.style).color).toBe(palette.hubSoon);
  });
});

describe('DueLine', () => {
  it('"201 days late · 3,933 km to target" with the late colour leading', async () => {
    await render(<DueLine due={getTaskDue(BRAKE_PADS, KM)} unit={HUB_UNIT.KM} />);
    expect(screen.getByText('201 days late · 3,933 km to target')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('201 days late').props.style).color).toBe(
      palette.hubLate,
    );
  });

  it('"In 2 days · or in 8,733 km" with the soon colour leading', async () => {
    await render(<DueLine due={getTaskDue(AIR_FILTER, KM)} unit={HUB_UNIT.KM} />);
    expect(screen.getByText('In 2 days · or in 8,733 km')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('In 2 days').props.style).color).toBe(
      palette.hubSoon,
    );
  });

  it('"In 9,833 km · Honda schedule" in the plain colour', async () => {
    const oem = task({
      id: 'oem',
      title: 'Valves',
      targetMileage: 48_000,
      source: MaintenanceTaskSource.Oem,
    });
    await render(<DueLine due={getTaskDue(oem, KM)} unit={HUB_UNIT.KM} scheduleName="Honda" />);
    expect(screen.getByText('In 9,833 km · Honda schedule')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('In 9,833 km').props.style).color).toBe(hubDark.dim);
  });

  it('"In 1,833 km · or by Jan 10" and "Mar 2027 · Honda schedule"', async () => {
    const oil = task({ id: 'oil', title: 'Oil', dueDate: '2027-01-10', targetMileage: 40_000 });
    const fluid = task({
      id: 'fluid',
      title: 'Brake fluid',
      dueDate: '2027-03-15',
      source: MaintenanceTaskSource.Oem,
    });
    await render(
      <>
        <DueLine due={getTaskDue(oil, KM)} unit={HUB_UNIT.KM} />
        <DueLine due={getTaskDue(fluid, KM)} unit={HUB_UNIT.KM} scheduleName="Honda" />
      </>,
    );
    expect(screen.getByText('In 1,833 km · or by Jan 10')).toBeOnTheScreen();
    expect(screen.getByText('Mar 2027 · Honda schedule')).toBeOnTheScreen();
  });

  it('miles: "38 days late · 420 mi past target", both parts late', async () => {
    const shoes = task({ id: 's', title: 'Shoes', dueDate: '2026-08-25', targetMileage: 10_000 });
    const due = getTaskDue(shoes, { odometer: 10_420, today: TODAY, unit: HUB_UNIT.MI });
    await render(<DueLine due={due} unit={HUB_UNIT.MI} />);
    expect(screen.getByText('38 days late · 420 mi past target')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText(/420 mi past target/).props.style).color).toBe(
      palette.hubLate,
    );
  });

  // Odometer exactly at the target: the task is due, but nothing is "past" yet.
  it.each([
    [HUB_UNIT.KM, 'km'],
    [HUB_UNIT.MI, 'mi'],
  ])('at the target [%s] it reads "Due now", never "0 %s past target"', async (unit, label) => {
    const atTarget = task({ id: 'at', title: 'Chain', targetMileage: 12_000 });
    const due = getTaskDue(atTarget, { odometer: 12_000, today: TODAY, unit });
    await render(<DueLine due={due} unit={unit} />);
    expect(screen.getByText('Due now')).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(`0 ${label} past target`))).toBeNull();
    expect(StyleSheet.flatten(screen.getByText('Due now').props.style).color).toBe(palette.hubLate);
  });

  it.each([
    [HUB_UNIT.KM, '1 km past target'],
    [HUB_UNIT.MI, '1 mi past target'],
  ])('one past the target [%s] reads "%s"', async (unit, expected) => {
    const past = task({ id: 'past', title: 'Chain', targetMileage: 12_000 });
    await render(
      <DueLine due={getTaskDue(past, { odometer: 12_001, today: TODAY, unit })} unit={unit} />,
    );
    expect(screen.getByText(expected)).toBeOnTheScreen();
  });

  it.each([
    [HUB_UNIT.KM],
    [HUB_UNIT.MI],
  ])('late by date and exactly at the target [%s]: "12 days late · target reached"', async (unit) => {
    const both = task({ id: 'both', title: 'Chain', dueDate: '2026-09-20', targetMileage: 12_000 });
    await render(
      <DueLine due={getTaskDue(both, { odometer: 12_000, today: TODAY, unit })} unit={unit} />,
    );
    expect(screen.getByText('12 days late · target reached')).toBeOnTheScreen();
  });

  it('due today is "Due today" — a date is never "0 days late"', async () => {
    const today = task({ id: 'today', title: 'Chain', dueDate: '2026-10-02' });
    await render(<DueLine due={getTaskDue(today, KM)} unit={HUB_UNIT.KM} />);
    expect(screen.getByText('Due today')).toBeOnTheScreen();
    expect(screen.queryByText(/0 days late/)).toBeNull();
  });

  it('one day late is the first late wording: "1 day late"', async () => {
    const yesterday = task({ id: 'y', title: 'Chain', dueDate: '2026-10-01' });
    await render(<DueLine due={getTaskDue(yesterday, KM)} unit={HUB_UNIT.KM} />);
    expect(screen.getByText('1 day late')).toBeOnTheScreen();
  });

  it('an undated task reads "No due date"', async () => {
    await render(
      <DueLine due={getTaskDue(task({ id: 'x', title: 'x' }), KM)} unit={HUB_UNIT.KM} />,
    );
    expect(screen.getByText('No due date')).toBeOnTheScreen();
  });
});

describe('ActionPill', () => {
  it('icon-only: exposes the button role and its label', async () => {
    const onPress = jest.fn();
    await render(<ActionPill icon={Plus} onPress={onPress} accessibilityLabel="Add an expense" />);
    const pill = screen.getByRole('button', { name: 'Add an expense' });
    await fireEvent.press(pill);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('caps its label at 1.3× and grows in height rather than clipping', async () => {
    await render(
      <ActionPill icon={Plus} label="Log" onPress={jest.fn()} accessibilityLabel="Log something" />,
    );
    expect(screen.getByText('Log').props.maxFontSizeMultiplier).toBe(1.3);
    const style = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Log something' }).props.style,
    );
    expect(style.minHeight).toBe(52);
    expect(style.height).toBeUndefined();
  });

  it('labelled: shows the label', async () => {
    await render(
      <ActionPill icon={Plus} label="Log" onPress={jest.fn()} accessibilityLabel="Log something" />,
    );
    expect(screen.getByText('Log')).toBeOnTheScreen();
  });
});

describe('SectionHeader / Stat', () => {
  it('appends the count and fires the action', async () => {
    const onPress = jest.fn();
    await render(
      <SectionHeader label="Needs attention" count={6} action={{ label: 'All', onPress }} />,
    );
    expect(screen.getByText('Needs attention · 6')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('takes an eyebrow colour for a header on a non-hub ground (interim Bike tab)', async () => {
    await render(<SectionHeader label="Manage" color={palette.editorialLightInk3} />);
    expect(StyleSheet.flatten(screen.getByText('Manage').props.style).color).toBe(
      palette.editorialLightInk3,
    );
  });

  it('shows a hint when there is no action', async () => {
    await render(<SectionHeader label="Overdue" count={4} hint="priority, then lateness" />);
    expect(screen.getByText('priority, then lateness')).toBeOnTheScreen();
  });

  it('a stat eyebrow is never truncated: it shrinks a little, then wraps to a second line', async () => {
    await render(<Stat compact eyebrow="Per month · 2026" value="€218" />);
    const eyebrow = screen.getByText('Per month · 2026');
    expect(eyebrow.props.numberOfLines).toBe(2);
    expect(eyebrow.props.adjustsFontSizeToFit).toBe(true);
    expect(eyebrow.props.minimumFontScale).toBe(0.85);
  });

  it('body text is not capped: a section header scales freely', async () => {
    await render(<SectionHeader label="Needs attention" count={6} />);
    expect(screen.getByText('Needs attention · 6').props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('a stat renders eyebrow, value and basis and is not pressable', async () => {
    await render(<Stat eyebrow="Per month" value="€218" basis="9 months" />);
    expect(screen.getByText('€218')).toBeOnTheScreen();
    expect(screen.getByText('9 months')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('RefreshFailed', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives each block’s Retry its own accessibility label', async () => {
    const onRetry = jest.fn();
    await render(
      <>
        <RefreshFailed block={REFRESH_BLOCK.ATTENTION} onRetry={onRetry} />
        <RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={onRetry} />
        <RefreshFailed block={REFRESH_BLOCK.NOTES} onRetry={onRetry} />
      </>,
    );
    for (const name of ['Retry needs attention', 'Retry costs', 'Retry notes']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Retry costs' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('wraps, so Retry moves to the next line instead of off-screen', async () => {
    await render(<RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={jest.fn()} testID="line" />);
    expect(StyleSheet.flatten(screen.getByTestId('line').props.style).flexWrap).toBe('wrap');
    const label = screen.getByText(/^Couldn't refresh/);
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
  });

  describe('announcement', () => {
    // The once-per-failure window is module state keyed on Date.now: start well
    // past any real-clock announcement from earlier tests, then each test opens
    // a window past the previous one.
    let now = Date.now() + 1_000_000_000;
    let announce: jest.SpyInstance;
    beforeEach(() => {
      now += 10 * REFRESH_ANNOUNCE_WINDOW_MS;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => {});
      // RN's jest setup already makes it a jest.fn: spyOn returns that same mock,
      // with the calls earlier tests made.
      announce.mockClear();
    });

    it('is announced when it appears', async () => {
      await render(<RefreshFailed block={REFRESH_BLOCK.NOTES} onRetry={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Couldn't refresh");
    });

    it('three blocks failing on one refresh are announced once, not three times', async () => {
      await render(
        <>
          <RefreshFailed block={REFRESH_BLOCK.ATTENTION} onRetry={jest.fn()} />
          <RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={jest.fn()} />
          <RefreshFailed block={REFRESH_BLOCK.NOTES} onRetry={jest.fn()} />
        </>,
      );
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it('a later, separate failure is announced again', async () => {
      const { unmount } = await render(
        <RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={jest.fn()} />,
      );
      await unmount();
      now += REFRESH_ANNOUNCE_WINDOW_MS;
      await render(<RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(2);
    });

    it('carries no live region per block (that announced once per block on Android)', async () => {
      await render(<RefreshFailed block={REFRESH_BLOCK.NOTES} onRetry={jest.fn()} testID="line" />);
      expect(screen.getByTestId('line').props.accessibilityLiveRegion).toBeUndefined();
    });
  });

  it('the " · " is not drawn at the end of a line once Retry wraps below, but keeps its space', async () => {
    await render(<RefreshFailed block={REFRESH_BLOCK.COSTS} onRetry={jest.fn()} />);
    const separator = screen.getByText(' · ');
    const layout = (target: Parameters<typeof fireEvent>[0], y: number, height: number) =>
      fireEvent(target, 'layout', { nativeEvent: { layout: { x: 0, y, width: 100, height } } });
    const message = screen.getByText(/^Couldn't refresh/);
    const retry = screen.getByRole('button', { name: 'Retry costs' });

    // One row: Retry beside the (one- or two-line) message.
    await layout(message, 0, 36);
    await layout(retry, 9, 18);
    expect(StyleSheet.flatten(separator.props.style).color).toBe(palette.hubSoon);

    // Wrapped: Retry on the row below.
    await layout(retry, 36, 18);
    const hidden = StyleSheet.flatten(separator.props.style).color;
    expect(hidden).not.toBe(palette.hubSoon);
    expect(hidden).toBe(withAlpha(palette.hubSoon, 0));
    expect(separator).toBeOnTheScreen();
  });
});
