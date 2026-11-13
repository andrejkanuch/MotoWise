// issue 365 T04c — bike_setup_summary: one event per leave of the onboarding
// bike-setup step, with search/list counters and the models fetch time.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

const mockTrack = jest.fn();
jest.mock('@/lib/onboarding-analytics', () => ({
  trackOnboardingEvent: (...args: unknown[]) => mockTrack(...args),
}));
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { BIKE_SETUP_SUMMARY: 'bike_setup_summary' },
}));

// Focus is driven by hand so a test can blur and re-focus the screen.
const mockFocus: { run: (() => void) | null; cleanup: (() => void) | null } = {
  run: null,
  cleanup: null,
};
const mockRemoveListeners: Array<(e: { data: { action: { type: string } } }) => void> = [];
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => (() => void) | undefined) => {
      React.useEffect(() => {
        mockFocus.run = () => {
          mockFocus.cleanup = cb() ?? null;
        };
        mockFocus.run();
        return () => mockFocus.cleanup?.();
      }, [cb]);
    },
    useNavigation: () => mockNavigation,
  };
});
const mockNavigation = {
  addListener: (_type: string, listener: (e: { data: { action: { type: string } } }) => void) => {
    mockRemoveListeners.push(listener);
    return () => {
      const i = mockRemoveListeners.indexOf(listener);
      if (i >= 0) mockRemoveListeners.splice(i, 1);
    };
  },
};

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { OB_SCREEN } from '@/config/onboarding';
import i18n from '@/i18n';
import { BACKGROUND_LEFT_MS, savePendingSummary } from '../bike-setup-telemetry';
import { MakeGrid } from '../make-grid';
import { ModelPicker } from '../model-picker';
import { type BikeSetupTelemetry, useBikeSetupTelemetry } from '../use-bike-setup-telemetry';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const MAKES = [
  { makeId: 1, makeName: 'Honda' },
  { makeId: 2, makeName: 'Yamaha' },
  { makeId: 3, makeName: 'Kawasaki' },
];
const MODELS = [
  { modelId: 11, modelName: 'MT-07' },
  { modelId: 12, modelName: 'Tenere 700' },
  { modelId: 13, modelName: 'R1' },
];

let appStateHandler: ((s: AppStateStatus) => void) | null = null;
let now = 1_000_000;
let telemetry: BikeSetupTelemetry;

function Harness({
  year = '2020',
  restored = { make: false, model: false },
  showPickers = true,
}: {
  year?: string;
  restored?: { make: boolean; model: boolean };
  /** false unmounts both pickers, as the screen does between Stage A and Stage B. */
  showPickers?: boolean;
}) {
  telemetry = useBikeSetupTelemetry({ year, restored });
  telemetry.noteModelListSize(MODELS.length);
  if (!showPickers) return null;
  return (
    <>
      <MakeGrid
        makes={MAKES}
        stats={[]}
        onSelect={() => {}}
        onSelectOther={() => {}}
        telemetry={telemetry}
      />
      <ModelPicker
        makeName="Yamaha"
        isCustomMake={false}
        models={MODELS}
        isLoading={false}
        selectedModel={null}
        onSelect={() => {}}
        onDismiss={() => {}}
        telemetry={telemetry}
      />
    </>
  );
}

function summaries() {
  return mockTrack.mock.calls.filter(([event]) => event === 'bike_setup_summary');
}
function lastSummary() {
  const calls = summaries();
  return calls[calls.length - 1]?.[2];
}
const makeSearch = () => screen.getByPlaceholderText(t('onboarding.v2MakeGridSearchPlaceholder'));
const modelSearch = () =>
  screen.getByPlaceholderText(
    t('onboarding.v2ModelPickerSearchPlaceholder', { makeName: 'Yamaha' }),
  );

beforeEach(() => {
  mockTrack.mockClear();
  mockRemoveListeners.length = 0;
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (s: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('bike_setup_summary — once per leave', () => {
  it('fires once on Continue, with step scope and duration', async () => {
    await render(<Harness />);
    now += 4200;
    await act(() => {
      telemetry.finish('completed');
      telemetry.finish('completed');
    });
    expect(summaries()).toHaveLength(1);
    const [event, step, props] = summaries()[0];
    expect(event).toBe('bike_setup_summary');
    expect(step).toBe(OB_SCREEN.BIKE_SETUP);
    expect(props).toMatchObject({
      outcome: 'completed',
      duration_ms: 4200,
      make_queries: 0,
      model_queries: 0,
      make_picked_via: 'none',
      model_picked_via: 'none',
      model_list_size: 3,
      model_fetch_ms: null,
      year_changed: false,
    });
  });

  it('does not fire again when the screen unmounts after Skip', async () => {
    const { unmount } = await render(<Harness />);
    await act(() => telemetry.finish('skipped'));
    await unmount();
    expect(summaries()).toHaveLength(1);
    expect(lastSummary().outcome).toBe('skipped');
  });

  it('counts a hardware/gesture Back (unmount after a GO_BACK/POP) as back', async () => {
    const { unmount } = await render(<Harness />);
    await act(() => {
      for (const l of mockRemoveListeners) l({ data: { action: { type: 'POP' } } });
    });
    await unmount();
    expect(summaries()).toHaveLength(1);
    expect(lastSummary().outcome).toBe('back');
  });

  it('counts an unmount from a replaced stack as left', async () => {
    const { unmount } = await render(<Harness />);
    await unmount();
    expect(summaries()).toHaveLength(1);
    expect(lastSummary().outcome).toBe('left');
  });

  it('starts a new visit when the rider comes back after Continue', async () => {
    await render(<Harness />);
    await act(() => telemetry.finish('completed'));
    await act(() => {
      mockFocus.cleanup?.();
      now += 10_000;
      mockFocus.run?.();
    });
    now += 1500;
    await act(() => telemetry.finish('back'));
    expect(summaries()).toHaveLength(2);
    expect(lastSummary()).toMatchObject({ outcome: 'back', duration_ms: 1500 });
  });

  it('a background over 30 min ends the visit as left at the moment it went away', async () => {
    await render(<Harness />);
    now += 3000;
    await act(() => appStateHandler?.('background'));
    now += BACKGROUND_LEFT_MS + 1;
    await act(() => appStateHandler?.('active'));
    expect(summaries()).toHaveLength(1);
    expect(lastSummary()).toMatchObject({ outcome: 'left', duration_ms: 3000 });
    // A new visit is running: Continue fires a second event.
    now += 2000;
    await act(() => telemetry.finish('completed'));
    expect(summaries()).toHaveLength(2);
    expect(lastSummary()).toMatchObject({ outcome: 'completed', duration_ms: 2000 });
  });

  it('a short background keeps the visit going', async () => {
    await render(<Harness />);
    await act(() => appStateHandler?.('background'));
    now += 60_000;
    await act(() => appStateHandler?.('active'));
    expect(summaries()).toHaveLength(0);
  });

  it('a visit the process died in is reported as left on the next mount', async () => {
    savePendingSummary({
      outcome: 'left',
      duration_ms: 9000,
      make_queries: 1,
      model_queries: 0,
      make_picked_via: 'search',
      model_picked_via: 'none',
      model_list_size: 0,
      model_fetch_ms: null,
      year_changed: false,
    });
    const { unmount } = await render(<Harness />);
    expect(summaries()).toHaveLength(1);
    expect(lastSummary()).toMatchObject({ outcome: 'left', duration_ms: 9000 });
    await act(() => telemetry.finish('completed'));
    await unmount();
    // The pending one is consumed: a later mount does not repeat it.
    mockTrack.mockClear();
    await render(<Harness />);
    expect(summaries()).toHaveLength(0);
  });
});

describe('bike_setup_summary — counters', () => {
  it('a make picked from the popular list is list; from typed results is search', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByText('Honda'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ make_picked_via: 'list', make_queries: 0 });
  });

  it('typing a make query counts one search per start, not per keystroke', async () => {
    await render(<Harness />);
    await fireEvent.changeText(makeSearch(), 'Y');
    await fireEvent.changeText(makeSearch(), 'Ya');
    await fireEvent.changeText(makeSearch(), 'Yamaha');
    await fireEvent.press(screen.getByText('Yamaha'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ make_picked_via: 'search', make_queries: 1 });
  });

  it('clearing and retyping counts as a second search', async () => {
    await render(<Harness />);
    await fireEvent.changeText(makeSearch(), 'Yam');
    await fireEvent.changeText(makeSearch(), '');
    await fireEvent.changeText(makeSearch(), 'Kaw');
    await act(() => telemetry.finish('skipped'));
    expect(lastSummary().make_queries).toBe(2);
  });

  it('a search typed after the pickers remount (Change make) counts again', async () => {
    const { rerender } = await render(<Harness />);
    await fireEvent.changeText(makeSearch(), 'Yam');
    await fireEvent.changeText(modelSearch(), 'MT');
    // Pick a make (grid goes away), then "Change make": both fields come back empty.
    await rerender(<Harness showPickers={false} />);
    await rerender(<Harness />);
    await fireEvent.changeText(makeSearch(), 'Kaw');
    await fireEvent.changeText(modelSearch(), 'Z');
    await act(() => telemetry.finish('skipped'));
    expect(lastSummary()).toMatchObject({ make_queries: 2, model_queries: 2 });
  });

  it('"Other make" is custom', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Other make'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().make_picked_via).toBe('custom');
  });

  it('a model from the default list is list, from a typed query is search, a typed name is custom', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByText('MT-07'));
    expect(lastSummary()).toBeUndefined();
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ model_picked_via: 'list', model_queries: 0 });

    mockTrack.mockClear();
    await act(() => {
      mockFocus.cleanup?.();
      mockFocus.run?.();
    });
    await fireEvent.changeText(modelSearch(), 'tene');
    await fireEvent.press(screen.getByText('Tenere 700'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ model_picked_via: 'search', model_queries: 1 });

    mockTrack.mockClear();
    await act(() => {
      mockFocus.cleanup?.();
      mockFocus.run?.();
    });
    await fireEvent.changeText(modelSearch(), '');
    await fireEvent.changeText(modelSearch(), 'XSR900');
    await fireEvent.press(
      screen.getByText(t('onboarding.v2ModelPickerUseCustom', { model: 'XSR900' })),
    );
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ model_picked_via: 'custom', model_queries: 1 });
  });

  it('picking a new make clears how the model was picked', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByText('MT-07'));
    await fireEvent.press(screen.getByText('Kawasaki'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({ make_picked_via: 'list', model_picked_via: 'none' });
  });

  it('a make/model restored from the draft reads restored', async () => {
    await render(<Harness restored={{ make: true, model: true }} />);
    await act(() => telemetry.finish('completed'));
    expect(lastSummary()).toMatchObject({
      make_picked_via: 'restored',
      model_picked_via: 'restored',
    });
  });

  it('year_changed compares the year at leave with the year at visit start', async () => {
    const { rerender } = await render(<Harness year="2020" />);
    await rerender(<Harness year="2019" />);
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().year_changed).toBe(true);
  });

  it('model_fetch_ms is measured around the models query', async () => {
    await render(<Harness />);
    await act(() => telemetry.noteModelFetch('2:2020', true));
    now += 850;
    await act(() => telemetry.noteModelFetch('2:2020', false));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().model_fetch_ms).toBe(850);
  });

  it('a cached models list (never fetching) leaves model_fetch_ms null', async () => {
    await render(<Harness />);
    await act(() => telemetry.noteModelFetch('2:2020', false));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().model_fetch_ms).toBeNull();
  });

  it('a fetch abandoned for another make is not reported', async () => {
    await render(<Harness />);
    await act(() => telemetry.noteModelFetch('2:2020', true));
    now += 5000;
    await act(() => telemetry.noteModelFetch('3:2020', false));
    now += 1000;
    await act(() => telemetry.noteModelFetch('2:2020', false));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().model_fetch_ms).toBeNull();
  });

  it('retries and backoff count: model_fetch_ms is the whole wait, failures included', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 2, retryDelay: 0, gcTime: 0 } },
    });
    let attempts = 0;
    function QueryHarness() {
      telemetry = useBikeSetupTelemetry({ year: '2020', restored: { make: true, model: false } });
      const result = useQuery({
        queryKey: ['models', 2, 2020],
        queryFn: async () => {
          attempts += 1;
          // Each attempt (with the backoff before it) takes 3 s; the last one fails too.
          now += 3000;
          throw new Error('timeout');
        },
      });
      telemetry.noteModelFetch('2:2020', result.fetchStatus !== 'idle');
      return null;
    }
    await render(
      <QueryClientProvider client={client}>
        <QueryHarness />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(attempts).toBe(3));
    await waitFor(() => expect(client.getQueryState(['models', 2, 2020])?.status).toBe('error'));
    await act(() => telemetry.finish('completed'));
    expect(lastSummary().model_fetch_ms).toBe(9000);
    client.clear();
  });

  it('never sends the typed search text', async () => {
    await render(<Harness />);
    await fireEvent.changeText(makeSearch(), 'Yamaha secret');
    await act(() => telemetry.finish('skipped'));
    expect(JSON.stringify(lastSummary())).not.toContain('secret');
    expect(JSON.stringify(lastSummary())).not.toContain('Yamaha');
  });
});
