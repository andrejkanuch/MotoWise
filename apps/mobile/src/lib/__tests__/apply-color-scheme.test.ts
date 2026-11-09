// applyColorScheme is the only caller of Appearance.setColorScheme. It must
// never reach native while CarPlay is connected (Sentry
// MOTO-VAULT-REACT-NATIVE-43: RCTAppearance asks the CarPlay scene for
// `windows` and the app dies), and it must not re-apply an unchanged value.

let mockConnected = false;
let mockDisconnect: (() => void) | null = null;
let mockPhoneScene: ((visible: boolean) => void) | null = null;
const mockRemove = jest.fn();

jest.mock('../../../modules/carplay/src', () => ({
  isHeadUnitConnected: () => mockConnected,
  addDisconnectListener: (listener: () => void) => {
    mockDisconnect = listener;
    return { remove: mockRemove };
  },
  addPhoneSceneVisibilityListener: (listener: (visible: boolean) => void) => {
    mockPhoneScene = listener;
    return { remove: jest.fn() };
  },
}));

import { Appearance } from 'react-native';
import { applyColorScheme, resetAppliedColorSchemeForTests } from '../apply-color-scheme';

const mockSetColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

function disconnectCarPlay() {
  mockConnected = false;
  mockDisconnect?.();
}

beforeEach(() => {
  resetAppliedColorSchemeForTests();
  jest.clearAllMocks();
  mockConnected = false;
  mockDisconnect = null;
  mockPhoneScene = null;
});

describe('applyColorScheme', () => {
  it('applies a forced scheme', () => {
    applyColorScheme('dark');
    expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
  });

  it('never calls native for the System theme on a fresh launch', () => {
    applyColorScheme('unspecified');
    expect(mockSetColorScheme).not.toHaveBeenCalled();
  });

  it('does not re-apply a value already applied (the per-render caller)', () => {
    applyColorScheme('light');
    applyColorScheme('light');
    applyColorScheme('light');
    expect(mockSetColorScheme).toHaveBeenCalledTimes(1);
  });

  it('applies each real change, including back to System', () => {
    applyColorScheme('dark');
    applyColorScheme('unspecified');
    expect(mockSetColorScheme.mock.calls).toEqual([['dark'], ['unspecified']]);
  });

  it('never calls native while CarPlay is connected, and applies the choice on disconnect', () => {
    mockConnected = true;
    applyColorScheme('dark');
    expect(mockSetColorScheme).not.toHaveBeenCalled();

    disconnectCarPlay();
    expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    expect(mockRemove).toHaveBeenCalled();
  });

  it('applies only the last choice made while connected', () => {
    mockConnected = true;
    applyColorScheme('dark');
    applyColorScheme('light');
    disconnectCarPlay();
    expect(mockSetColorScheme.mock.calls).toEqual([['light']]);
  });

  it('applies nothing on disconnect when the deferred choice is what is already applied', () => {
    applyColorScheme('dark');
    mockConnected = true;
    applyColorScheme('dark');
    disconnectCarPlay();
    expect(mockSetColorScheme).toHaveBeenCalledTimes(1);
  });

  it('re-applies a forced scheme when the phone UI appears in a new window', () => {
    applyColorScheme('dark');
    mockPhoneScene?.(true);
    expect(mockSetColorScheme.mock.calls).toEqual([['dark'], ['dark']]);
  });

  it('does not re-apply when the phone UI hides, or while CarPlay is connected', () => {
    applyColorScheme('dark');
    mockPhoneScene?.(false);
    mockConnected = true;
    mockPhoneScene?.(true);
    expect(mockSetColorScheme).toHaveBeenCalledTimes(1);
  });

  it('never calls native for the System theme when the phone UI appears', () => {
    applyColorScheme('unspecified');
    mockPhoneScene?.(true);
    expect(mockSetColorScheme).not.toHaveBeenCalled();
  });
});
