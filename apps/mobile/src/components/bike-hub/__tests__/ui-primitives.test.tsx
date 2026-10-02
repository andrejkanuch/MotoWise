jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import { palette } from '@motovault/design-system';
import { MaintenancePriority, MaintenanceTaskSource } from '@motovault/graphql';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import '../../../i18n';
import { HUB_UNIT } from '../../../lib/bike-hub/constants';
import { getTaskDue } from '../../../lib/bike-hub/task-due';
import { AIR_FILTER, BRAKE_PADS, KM, TODAY, task } from '../../../test/bike-hub-fixtures';
import { ActionPill } from '../ui/action-pill';
import { DueLine } from '../ui/due-line';
import { PriorityTag } from '../ui/priority-tag';
import { SectionHeader } from '../ui/section-header';
import { Stat } from '../ui/stat';
import { TAG_VARIANT } from '../ui/tokens';

describe('PriorityTag', () => {
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
    expect(StyleSheet.flatten(screen.getByText('In 9,833 km').props.style).color).toBe(
      palette.hubDim,
    );
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

  it('shows a hint when there is no action', async () => {
    await render(<SectionHeader label="Overdue" count={4} hint="priority, then lateness" />);
    expect(screen.getByText('priority, then lateness')).toBeOnTheScreen();
  });

  it('a stat renders eyebrow, value and basis and is not pressable', async () => {
    await render(<Stat eyebrow="Per month" value="€218" basis="9 months" />);
    expect(screen.getByText('€218')).toBeOnTheScreen();
    expect(screen.getByText('9 months')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
