/**
 * What's New must not greet a rider who just installed: finishing onboarding
 * marks the installed version seen. A rider updating from an older version
 * (who never passes through onboarding) must still be owed the modal.
 */

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

const mockApplication: { nativeApplicationVersion: string | null } = {
  nativeApplicationVersion: null,
};
jest.mock('expo-application', () => ({
  __esModule: true,
  get nativeApplicationVersion() {
    return mockApplication.nativeApplicationVersion;
  },
}));

import { getLatestRelease } from '../../data/whats-new-releases';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import { isWhatsNewOwed, markWhatsNewSeenForNewRider } from '../whats-new';

const CURRENT_VERSION = getLatestRelease().version;
const PREVIOUS_VERSION = '0.0.1';
const UNRELEASED_VERSION = '999.0.0';

beforeEach(() => {
  mockApplication.nativeApplicationVersion = CURRENT_VERSION;
  useWhatsNewStore.setState({ lastSeenVersion: null });
});

describe('markWhatsNewSeenForNewRider', () => {
  it('marks the installed version seen, so a new rider is not owed What’s New', () => {
    expect(isWhatsNewOwed(CURRENT_VERSION, useWhatsNewStore.getState().lastSeenVersion)).toBe(true);

    markWhatsNewSeenForNewRider();

    expect(useWhatsNewStore.getState().lastSeenVersion).toBe(CURRENT_VERSION);
    expect(isWhatsNewOwed(CURRENT_VERSION, useWhatsNewStore.getState().lastSeenVersion)).toBe(
      false,
    );
  });

  it('leaves the store untouched when the native version is unknown', () => {
    mockApplication.nativeApplicationVersion = null;
    markWhatsNewSeenForNewRider();
    expect(useWhatsNewStore.getState().lastSeenVersion).toBeNull();
  });
});

describe('isWhatsNewOwed', () => {
  it('is owed to an existing rider updating from an older version', () => {
    useWhatsNewStore.setState({ lastSeenVersion: PREVIOUS_VERSION });
    expect(isWhatsNewOwed(CURRENT_VERSION, useWhatsNewStore.getState().lastSeenVersion)).toBe(true);
  });

  it('is not owed for a version with no release entry', () => {
    expect(isWhatsNewOwed(UNRELEASED_VERSION, PREVIOUS_VERSION)).toBe(false);
  });

  it('is not owed without a native version', () => {
    expect(isWhatsNewOwed(null, null)).toBe(false);
  });
});
