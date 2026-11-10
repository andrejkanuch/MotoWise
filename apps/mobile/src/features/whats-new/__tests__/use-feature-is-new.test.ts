/**
 * A feature counts as new, and its entry rows carry the NEW chip, while it is
 * in the latest release's What's New set and the rider has not used it on this
 * device. Holdout riders, who never get the carousel, still see the chips.
 */

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());

const mockApplication: { nativeApplicationVersion: string | null } = {
  nativeApplicationVersion: '3.28.0',
};
jest.mock('expo-application', () => ({
  __esModule: true,
  get nativeApplicationVersion() {
    return mockApplication.nativeApplicationVersion;
  },
}));

import { act, renderHook } from '@testing-library/react-native';
import { WHATS_NEW_ARM, WHATS_NEW_EXPERIMENT } from '@/config/whats-new';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useFeatureIsNew } from '../use-feature-is-new';

const { ROAD_ATLAS, RECEIPT_SCAN, NOTES_PHOTOS } = WHATS_NEW_FEATURE;

beforeEach(() => {
  mockApplication.nativeApplicationVersion = '3.28.0';
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
});

describe('useFeatureIsNew', () => {
  it.each([
    ROAD_ATLAS,
    RECEIPT_SCAN,
    NOTES_PHOTOS,
  ])('is true for %s while it is in the latest set and unused', async (feature) => {
    const { result } = await renderHook(() => useFeatureIsNew(feature));
    expect(result.current).toBe(true);
  });

  it('turns false once the rider uses the feature', async () => {
    const { result } = await renderHook(() => useFeatureIsNew(ROAD_ATLAS));
    expect(result.current).toBe(true);
    await act(async () => useWhatsNewStore.getState().markUsed(ROAD_ATLAS));
    expect(result.current).toBe(false);
  });

  it('stays true after the carousel showed it, until it is used', async () => {
    useWhatsNewStore.getState().markReleaseSeen('3.28.0', [ROAD_ATLAS, RECEIPT_SCAN]);
    const { result } = await renderHook(() => useFeatureIsNew(RECEIPT_SCAN));
    expect(result.current).toBe(true);
  });

  it('still shows for a rider held out of the carousel', async () => {
    useWhatsNewStore
      .getState()
      .setHoldoutArm(WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY, WHATS_NEW_ARM.HOLDOUT);
    const { result } = await renderHook(() => useFeatureIsNew(ROAD_ATLAS));
    expect(result.current).toBe(true);
  });

  it('is false for a feature the installed build does not carry yet', async () => {
    mockApplication.nativeApplicationVersion = '3.22.0';
    const atlas = await renderHook(() => useFeatureIsNew(ROAD_ATLAS));
    const notes = await renderHook(() => useFeatureIsNew(NOTES_PHOTOS));
    expect(atlas.result.current).toBe(false);
    expect(notes.result.current).toBe(true);
  });

  it('is false when the installed version is unknown', async () => {
    mockApplication.nativeApplicationVersion = null;
    const { result } = await renderHook(() => useFeatureIsNew(ROAD_ATLAS));
    expect(result.current).toBe(false);
  });
});
