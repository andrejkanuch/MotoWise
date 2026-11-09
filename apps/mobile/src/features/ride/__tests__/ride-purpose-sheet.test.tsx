// The optional "about this ride" answers on the ride summary: purpose, passenger
// and the odometer at the end. Each answer goes to the server on its own through
// the ride sync queue; leaving the sheet alone sends nothing, so the summary's
// Save is the same as before.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@/utils/ride-sync-queue', () => ({
  enqueueOrExecute: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/ui/native-toggle', () => {
  const { Switch } = require('react-native');
  return {
    NativeToggle: ({
      value,
      onValueChange,
    }: {
      value: boolean;
      onValueChange: (v: boolean) => void;
    }) => <Switch testID="passenger-toggle" value={value} onValueChange={onValueChange} />,
  };
});

import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { queryKeys } from '@/lib/query-keys';
import { enqueueOrExecute } from '@/utils/ride-sync-queue';
import { RidePurposeSheet } from '../ride-purpose-sheet';

const enqueue = enqueueOrExecute as jest.Mock;

function renderSheet(distanceUnit: 'km' | 'mi' = 'mi', motorcycleId = 'bike-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all, {
    myMotorcycles: [
      {
        id: 'bike-1',
        currentMileage: 12_400,
        distanceUnit,
      } as MyMotorcyclesQuery['myMotorcycles'][number],
    ],
  });
  return render(
    <QueryClientProvider client={client}>
      <RidePurposeSheet rideId="ride-1" motorcycleId={motorcycleId} />
    </QueryClientProvider>,
  );
}

const updates = () =>
  enqueue.mock.calls.filter(([type]) => type === 'updateRide').map(([, p]) => p.variables.input);

beforeEach(() => jest.clearAllMocks());

describe('RidePurposeSheet', () => {
  it('sends nothing when the rider skips it', async () => {
    const view = await renderSheet();
    view.unmount();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('sends the purpose the rider picks, and clears it on a second tap', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText('ridePurposeSheet.purpose.commute'));
    await fireEvent.press(screen.getByText('ridePurposeSheet.purpose.commute'));
    expect(updates()).toEqual([
      { rideId: 'ride-1', purpose: 'commute' },
      { rideId: 'ride-1', purpose: null },
    ]);
  });

  it('sends whether a passenger rode along', async () => {
    await renderSheet();
    await fireEvent(screen.getByTestId('passenger-toggle'), 'valueChange', true);
    expect(updates()).toEqual([{ rideId: 'ride-1', passenger: true }]);
  });

  it("sends the odometer at the end in the bike's own unit, once", async () => {
    await renderSheet('mi');
    expect(screen.getByText('mi')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('ridePurposeSheet.odometerLabel'), '12,463');
    await fireEvent.press(screen.getByText('ridePurposeSheet.odometerSave'));
    expect(updates()).toEqual([{ rideId: 'ride-1', odometerAtEnd: 12_463 }]);
    expect(screen.getByText('ridePurposeSheet.odometerSaved')).toBeTruthy();
  });

  it('caps the odometer at seven digits, the most the server accepts', async () => {
    await renderSheet();
    const input = screen.getByLabelText('ridePurposeSheet.odometerLabel');
    expect(input.props.maxLength).toBe(7);
    // A typo with extra digits (pasted, or past maxLength) keeps the first seven.
    await fireEvent.changeText(input, '1,246,300,000');
    expect(screen.getByLabelText('ridePurposeSheet.odometerLabel').props.value).toBe('1246300');
    await fireEvent.press(screen.getByText('ridePurposeSheet.odometerSave'));
    expect(updates()).toEqual([{ rideId: 'ride-1', odometerAtEnd: 1_246_300 }]);
    expect(updates()[0].odometerAtEnd).toBeLessThanOrEqual(9_999_999);
  });

  it('does not offer the odometer for a ride without a bike', async () => {
    await renderSheet('km', '');
    expect(screen.queryByLabelText('ridePurposeSheet.odometerLabel')).toBeNull();
  });
});
