/**
 * The interim Costs and Bike segments on the hub's system: one add trigger per
 * segment (the pill), category colours that never borrow copper or a status
 * colour, and a Details disclosure whose state is announced.
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
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
jest.mock('../../../lib/notifications', () => ({ cancelDocumentNotifications: jest.fn() }));
jest.mock('../../../hooks/use-currency', () => ({
  useCurrency: () => ({ currency: 'EUR', format: (n: number) => `€${n}` }),
}));
jest.mock('../../../hooks/use-delete-expense', () => ({
  useDeleteExpense: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../shared/swipeable-expense', () => ({ SwipeableExpense: () => null }));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { palette } from '@motovault/design-system';
import {
  DocumentCategoriesDocument,
  DocumentsByMotorcycleDocument,
  ExpensesByMotorcycleDocument,
} from '@motovault/graphql';
import { EXPENSE_CATEGORY_META } from '@motovault/types';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import '../../../i18n';
import { queryClient } from '../../../lib/query-client';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { BikeDetailsCard } from '../bike-details-card';
import { DocumentsSection } from '../documents-section';
import { ExpensesSection } from '../expenses-section';
import { HUB_CATEGORY_COLOR, hub, hubCategoryColor } from '../ui/tokens';

const settle = () => act(async () => jest.advanceTimersByTimeAsync(1000));
const withClient = (children: ReactNode) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const YEAR = new Date().getFullYear();
const expense = (id: string, category: string, amount: number) => ({
  id,
  amount,
  category,
  currency: 'EUR',
  description: null,
  itemName: null,
  maintenanceTaskId: null,
  date: `${YEAR}-03-0${id.length}`,
});
const EXPENSES = {
  expenses: {
    categories: [
      { category: 'fuel', expenses: [expense('e1', 'fuel', 30)] },
      { category: 'tires', expenses: [expense('e22', 'tires', 165.9)] },
    ],
  },
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe('hub category colours', () => {
  const colours = Object.values(HUB_CATEGORY_COLOR);

  it('covers every expense category, one colour each', () => {
    expect(Object.keys(HUB_CATEGORY_COLOR).sort()).toEqual(
      EXPENSE_CATEGORY_META.map((m) => m.key).sort(),
    );
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('never uses copper or a status colour', () => {
    const reserved = [
      hub.copper,
      hub.copperText,
      hub.late,
      hub.soon,
      hub.ok,
      hub.medium,
      palette.hubNotReadyDot,
    ];
    for (const colour of colours) expect(reserved).not.toContain(colour);
  });

  it('reads a retired category as Other', () => {
    expect(hubCategoryColor('jetski')).toBe(HUB_CATEGORY_COLOR.other);
  });
});

describe('ExpensesSection', () => {
  beforeEach(() => {
    mockFetcher.mockImplementation((document: unknown) =>
      document === ExpensesByMotorcycleDocument
        ? Promise.resolve(EXPENSES)
        : Promise.resolve({ maintenanceTasks: [] }),
    );
  });

  it('has no add button of its own — the pill adds — and opens analytics from its header', async () => {
    await render(withClient(<ExpensesSection motorcycleId={BIKE_A.id} isDark />));
    await settle();
    expect(screen.getByText(`Spent in ${YEAR}`)).toBeOnTheScreen();
    expect(screen.getByText('Recent · 2')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Full analytics' }));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(tabs)/(garage)/expense-dashboard' }),
    );
  });

  it('switches between this year and all time', async () => {
    await render(withClient(<ExpensesSection motorcycleId={BIKE_A.id} isDark />));
    await settle();
    expect(screen.getByRole('tab', { name: String(YEAR) })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: 'All' }));
    await settle();
    expect(screen.getByRole('tab', { name: 'All' })).toBeSelected();
    expect(mockFetcher).toHaveBeenCalledWith(ExpensesByMotorcycleDocument, {
      motorcycleId: BIKE_A.id,
      year: 0,
    });
    expect(screen.getByText('Spent, all time')).toBeOnTheScreen();
  });
});

describe('DocumentsSection', () => {
  it('manages categories from its header and has no add button of its own', async () => {
    mockFetcher.mockImplementation((document: unknown) =>
      document === DocumentsByMotorcycleDocument
        ? Promise.resolve({ documents: [] })
        : document === DocumentCategoriesDocument
          ? Promise.resolve({ documentCategories: [] })
          : Promise.reject(new Error('unexpected')),
    );
    await render(withClient(<DocumentsSection motorcycleId={BIKE_A.id} bikeName="Africa Twin" />));
    await settle();
    expect(screen.getByText('No documents yet')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^add/i })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Manage Categories' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/(garage)/manage-document-categories');
  });
});

describe('BikeDetailsCard', () => {
  it('is a disclosure: collapsed, then expanded in place with the facts', async () => {
    await render(
      withClient(
        <BikeDetailsCard
          bike={{ make: 'Honda', model: 'Africa Twin', year: 2022, isPrimary: true }}
        />,
      ),
    );
    const toggle = screen.getByTestId('bike-details-toggle');
    expect(toggle).not.toBeExpanded();
    expect(screen.queryByText('Africa Twin')).toBeNull();

    await fireEvent.press(toggle);
    expect(toggle).toBeExpanded();
    expect(screen.getByText('Africa Twin')).toBeOnTheScreen();
    expect(screen.getByText('2022')).toBeOnTheScreen();
  });
});
