jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

import { WHATS_NEW_FEATURE } from '../../data/whats-new-releases';
import { migrateWhatsNewState, useWhatsNewStore } from '../whats-new.store';

const { ROAD_ATLAS, RECEIPT_SCAN, NOTES_PHOTOS } = WHATS_NEW_FEATURE;
const state = () => useWhatsNewStore.getState();

beforeEach(() => {
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
});

describe('migrateWhatsNewState', () => {
  it('keeps a v0 rider’s last-seen release and starts the new fields empty', () => {
    expect(migrateWhatsNewState({ lastSeenVersion: '3.25.0' }, 0)).toEqual({
      lastSeenVersion: '3.25.0',
      seenFeatures: [],
      triedFeatures: [],
      usedFeatures: [],
      holdout: null,
    });
  });

  it('treats an unreadable v0 state as never seen', () => {
    expect(migrateWhatsNewState(undefined, 0).lastSeenVersion).toBeNull();
    expect(migrateWhatsNewState({ lastSeenVersion: 42 }, 0).lastSeenVersion).toBeNull();
  });
});

describe('persistence', () => {
  it('keeps the whats-new persist name at version 1', () => {
    const options = useWhatsNewStore.persist.getOptions();
    expect(options.name).toBe('whats-new');
    expect(options.version).toBe(1);
  });

  it('never persists the return-session flag', () => {
    state().setReturnSessionOpen(true);
    const persisted = useWhatsNewStore.persist.getOptions().partialize?.(state());
    expect(persisted).toEqual({
      lastSeenVersion: null,
      seenFeatures: [],
      triedFeatures: [],
      usedFeatures: [],
      holdout: null,
    });
  });
});

describe('actions', () => {
  it('markReleaseSeen records the release and adds its features to seen, once each', () => {
    state().markReleaseSeen('3.22.0', [NOTES_PHOTOS]);
    state().markReleaseSeen('3.28.0', [ROAD_ATLAS, NOTES_PHOTOS]);
    expect(state().lastSeenVersion).toBe('3.28.0');
    expect(state().seenFeatures).toEqual([NOTES_PHOTOS, ROAD_ATLAS]);
  });

  it('markTried and markUsed add a feature once', () => {
    state().markTried(ROAD_ATLAS);
    state().markTried(ROAD_ATLAS);
    state().markUsed(RECEIPT_SCAN);
    state().markUsed(RECEIPT_SCAN);
    expect(state().triedFeatures).toEqual([ROAD_ATLAS]);
    expect(state().usedFeatures).toEqual([RECEIPT_SCAN]);
  });

  it('setHoldoutArm is sticky for an experiment and replaced by a new experiment', () => {
    state().setHoldoutArm('whats-new-1', 'holdout');
    state().setHoldoutArm('whats-new-1', 'treatment');
    expect(state().holdout).toEqual({ experimentKey: 'whats-new-1', arm: 'holdout' });

    state().setHoldoutArm('whats-new-2', 'treatment');
    expect(state().holdout).toEqual({ experimentKey: 'whats-new-2', arm: 'treatment' });
  });

  it('setReturnSessionOpen toggles the in-memory flag', () => {
    expect(state().returnSessionOpen).toBe(false);
    state().setReturnSessionOpen(true);
    expect(state().returnSessionOpen).toBe(true);
  });
});
