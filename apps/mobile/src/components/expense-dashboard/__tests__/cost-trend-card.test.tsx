// The expense dashboard's Cost trend card: hidden below five expenses, locked
// for a free rider with a tap that opens the cost_insights paywall, and one
// trend per currency for a Pro rider with a note on the other currencies.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/utils/haptics', () => ({ triggerImpact: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    i18n: { language: 'en' },
  }),
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { trackEvent } from '@/lib/analytics';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { CostTrendCard } from '../cost-trend-card';

const BIKE = '7b0b2b4e-3f7a-4c3e-9a51-2a8f5d0c9e11';

const months = (totals: number[]) =>
  totals.map((total, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, total }));

const FREE = { isPro: false, expenseCount: 6, series: null };
const PRO = {
  isPro: true,
  expenseCount: 7,
  series: [
    { currency: 'EUR', expenseCount: 6, total: 300, months: months([0, 100, 0, 200]) },
    { currency: 'USD', expenseCount: 1, total: 40, months: months([40, 0, 0, 0]) },
  ],
};

let client: QueryClient;

async function renderCard(payload: unknown, expenseCount = 6) {
  mockFetcher.mockResolvedValue({ expenseCostTrend: payload });
  return await render(
    <QueryClientProvider client={client}>
      <CostTrendCard motorcycleId={BIKE} expenseCount={expenseCount} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockPresentPaywall.mockReset();
  jest.mocked(trackEvent).mockClear();
  useSubscriptionStore.setState({ isPro: false });
});

describe('CostTrendCard', () => {
  it('does not fetch or show below five expenses', async () => {
    await renderCard(FREE, 4);
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cost-trend-card')).toBeNull();
  });

  it('shows the locked state to a free rider, and a tap opens the cost_insights paywall', async () => {
    mockPresentPaywall.mockResolvedValue('cancelled');
    await renderCard(FREE);
    const locked = await screen.findByTestId('cost-trend-locked');
    expect(trackEvent).toHaveBeenCalledWith('EXPENSE_COST_TREND_SHOWN', { locked: true });

    fireEvent.press(locked);
    await waitFor(() =>
      expect(mockPresentPaywall).toHaveBeenCalledWith(
        expect.objectContaining({ placement: 'cost_insights', surface: 'expense_cost_trend' }),
      ),
    );
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('re-reads the tier after a purchase and shows the trend', async () => {
    mockPresentPaywall.mockResolvedValue('purchased');
    await renderCard(FREE);
    mockFetcher.mockResolvedValue({ expenseCostTrend: PRO });
    fireEvent.press(await screen.findByTestId('cost-trend-locked'));

    await screen.findByTestId('cost-trend-series');
    expect(mockFetcher).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ motorcycleId: BIKE, refreshEntitlement: true }),
    );
  });

  it('does not sell Pro to a rider the store already reads as Pro', async () => {
    useSubscriptionStore.setState({ isPro: true });
    await renderCard(FREE);
    mockFetcher.mockResolvedValue({ expenseCostTrend: PRO });
    fireEvent.press(await screen.findByTestId('cost-trend-locked'));

    await screen.findByTestId('cost-trend-series');
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });

  it('shows one trend per currency, each with the count of expenses it leaves out', async () => {
    await renderCard(PRO, 7);
    await screen.findByTestId('cost-trend-series');
    expect(trackEvent).toHaveBeenCalledWith('EXPENSE_COST_TREND_SHOWN', { locked: false });
    expect(screen.getByText('expenses.costTrend.otherCurrencies {"count":1}')).toBeTruthy();
    expect(screen.getByText('expenses.costTrend.otherCurrencies {"count":6}')).toBeTruthy();
    expect(screen.getAllByText('expenses.costTrend.last12Months')).toHaveLength(2);
  });

  it('hides when the window has no expenses', async () => {
    await renderCard({ ...FREE, expenseCount: 0 });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalled());
    expect(screen.queryByTestId('cost-trend-card')).toBeNull();
  });
});
