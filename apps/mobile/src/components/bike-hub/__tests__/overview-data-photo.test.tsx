jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currency: 'EUR', session: { user: { id: 'user-1' } } }),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  DocumentCategoriesDocument,
  ExpensesByMotorcycleDocument,
  MotorcycleRecallsDocument,
  NotesByMotorcycleDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '../../../i18n';
import { HUB_UNIT, RIDE_STATUS, RIDE_STATUS_REASON } from '../../../lib/bike-hub/constants';
import {
  AIR_FILTER,
  BIKE_A,
  BIKE_A_DOCUMENTS,
  BIKE_A_TASKS,
  CATEGORIES,
  ECU_RECALL,
  EXPENSES_2025,
  EXPENSES_2026,
  NOTES,
  TODAY,
} from '../../../test/bike-hub-fixtures';
import { PhotoBand } from '../overview/photo-band';
import { useOverviewData } from '../overview/use-overview-data';
import type { BikeHubData, HubBike, HubTask } from '../shell/use-bike-hub-data';

const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

function respond(
  recalls: 'ok' | 'error',
  failing: { categories?: boolean; years?: readonly number[] } = {},
) {
  const years: Record<number, unknown> = { 2026: EXPENSES_2026, 2025: EXPENSES_2025 };
  mockFetcher.mockImplementation((document: unknown, variables: { year?: number }) => {
    if (document === DocumentCategoriesDocument && failing.categories) {
      return Promise.reject(new Error('API is down'));
    }
    if (document === ExpensesByMotorcycleDocument && failing.years?.includes(variables.year ?? 0)) {
      return Promise.reject(new Error('API is down'));
    }
    if (document === MotorcycleRecallsDocument) {
      return recalls === 'error'
        ? Promise.reject(new Error('NHTSA down'))
        : Promise.resolve({ motorcycleRecalls: { count: 1, recalls: [ECU_RECALL] } });
    }
    if (document === DocumentCategoriesDocument) {
      return Promise.resolve({ documentCategories: CATEGORIES });
    }
    if (document === ExpensesByMotorcycleDocument) {
      return Promise.resolve({ expenses: years[variables.year ?? 0] });
    }
    if (document === NotesByMotorcycleDocument) return Promise.resolve({ notes: NOTES });
    return Promise.resolve(undefined);
  });
}

async function renderData() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  clients.push(client);
  const shell = {
    tasks: BIKE_A_TASKS as HubTask[],
    tasksLoading: false,
    tasksError: false,
    refetchTasks: jest.fn(),
    documents: BIKE_A_DOCUMENTS as BikeHubData['documents'],
    documentsLoading: false,
    documentsError: false,
    refetchDocuments: jest.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => useOverviewData(BIKE_A as unknown as HubBike, shell, HUB_UNIT.KM, TODAY),
    { wrapper },
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return hook.result;
}

describe('useOverviewData', () => {
  it('composes the fixture into status, attention, next up, costs and notes', async () => {
    respond('ok');
    const result = await renderData();
    expect(result.current.status.status).toBe(RIDE_STATUS.CHECK);
    expect(result.current.attention.total).toBe(6);
    expect(result.current.attention.visible).toHaveLength(3);
    expect(result.current.attention.overflow?.count).toBe(3);
    expect(result.current.nextUp?.task.id).toBe(AIR_FILTER.id);
    expect(result.current.costs.summary.total).toBeCloseTo(1960.62, 2);
    expect(result.current.costs.summary.yoy?.percent).toBe(12);
    expect(result.current.costs.year).toBe(2026);
    expect(result.current.notes.items).toHaveLength(5);
    expect(result.current.documentCount).toBe(4);
  });

  it('a recalls error still yields a status, from recallCount, with no recall detail', async () => {
    respond('error');
    const result = await renderData();
    expect(result.current.status.status).toBe(RIDE_STATUS.CHECK);
    expect(result.current.status.reasons[0]).toEqual({
      kind: RIDE_STATUS_REASON.OPEN_RECALLS,
      count: 1,
    });
    expect(result.current.attention.items[0]).toMatchObject({ count: 1, components: [] });
  });

  it.each([
    ['last year only (the year-over-year line is missing)', [2025]],
    ['this year only (the YTD is stale)', [2026]],
    ['both years', [2025, 2026]],
  ] as const)('costs: once this year is shown, a failed fetch of %s says "Couldn\u2019t refresh"', async (_name, failingYears) => {
    respond('ok');
    const result = await renderData();
    expect(result.current.costs.refreshFailed).toBe(false);
    respond('ok', { years: failingYears });
    await act(async () => result.current.costs.refetch());
    await waitFor(() => expect(result.current.costs.refreshFailed).toBe(true));
    expect(result.current.costs.isError).toBe(false);
  });

  it('costs: last year failing on the first load is flagged too, beside this year’s data', async () => {
    respond('ok', { years: [2025] });
    const result = await renderData();
    expect(result.current.costs).toMatchObject({ isError: false, refreshFailed: true });
    expect(result.current.costs.summary.yoy).toBeNull();
  });

  it('failed document categories withhold the verdict: which documents block riding is unknown', async () => {
    respond('ok', { categories: true });
    const result = await renderData();
    expect(result.current.statusSource).toMatchObject({ isLoading: false, isError: true });
    respond('ok');
    await act(async () => result.current.statusSource.refetch());
    await waitFor(() => expect(result.current.statusSource.isError).toBe(false));
    expect(mockFetcher).toHaveBeenCalledWith(DocumentCategoriesDocument, { includeHidden: true });
  });
});

describe('PhotoBand', () => {
  const base = {
    photoUrl: 'https://example.test/hero.webp',
    uploading: false,
    onPress: jest.fn(),
    onAddPhoto: jest.fn(),
  };

  it('primary with 9 rides shows both chips', async () => {
    await render(<PhotoBand {...base} isPrimary ridesCount={9} />);
    expect(screen.getByText('PRIMARY')).toBeOnTheScreen();
    expect(screen.getByText('9 rides')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bike photo, open bike details' })).toBeOnTheScreen();
  });

  it('at accessibility sizes the chips stop growing and wrap instead of touching', async () => {
    await render(<PhotoBand {...base} isPrimary ridesCount={11} />);
    for (const text of ['PRIMARY', '11 rides']) {
      expect(screen.getByText(text).props.maxFontSizeMultiplier).toBe(1.3);
      expect(screen.getByText(text).props.numberOfLines).toBe(1);
    }
    const row = screen.getByTestId('photo-band-chips').props.style;
    expect(row.flexWrap).toBe('wrap');
    expect(row.right).toBe(row.left);
  });

  it('non-primary with 0 rides renders no chip row', async () => {
    await render(<PhotoBand {...base} isPrimary={false} ridesCount={0} />);
    expect(screen.queryByTestId('photo-band-chips')).toBeNull();
  });

  it('without a photo it is a dashed "Add a photo" button that opens the picker', async () => {
    const onAddPhoto = jest.fn();
    await render(
      <PhotoBand {...base} photoUrl={null} isPrimary ridesCount={3} onAddPhoto={onAddPhoto} />,
    );
    expect(screen.getByText('Add a photo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a photo of this bike' }));
    expect(onAddPhoto).toHaveBeenCalledTimes(1);
  });
});
