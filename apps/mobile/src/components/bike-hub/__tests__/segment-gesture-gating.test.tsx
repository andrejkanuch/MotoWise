/**
 * Touch passthrough from a hidden Costs segment (iOS Fabric): a `display: 'none'`
 * panel is unmounted natively and its UIViews recycled while the React tree —
 * and each expense row's gesture-handler recogniser — stays alive. The recogniser
 * then rides on a recycled UIView inside the Odometer / Log sheet, so a keypad
 * tap also pushed an Expense detail behind the sheet. The rows' gestures must be
 * off whenever their segment is hidden or the hub is covered.
 */
import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => ({
  ...require('../../../test/mocks').mockAnalytics(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../hooks/use-currency', () => ({
  useCurrency: () => ({
    currency: 'EUR',
    format: (n: number) => `€${n}`,
    formatFor: (n: number) => `€${n}`,
  }),
}));
jest.mock('../../../hooks/use-delete-expense', () => ({
  useDeleteExpense: () => ({ mutate: jest.fn() }),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { ExpensesByMotorcycleDocument } from '@motovault/graphql';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { useSharedValue } from 'react-native-reanimated';
import '../../../i18n';
import { BIKE_SEGMENT, type BikeSegment } from '../../../lib/bike-hub/constants';
import { queryClient } from '../../../lib/query-client';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { SwipeableExpense } from '../../shared/swipeable-expense';
import { ExpensesSection } from '../expenses-section';
import { SegmentContainer, type SegmentDefinition } from '../shell/segment-container';

const settle = () => act(async () => jest.advanceTimersByTimeAsync(1000));
const YEAR = new Date().getFullYear();
const EXPENSE = {
  id: 'exp-1',
  amount: 26.15,
  category: 'fuel',
  currency: 'EUR',
  description: null,
  itemName: 'Efitec 98',
  maintenanceTaskId: null,
  date: `${YEAR}-03-01`,
};
const TAP_ID = `expense-row-tap-${EXPENSE.id}`;

const tapRow = () => fireGestureHandler(getByGestureTestId(TAP_ID), []);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFetcher.mockImplementation((document: unknown) =>
    document === ExpensesByMotorcycleDocument
      ? Promise.resolve({ expenses: { categories: [{ category: 'fuel', expenses: [EXPENSE] }] } })
      : Promise.resolve({ maintenanceTasks: [] }),
  );
});
afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe('SwipeableExpense', () => {
  const row = (enabled?: boolean) => (
    <SwipeableExpense
      expense={EXPENSE}
      motorcycleId={BIKE_A.id}
      isDark
      onDelete={jest.fn()}
      index={0}
      enabled={enabled}
    />
  );

  it('opens the expense on tap when enabled (default)', async () => {
    await render(row());
    tapRow();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(tabs)/(garage)/expense-detail',
        params: { expenseId: EXPENSE.id, motorcycleId: BIKE_A.id },
      }),
    );
  });

  it('neither recognises the tap nor navigates when disabled', async () => {
    await render(row(false));
    expect(getByGestureTestId(TAP_ID).config.enabled).toBe(false);
    tapRow();
    expect(router.push).not.toHaveBeenCalled();
  });
});

function Hub({ active, focused }: { active: BikeSegment; focused: boolean }) {
  const collapse = useSharedValue(0);
  const empty: SegmentDefinition = { render: () => null };
  const segments: Record<BikeSegment, SegmentDefinition> = {
    [BIKE_SEGMENT.OVERVIEW]: empty,
    [BIKE_SEGMENT.SERVICE]: empty,
    [BIKE_SEGMENT.COSTS]: { render: () => <ExpensesSection motorcycleId={BIKE_A.id} isDark /> },
    [BIKE_SEGMENT.BIKE]: empty,
  };
  return (
    <QueryClientProvider client={queryClient}>
      <SegmentContainer
        active={active}
        segments={segments}
        collapse={collapse}
        refreshing={false}
        onRefresh={jest.fn()}
        bottomInset={0}
        focused={focused}
      />
    </QueryClientProvider>
  );
}

describe('expense rows in the hub segments', () => {
  it('open the expense while Costs is active and the hub focused', async () => {
    await render(<Hub active={BIKE_SEGMENT.COSTS} focused />);
    await settle();
    tapRow();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('do nothing once Costs is hidden (visited, then back to Overview)', async () => {
    const view = await render(<Hub active={BIKE_SEGMENT.COSTS} focused />);
    await settle();
    await view.rerender(<Hub active={BIKE_SEGMENT.OVERVIEW} focused />);
    await settle();
    expect(getByGestureTestId(TAP_ID).config.enabled).toBe(false);
    tapRow();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('do nothing while a sheet or screen covers the hub, and recover after', async () => {
    const view = await render(<Hub active={BIKE_SEGMENT.COSTS} focused={false} />);
    await settle();
    tapRow();
    expect(router.push).not.toHaveBeenCalled();

    await view.rerender(<Hub active={BIKE_SEGMENT.COSTS} focused />);
    await settle();
    tapRow();
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
