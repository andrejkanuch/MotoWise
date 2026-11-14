// garage_first gate hold (`awaitingGarageCta`) and the completion marker
// (`completionSent`): both survive a kill (persisted), both are cleared when the
// rider enters the garage (reset) and on sign-out, and sign-out keeps the
// rider's answers.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
const mockClearEmailDraft = jest.fn(async () => {});
jest.mock('../../lib/onboarding-email-draft', () => ({
  clearEmailDraft: () => mockClearEmailDraft(),
}));

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

describe('contact opt-in line (persist v9)', () => {
  it('persists the choice so a kill before personalizing keeps it', () => {
    useOnboardingStore.getState().setFeedbackContactOptIn(true);

    expect(persisted()).toMatchObject({ feedbackContactOptIn: true });
  });

  it('migrating a v8 store keeps the answers and adds the line unticked', async () => {
    const { migrate } = useOnboardingStore.persist.getOptions();
    if (!migrate) throw new Error('onboarding store has no migrate');
    const v8 = {
      ridingGoals: ['track_rides'],
      heardFrom: 'instagram',
      lastCompletedScreen: 'notifications',
      pendingIntent: null,
    };

    const migrated = (await migrate(v8, 8)) as unknown as Record<string, unknown>;

    expect(migrated).toEqual({ ...v8, feedbackContactOptIn: false });
  });
});

describe('account and bike drafts (persist v10, issue 365 T13a)', () => {
  const migrate = async (state: unknown, version: number) => {
    const { migrate: run } = useOnboardingStore.persist.getOptions();
    if (!run) throw new Error('onboarding store has no migrate');
    return (await run(state, version)) as unknown as Record<string, unknown>;
  };

  it('is version 10', () => {
    expect(useOnboardingStore.persist.getOptions().version).toBe(10);
  });

  it('migrating a v9 store keeps every field and adds empty drafts', async () => {
    const v9 = {
      ridingGoals: ['track_rides'],
      heardFrom: 'instagram',
      lastCompletedScreen: 'paywall',
      lastViewedScreen: 'account',
      lastViewedAt: 1_763_000_000_000,
      codeStepPending: true,
      pendingIntent: null,
      feedbackContactOptIn: true,
    };

    const migrated = await migrate({ ...v9 }, 9);

    expect(migrated).toEqual({ ...v9, accountDraft: null, bikeDraft: null, furthestScreen: null });
  });

  it('a v10 store loads unchanged', async () => {
    const v10 = {
      ridingGoals: ['track_rides'],
      accountDraft: { mode: 'code' },
      bikeDraft: { makeId: 7, make: 'Yamaha', modelQuery: 'MT-0', year: 2019 },
      furthestScreen: 'account',
    };

    expect(await migrate({ ...v10 }, 10)).toEqual(v10);
  });

  it('persists the account mode', () => {
    useOnboardingStore.getState().setAccountDraft({ mode: 'code' });

    expect(persisted()).toMatchObject({ accountDraft: { mode: 'code' } });
  });

  it('persists neither an email nor a password, anywhere in the state', () => {
    const store = useOnboardingStore.getState();
    store.setAccountDraft({ mode: 'code' });
    store.setCodeStepPending(true);

    const keys: string[] = [];
    JSON.stringify(persisted(), (key, value) => {
      keys.push(key.toLowerCase());
      return value;
    });
    expect(keys.filter((k) => k.includes('email') || k.includes('password'))).toEqual([]);
  });

  it('completing onboarding clears the SecureStore email draft', () => {
    mockClearEmailDraft.mockClear();

    useOnboardingStore.getState().setCompletionSent(true);

    expect(mockClearEmailDraft).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['reset()', () => useOnboardingStore.getState().reset()],
    ['resetForSignOut()', () => useOnboardingStore.getState().resetForSignOut()],
  ])('%s clears both drafts and the SecureStore email draft', (_name, run) => {
    useOnboardingStore.getState().setAccountDraft({ mode: 'email' });
    mockClearEmailDraft.mockClear();

    run();

    const state = useOnboardingStore.getState();
    expect(state.accountDraft).toBeNull();
    expect(state.bikeDraft).toBeNull();
    expect(state.furthestScreen).toBeNull();
    expect(mockClearEmailDraft).toHaveBeenCalledTimes(1);
  });
});
