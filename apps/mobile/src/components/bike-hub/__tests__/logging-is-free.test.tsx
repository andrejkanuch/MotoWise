/**
 * Logging is always free: adding an expense, a task, past work, a note, a
 * document or an odometer reading from the bike hub never asks for Pro and is
 * never count-limited. Two guards: the Log sheet is exercised as a free rider,
 * and the hub's own source is checked for any reach into the gating code.
 */
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockPresentPaywall = jest.fn();
jest.mock('../../../lib/subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));
const mockUseProGate = jest.fn();
jest.mock('../../../hooks/use-pro-gate', () => ({
  useProGate: (...args: unknown[]) => mockUseProGate(...args),
}));

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  // A getter: the factory runs at import time, before `mockRouter` is initialised.
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ motorcycleId: 'bike-a' }),
  useNavigation: () => ({ addListener: () => () => {} }),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import LogEntrySheet from '../../../app/(tabs)/(garage)/log-entry';
import '../../../i18n';
import { LOG_OPTION } from '../../../lib/bike-hub/constants';
import { useSubscriptionStore } from '../../../stores/subscription.store';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { LOG_OPTIONS } from '../sheets/log-options';

const SRC = path.resolve(__dirname, '../../..');
/** Longer than the sheet's dismissal fallback, so the form has been opened. */
const AFTER_DISMISSAL_MS = 1000;

const clients: QueryClient[] = [];

async function renderLogSheet() {
  mockFetcher.mockResolvedValue({ myMotorcycles: [BIKE_A] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <LogEntrySheet />
    </QueryClientProvider>,
  );
  // The bike arrives with the query; until then no option can be chosen.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  await screen.findByText('Log on the Africa Twin');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // A rider on the free tier whose subscription state is known.
  useSubscriptionStore.setState({
    isAvailable: true,
    isPro: false,
    isTrialing: false,
    isLoading: false,
    isVerified: true,
  });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});

describe('Log sheet — a free rider', () => {
  it.each(
    Object.values(LOG_OPTION),
  )('"%s" opens its form: no paywall, no Pro check', async (option) => {
    // Arrange
    await renderLogSheet();

    // Act
    await fireEvent.press(screen.getByTestId(`log-option-${option}`));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(AFTER_DISMISSAL_MS);
    });

    // Assert
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(mockUseProGate).not.toHaveBeenCalled();
  });

  it('no option is hidden, disabled or badged for a free rider', async () => {
    await renderLogSheet();
    for (const option of Object.values(LOG_OPTION)) {
      expect(screen.getByTestId(`log-option-${option}`)).toBeEnabled();
    }
    expect(screen.queryByText(/\bpro\b|premium|upgrade|unlock/i)).toBeNull();
  });

  it('no option leads to a paywall or onboarding route', () => {
    const target = { motorcycleId: BIKE_A.id, bikeName: '2022 Honda Africa Twin' };
    const pathnames = LOG_OPTIONS.map((option) => {
      const href = option.href(target);
      return typeof href === 'string' ? href : href.pathname;
    });
    expect(pathnames).toHaveLength(Object.values(LOG_OPTION).length);
    for (const pathname of pathnames) {
      expect(pathname).toMatch(/^\/\(tabs\)\/\(garage\)\//);
      expect(pathname).not.toMatch(/paywall|subscription|upgrade|onboarding/i);
    }
  });
});

/** Directories and files that make up the hub's log / note / odometer entry points. */
const HUB_SOURCES = [
  'components/bike-hub/sheets',
  'components/bike-hub/notes',
  'components/bike-hub/overview',
  'components/bike-hub/shell',
  'components/bike-hub/ui',
  'lib/bike-hub',
  'app/(tabs)/(garage)/log-entry.tsx',
  'app/(tabs)/(garage)/note.tsx',
  'app/(tabs)/(garage)/notes.tsx',
  'app/(tabs)/(garage)/odometer.tsx',
  'stores/bike-hub.store.ts',
  'stores/pending-delete.store.ts',
] as const;

/** Modules that decide or present a paywall. */
const GATING_MODULE =
  /from\s+['"][^'"]*(use-pro-gate|subscription\.store|lib\/subscription|react-native-purchases|receipt-scan-quota|entitlement)[^'"]*['"]/;
/** Names that only exist to gate a feature. */
const GATING_IDENTIFIER =
  /\b(useProGate|requirePro|requireAccess|checkFeatureAccess|presentPaywall|useSubscriptionStore|isPro|isTrialing|FREE_TIER_LIMITS|PRO_FEATURES)\b/;

function sourceFiles(relative: string): string[] {
  const absolute = path.join(SRC, relative);
  if (/\.tsx?$/.test(relative)) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.tsx?$/.test(entry.name) ? [path.join(SRC, child)] : [];
  });
}

/** Source without comments — "logging is always free" is written in several of them. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('bike hub source — no reach into the gating code', () => {
  const files = HUB_SOURCES.flatMap(sourceFiles);

  it('finds the hub’s files (the check is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.map((file) => path.basename(file))).toEqual(
      expect.arrayContaining([
        'log-options.ts',
        'note-form.tsx',
        'odometer-sheet.tsx',
        'use-log-odometer.ts',
        'use-notes.ts',
        'notes-composer.tsx',
        'notes-block.tsx',
        'log-entry.tsx',
        'note.tsx',
        'odometer.tsx',
      ]),
    );
  });

  it('the patterns recognise a gate when there is one', () => {
    expect("import { useProGate } from '../../../hooks/use-pro-gate';").toMatch(GATING_MODULE);
    expect("import { presentPaywall } from '../lib/subscription';").toMatch(GATING_MODULE);
    expect('if (!requireAccess("MAX_BIKES", count)) return;').toMatch(GATING_IDENTIFIER);
    expect('const isPro = useSubscriptionStore((s) => s.isPro);').toMatch(GATING_IDENTIFIER);
  });

  it('no file imports the Pro gate, the subscription state or the purchases SDK', () => {
    const offenders = files.filter((file) => GATING_MODULE.test(code(file)));
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it('no file checks Pro status, a free-tier limit or opens a paywall', () => {
    const offenders = files.filter((file) => GATING_IDENTIFIER.test(code(file)));
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});
