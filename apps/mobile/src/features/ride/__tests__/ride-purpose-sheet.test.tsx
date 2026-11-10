// The optional "about this ride" answers on the ride summary: purpose, passenger
// and the odometer at the end. Each answer goes to the server on its own through
// the ride sync queue; leaving the sheet alone sends nothing, so the summary's
// Save is the same as before. An odometer below the bike's asks first, as the
// bike hub does, and one typed but not sent goes with the summary's Save.

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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createRef } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { queryKeys } from '@/lib/query-keys';
import { enqueueOrExecute } from '@/utils/ride-sync-queue';
import {
  RidePurposeSheet,
  type RidePurposeSheetHandle,
  rideOdometerNeedsConfirm,
} from '../ride-purpose-sheet';

const enqueue = enqueueOrExecute as jest.Mock;

function renderSheet(
  distanceUnit: 'km' | 'mi' = 'mi',
  motorcycleId = 'bike-1',
  ref?: React.Ref<RidePurposeSheetHandle>,
) {
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
      <RidePurposeSheet ref={ref} rideId="ride-1" motorcycleId={motorcycleId} />
    </QueryClientProvider>,
  );
}

const updates = () =>
  enqueue.mock.calls.filter(([type]) => type === 'updateRide').map(([, p]) => p.variables.input);

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alert.mockRestore());

/** Presses a button of the lower-reading prompt by its label key. */
async function answerPrompt(label: string) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === label)?.onPress?.());
}

const typeOdometer = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('ridePurposeSheet.odometerLabel'), text);

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

  it("asks before sending an odometer below the bike's, with the bike hub prompt", async () => {
    await renderSheet();
    // The trip meter, typed by mistake: the bike is at 12,400.
    await typeOdometer('245');
    await fireEvent.press(screen.getByText('ridePurposeSheet.odometerSave'));

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('bikeHub.odometer.lowerThan');
    expect(message).toBe('bikeHub.odometer.lowerOneLine');
    expect((buttons as AlertButton[]).map((button) => button.text)).toEqual([
      'bikeHub.odometer.fixIt',
      'bikeHub.odometer.save',
    ]);
    expect(updates()).toEqual([]);

    await answerPrompt('bikeHub.odometer.fixIt');
    expect(updates()).toEqual([]);
    expect(screen.queryByText('ridePurposeSheet.odometerSaved')).toBeNull();

    // The rider meant it: the reading was wrong before.
    await fireEvent.press(screen.getByText('ridePurposeSheet.odometerSave'));
    await answerPrompt('bikeHub.odometer.save');
    expect(updates()).toEqual([{ rideId: 'ride-1', odometerAtEnd: 245 }]);
  });

  it("sends an odometer at or above the bike's without asking", async () => {
    await renderSheet();
    await typeOdometer('12400');
    await fireEvent.press(screen.getByText('ridePurposeSheet.odometerSave'));
    expect(alert).not.toHaveBeenCalled();
    expect(updates()).toEqual([{ rideId: 'ride-1', odometerAtEnd: 12_400 }]);
  });

  it('sends a typed, unsent odometer when the summary saves', async () => {
    const ref = createRef<RidePurposeSheetHandle>();
    await renderSheet('mi', 'bike-1', ref);
    await typeOdometer('12,463');

    let sent: boolean | undefined;
    await act(async () => {
      sent = await ref.current?.sendPendingOdometer();
    });

    expect(sent).toBe(true);
    expect(updates()).toEqual([{ rideId: 'ride-1', odometerAtEnd: 12_463 }]);
    // Already sent: a second Save sends nothing more.
    await act(async () => {
      await ref.current?.sendPendingOdometer();
    });
    expect(updates()).toHaveLength(1);
  });

  it("holds the summary's save while the rider fixes a lower odometer", async () => {
    const ref = createRef<RidePurposeSheetHandle>();
    await renderSheet('mi', 'bike-1', ref);
    await typeOdometer('245');

    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = ref.current?.sendPendingOdometer();
    });
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    await answerPrompt('bikeHub.odometer.fixIt');

    await expect(pending).resolves.toBe(false);
    expect(updates()).toEqual([]);
  });

  it('lets the summary save when no odometer was typed', async () => {
    const ref = createRef<RidePurposeSheetHandle>();
    await renderSheet('mi', 'bike-1', ref);
    await expect(ref.current?.sendPendingOdometer()).resolves.toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('rideOdometerNeedsConfirm', () => {
  it.each([
    [245, 12_400, true],
    [12_400, 12_400, false],
    [12_463, 12_400, false],
    [245, null, false],
    [245, 0, false],
  ])('%d against an odometer of %p needs confirming: %p', (value, current, expected) => {
    expect(rideOdometerNeedsConfirm(value, current)).toBe(expected);
  });
});
