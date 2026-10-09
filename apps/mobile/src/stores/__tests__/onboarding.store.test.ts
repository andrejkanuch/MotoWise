// garage_first gate hold (`awaitingGarageCta`) and the completion marker
// (`completionSent`): both survive a kill (persisted), both are cleared when the
// rider enters the garage (reset) and on sign-out, and sign-out keeps the
// rider's answers.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());

import { isServerOnboardingComplete } from '../../lib/onboarding-paywall';
import { useOnboardingStore } from '../onboarding.store';

const persisted = () => {
  const { partialize } = useOnboardingStore.persist.getOptions();
  if (!partialize) throw new Error('onboarding store has no partialize');
  return partialize(useOnboardingStore.getState()) as Record<string, unknown>;
};

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('onboarding completion flags', () => {
  it('persists the gate hold and the completion marker so a kill resumes correctly', () => {
    const store = useOnboardingStore.getState();
    store.setAwaitingGarageCta(true);
    store.setCompletionSent(true);

    expect(persisted()).toMatchObject({ awaitingGarageCta: true, completionSent: true });
  });

  it('reset() (entering the garage) clears both', () => {
    const store = useOnboardingStore.getState();
    store.setAwaitingGarageCta(true);
    store.setCompletionSent(true);

    store.reset();

    const state = useOnboardingStore.getState();
    expect(state.awaitingGarageCta).toBe(false);
    expect(state.completionSent).toBe(false);
  });

  it('sign-out drops the whole run, so the next account cannot resume it', () => {
    const store = useOnboardingStore.getState();
    store.setHeardFrom('instagram');
    store.setRidingGoals(['track_rides']);
    store.setLastCompletedScreen('personalizing');
    store.setAwaitingGarageCta(true);
    store.setCompletionSent(true);

    store.resetForSignOut();

    const state = useOnboardingStore.getState();
    expect(state.awaitingGarageCta).toBe(false);
    expect(state.completionSent).toBe(false);
    expect(state.heardFrom).toBeNull();
    expect(state.ridingGoals).toEqual([]);
    expect(state.lastCompletedScreen).toBeNull();
  });

  it('sign-out keeps the per-process intent resolution, so the next paywall does not wait', () => {
    const store = useOnboardingStore.getState();
    store.setIntentResolved(true);

    store.resetForSignOut();

    expect(useOnboardingStore.getState().intentResolved).toBe(true);
  });

  it('the root gate follows the server flag again once the hold is cleared', () => {
    const preferences = { onboardingCompleted: true };
    useOnboardingStore.getState().setAwaitingGarageCta(true);
    expect(
      isServerOnboardingComplete(preferences, useOnboardingStore.getState().awaitingGarageCta),
    ).toBe(false);

    useOnboardingStore.getState().resetForSignOut();
    expect(
      isServerOnboardingComplete(preferences, useOnboardingStore.getState().awaitingGarageCta),
    ).toBe(true);
  });
});
