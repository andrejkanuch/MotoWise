// Home "Up next" after the onboarding service-plan import (issue 365 T07b):
// a fresh bike gets ~10 OEM tasks, some already past their date. Home shows the
// three most urgent and one "+N more" row; a past imported task reads "Due now",
// never "2,400 days late".
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/utils/haptics', () => ({ triggerImpact: jest.fn() }));

import {
  MaintenancePriority,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
} from '@motovault/graphql';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import i18n from '@/i18n';
import { HUB_UNIT } from '@/lib/bike-hub/constants';
import { describePlate, rankBikeTasks } from '../home-plate';
import type { TaskItem } from '../home-types';
import { UpNext } from '../up-next';

const TODAY = new Date(2026, 9, 2);
const BIKE = 'bike-1';
const ODOMETER = 12_000;

function imported(index: number, dueDate: string): TaskItem {
  return {
    id: `oem-${index}`,
    motorcycleId: BIKE,
    title: `Service item ${index}`,
    dueDate,
    targetMileage: null,
    priority: MaintenancePriority.Medium,
    status: MaintenanceTaskStatus.Pending,
    source: MaintenanceTaskSource.Oem,
    completedAt: null,
    remind30d: false,
    remind7d: false,
    remind1d: false,
  };
}

/** 10 imported tasks: 4 already past (one by years), 6 ahead. */
const IMPORTED: TaskItem[] = [
  imported(0, '2020-04-01'),
  imported(1, '2026-03-15'),
  imported(2, '2026-08-01'),
  imported(3, '2026-09-30'),
  imported(4, '2026-11-01'),
  imported(5, '2027-01-01'),
  imported(6, '2027-03-01'),
  imported(7, '2027-06-01'),
  imported(8, '2027-09-01'),
  imported(9, '2028-01-01'),
];

const context = { bikeId: BIKE, odometer: ODOMETER, unit: HUB_UNIT.KM, today: TODAY };

describe('Home up next — imported service plan', () => {
  it('shows the 3 most urgent rows and "+7 more", past ones read "Due now"', async () => {
    const onSeeAll = jest.fn();
    await render(
      <UpNext
        tasks={rankBikeTasks(IMPORTED, context)}
        unit={HUB_UNIT.KM}
        onOpenTask={jest.fn()}
        onSeeAll={onSeeAll}
      />,
    );
    const list = within(screen.getByTestId('home-up-next'));
    expect(list.getAllByText(/^Service item \d$/)).toHaveLength(3);
    expect(list.getAllByText(/^Due now/)).toHaveLength(3);
    expect(list.queryByText(/days? late/)).toBeNull();

    const more = screen.getByTestId('home-up-next-more');
    expect(within(more).getByText('+7 more')).toBeOnTheScreen();
    await fireEvent.press(more);
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('three tasks or fewer: no "+N more" row', async () => {
    await render(
      <UpNext
        tasks={rankBikeTasks(IMPORTED.slice(4, 7), context)}
        unit={HUB_UNIT.KM}
        onOpenTask={jest.fn()}
        onSeeAll={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('home-up-next-more')).toBeNull();
  });

  it('the plate says "due now" for a past imported task, not a count of days', () => {
    const [next] = rankBikeTasks(IMPORTED, context);
    const plate = describePlate(next, {
      t: i18n.t.bind(i18n),
      language: 'en-US',
      unit: HUB_UNIT.KM,
      odometer: ODOMETER,
    });
    expect(plate.caption).toBe('Service item 0, due now');
    expect(plate.figure).toBe('12,000');
    expect(plate.unit).toBe('km');
  });
});
