/**
 * The legacy Expenses and Documents sections (interim Costs and Bike segments)
 * share one load-error look: the hub's copper Retry, announced on both
 * platforms. A categories failure no longer hides the documents themselves.
 */
const mockColorScheme = 'dark';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The reanimated mock lacks the hooks the bike plate uses.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
  interpolateColor: () => 'transparent',
}));
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
jest.mock('../../../hooks/use-currency', () => ({ useCurrency: () => ({ currency: 'EUR' }) }));
jest.mock('../../../hooks/use-delete-expense', () => ({
  useDeleteExpense: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../shared/swipeable-expense', () => ({ SwipeableExpense: () => null }));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { DocumentCategoriesDocument, DocumentsByMotorcycleDocument } from '@motovault/graphql';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Alert, StyleSheet } from 'react-native';
import '../../../i18n';
import { queryClient } from '../../../lib/query-client';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { DocumentsSection } from '../documents-section';
import { ExpensesSection } from '../expenses-section';
import { hubDark as hub } from '../ui/tokens';

/** Every retry of the app client: 2 + 4 + 8 s. */
const ALL_RETRIES_MS = 30_000;
const settle = () => act(async () => jest.advanceTimersByTimeAsync(ALL_RETRIES_MS));
const API_DOWN = new Error('API is down');

const docRow = (id: string, title: string, categoryId: string, isPinned = false) => ({
  id,
  title,
  categoryId,
  isPinned,
  expiryDate: null,
  files: [],
});
const DOCUMENTS = [
  docRow('doc-insurance', 'Mapfre', 'cat-insurance', true),
  docRow('doc-manual', 'Owner manual', 'cat-manual'),
];
const CATEGORIES = [
  { id: 'cat-insurance', name: 'Insurance', isHidden: false, promptsExpiry: true },
  { id: 'cat-manual', name: 'Manual', isHidden: false, promptsExpiry: false },
];

let alert: jest.SpyInstance;
let announce: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear();
});
afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const withClient = (children: ReactNode) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('DocumentsSection — only the categories fail', () => {
  beforeEach(() => {
    mockFetcher.mockImplementation((document: unknown) =>
      document === DocumentsByMotorcycleDocument
        ? Promise.resolve({ documents: DOCUMENTS })
        : Promise.reject(API_DOWN),
    );
  });

  it('still shows every document, the pinned one included, ungrouped, with a small categories error', async () => {
    await render(withClient(<DocumentsSection motorcycleId={BIKE_A.id} bikeName="Africa Twin" />));
    await settle();
    expect(screen.queryByTestId('documents-load-error')).toBeNull();
    expect(screen.getByTestId('documents-categories-error')).toHaveTextContent(
      /Couldn't load categories/,
    );
    expect(screen.getByText('Pinned · 1')).toBeOnTheScreen();
    expect(screen.getByText('All documents · 2')).toBeOnTheScreen();
    expect(screen.getAllByText('Mapfre')).toHaveLength(2); // pinned + the list
    expect(screen.getByText('Owner manual')).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
  });

  it('Retry reloads the categories and the documents regroup', async () => {
    await render(withClient(<DocumentsSection motorcycleId={BIKE_A.id} bikeName="Africa Twin" />));
    await settle();
    mockFetcher.mockImplementation((document: unknown) =>
      document === DocumentCategoriesDocument
        ? Promise.resolve({ documentCategories: CATEGORIES })
        : Promise.resolve({ documents: DOCUMENTS }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Retry categories' }));
    await settle();
    expect(screen.queryByTestId('documents-categories-error')).toBeNull();
    expect(screen.queryByText(/^All documents/)).toBeNull();
    expect(screen.getByText('Insurance · 1')).toBeOnTheScreen();
    expect(screen.getByText('Manual · 1')).toBeOnTheScreen();
  });
});

describe('Expenses and Documents load errors look and sound the same', () => {
  beforeEach(() => mockFetcher.mockImplementation(() => Promise.reject(API_DOWN)));

  it.each([
    [
      'expenses',
      'expenses-load-error',
      () => <ExpensesSection motorcycleId={BIKE_A.id} />,
      'Failed to load expense data',
    ],
    [
      'documents',
      'documents-load-error',
      () => <DocumentsSection motorcycleId={BIKE_A.id} bikeName="Africa Twin" />,
      "Couldn't load documents",
    ],
  ] as const)('%s: copper Retry, live region, announced on iOS', async (_name, testID, Section, message) => {
    await render(withClient(<Section />));
    await settle();
    const error = screen.getByTestId(testID);
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(announce).toHaveBeenCalledWith(message);
    const retry = within(error).getByText('Retry');
    expect(StyleSheet.flatten(retry.props.style).color).toBe(hub.copperText);
    expect(alert).not.toHaveBeenCalled();
  });
});
