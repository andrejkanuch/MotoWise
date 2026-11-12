jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

import { migrateCarPlayState, useCarPlayStore } from '../carplay.store';

describe('migrateCarPlayState', () => {
  it.each([
    ['automatic', 0],
    ['automatic', 1],
    ['phoneFirst', 1],
  ] as const)('moves a stored %s start mode (v%i) to manual', (startMode, version) => {
    expect(migrateCarPlayState({ startMode, tone: 'chime' }, version)).toEqual({
      startMode: 'manual',
      tone: 'chime',
    });
  });

  it('keeps manual and an unreadable state as they are', () => {
    expect(migrateCarPlayState({ startMode: 'manual' }, 1)).toEqual({ startMode: 'manual' });
    expect(migrateCarPlayState(undefined, 1)).toBeUndefined();
  });
});

describe('persistence', () => {
  it('keeps the carplay-companion persist name at version 2', () => {
    const options = useCarPlayStore.persist.getOptions();
    expect(options.name).toBe('carplay-companion');
    expect(options.version).toBe(2);
  });

  it('defaults to the manual start mode', () => {
    expect(useCarPlayStore.getInitialState().startMode).toBe('manual');
  });
});
