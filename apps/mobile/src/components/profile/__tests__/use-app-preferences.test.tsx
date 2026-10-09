const mockMutate = jest.fn();
const mockSetNativeColorScheme = jest.fn();
const mockStore = {
  locale: 'en',
  colorScheme: 'system',
  measurementSystem: 'metric',
  currency: 'EUR',
  mapOrientation: 'north',
  setLocale: jest.fn(),
  setColorScheme: jest.fn(),
  setMeasurementSystem: jest.fn(),
  setCurrency: jest.fn(),
  setMapOrientation: jest.fn(),
};

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ setColorScheme: mockSetNativeColorScheme }),
}));
jest.mock('../../../hooks/use-profile-data', () => ({
  useUpdatePreference: () => ({ mutate: mockMutate }),
}));
// The real store pulls in i18n init; the hook only needs the constant and the hook.
jest.mock('../../../stores/auth.store', () => ({
  COLOR_SCHEME: { SYSTEM: 'system', LIGHT: 'light', DARK: 'dark' },
  useAuthStore: () => mockStore,
}));

import { MeasurementSystem } from '@motovault/types';
import { act, renderHook } from '@testing-library/react-native';
import { COLOR_SCHEME } from '../../../stores/auth.store';
import { MAP_ORIENTATIONS } from '../../../utils/map-orientation';
import { APP_PREFERENCE_KEY, type AppPreferenceKey } from '../constants';
import { useAppPreferences } from '../use-app-preferences';

async function select(key: AppPreferenceKey, value: string) {
  const { result } = await renderHook(() => useAppPreferences());
  await act(async () => result.current[key].select(value));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAppPreferences', () => {
  it('units: updates the store and writes the measurement system to the server', async () => {
    await select(APP_PREFERENCE_KEY.UNITS, MeasurementSystem.IMPERIAL);
    expect(mockStore.setMeasurementSystem).toHaveBeenCalledWith(MeasurementSystem.IMPERIAL);
    expect(mockMutate).toHaveBeenCalledWith({ measurementSystem: MeasurementSystem.IMPERIAL });
  });

  it('currency: updates the store and writes the currency to the server', async () => {
    await select(APP_PREFERENCE_KEY.CURRENCY, 'USD');
    expect(mockStore.setCurrency).toHaveBeenCalledWith('USD');
    expect(mockMutate).toHaveBeenCalledWith({ currency: 'USD' });
  });

  it('theme: System hands the native scheme back to the OS', async () => {
    await select(APP_PREFERENCE_KEY.THEME, COLOR_SCHEME.SYSTEM);
    expect(mockStore.setColorScheme).toHaveBeenCalledWith(COLOR_SCHEME.SYSTEM);
    expect(mockSetNativeColorScheme).toHaveBeenCalledWith('unspecified');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('theme: an explicit scheme is passed through', async () => {
    await select(APP_PREFERENCE_KEY.THEME, COLOR_SCHEME.DARK);
    expect(mockSetNativeColorScheme).toHaveBeenCalledWith(COLOR_SCHEME.DARK);
  });

  it('language: device-local only, no server write', async () => {
    await select(APP_PREFERENCE_KEY.LANGUAGE, 'de');
    expect(mockStore.setLocale).toHaveBeenCalledWith('de');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('ride map: device-local only, no server write', async () => {
    await select(APP_PREFERENCE_KEY.RIDE_MAP, MAP_ORIENTATIONS.HEADING);
    expect(mockStore.setMapOrientation).toHaveBeenCalledWith(MAP_ORIENTATIONS.HEADING);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('labels the selected option', async () => {
    const { result } = await renderHook(() => useAppPreferences());
    expect(result.current[APP_PREFERENCE_KEY.CURRENCY].selectedLabel).toBe('EUR');
    expect(result.current[APP_PREFERENCE_KEY.UNITS].selectedLabel).toBe('profile.metric');
  });
});
