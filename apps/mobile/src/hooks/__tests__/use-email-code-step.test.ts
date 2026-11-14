const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
const mockSaveEmailDraft = jest.fn(async (_draft: unknown) => {});
const mockReadEmailDraft = jest.fn(async (): Promise<unknown> => null);
const mockClearEmailDraft = jest.fn(async () => {});
jest.mock('../../lib/onboarding-email-draft', () => ({
  ...jest.requireActual('../../lib/onboarding-email-draft'),
  saveEmailDraft: (draft: unknown) => mockSaveEmailDraft(draft),
  readEmailDraft: () => mockReadEmailDraft(),
  clearEmailDraft: () => mockClearEmailDraft(),
}));

import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { resetEmailDraftRestoreClaim } from '../../lib/onboarding-email-draft';
import { useEmailCodeStep } from '../use-email-code-step';

type BackListener = () => boolean | null | undefined;
let backListeners: BackListener[] = [];

/** What Android does on a hardware back: the newest listener first, until one handles it. */
function pressAndroidBack(): boolean {
  for (const listener of [...backListeners].reverse()) {
    if (listener()) return true;
  }
  return false;
}

const STEP = { email: 'rider@example.com', password: 'hunter22' } as const;

beforeEach(() => {
  backListeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    backListeners.push(listener);
    return {
      remove: () => {
        backListeners = backListeners.filter((l) => l !== listener);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  mockTrackEvent.mockClear();
  mockSaveEmailDraft.mockClear();
  mockReadEmailDraft.mockReset();
  mockReadEmailDraft.mockResolvedValue(null);
  mockClearEmailDraft.mockClear();
  resetEmailDraftRestoreClaim();
});

describe('useEmailCodeStep', () => {
  it('opens a step and closes it, clearing the password', async () => {
    const clearPassword = jest.fn();
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword }));
    expect(result.current.codeStep).toBeNull();

    await act(async () => result.current.open({ ...STEP }));
    expect(result.current.codeStep).toEqual(STEP);
    expect(clearPassword).not.toHaveBeenCalled();

    await act(async () => result.current.close());
    expect(result.current.codeStep).toBeNull();
    expect(clearPassword).toHaveBeenCalledTimes(1);
  });

  it('opens a rate-limited step with the resend wait already running', async () => {
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword: jest.fn() }));

    await act(async () => result.current.openRateLimited(STEP.email, STEP.password, 42_000));
    expect(result.current.codeStep).toEqual({ ...STEP, initialCooldownMs: 42_000 });
  });

  it('listens for hardware back only while a step is open, and back closes it', async () => {
    const clearPassword = jest.fn();
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword }));
    expect(backListeners).toHaveLength(0);

    await act(async () => result.current.open({ ...STEP }));
    expect(backListeners).toHaveLength(1);

    let handled = false;
    await act(async () => {
      handled = pressAndroidBack();
    });
    expect(handled).toBe(true);
    expect(result.current.codeStep).toBeNull();
    expect(clearPassword).toHaveBeenCalledTimes(1);
    expect(backListeners).toHaveLength(0);
  });

  it('removes the listener when the step is closed directly', async () => {
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword: jest.fn() }));

    await act(async () => result.current.open({ ...STEP }));
    expect(backListeners).toHaveLength(1);

    await act(async () => result.current.close());
    expect(backListeners).toHaveLength(0);
  });

  it('swallows hardware back without closing while back is locked', async () => {
    const clearPassword = jest.fn();
    const { result, rerender } = await renderHook(
      ({ backLocked }: { backLocked: boolean }) => useEmailCodeStep({ clearPassword, backLocked }),
      { initialProps: { backLocked: false } },
    );

    await act(async () => result.current.open({ ...STEP }));
    await rerender({ backLocked: true });

    let handled = false;
    await act(async () => {
      handled = pressAndroidBack();
    });
    expect(handled).toBe(true);
    expect(result.current.codeStep).toEqual(STEP);
    expect(clearPassword).not.toHaveBeenCalled();
    expect(backListeners).toHaveLength(1);
  });

  it('swallows hardware back without closing while the step reports busy', async () => {
    const clearPassword = jest.fn();
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword }));

    await act(async () => result.current.open({ ...STEP }));
    await act(async () => result.current.onBusyChange(true));

    let handled = false;
    await act(async () => {
      handled = pressAndroidBack();
    });
    expect(handled).toBe(true);
    expect(result.current.codeStep).toEqual(STEP);
    expect(clearPassword).not.toHaveBeenCalled();

    await act(async () => result.current.onBusyChange(false));
    await act(async () => {
      handled = pressAndroidBack();
    });
    expect(handled).toBe(true);
    expect(result.current.codeStep).toBeNull();
  });

  it('back() from an on-screen button is ignored while busy or locked, and closes otherwise', async () => {
    const clearPassword = jest.fn();
    const { result, rerender } = await renderHook(
      ({ locked }: { locked: boolean }) => useEmailCodeStep({ clearPassword, backLocked: locked }),
      { initialProps: { locked: false } },
    );

    await act(async () => result.current.open({ ...STEP }));
    await act(async () => result.current.onBusyChange(true));
    await act(async () => result.current.back());
    expect(result.current.codeStep).toEqual(STEP);

    await act(async () => result.current.onBusyChange(false));
    await rerender({ locked: true });
    await act(async () => result.current.back());
    expect(result.current.codeStep).toEqual(STEP);
    expect(clearPassword).not.toHaveBeenCalled();

    await rerender({ locked: false });
    await act(async () => result.current.back());
    expect(result.current.codeStep).toBeNull();
    expect(clearPassword).toHaveBeenCalledTimes(1);
  });
});

// issue 365 T13a (FS-OB3): the onboarding screens keep {email, codeSentAt} in
// SecureStore while a code step is open, so a relaunch reopens it.
describe('useEmailCodeStep with a persisted draft', () => {
  const NOW = Date.UTC(2026, 10, 14, 9, 0, 0);
  const MINUTE = 60_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('does not touch SecureStore without persistDraft', async () => {
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword: jest.fn() }));
    await act(async () => result.current.open({ ...STEP }));

    expect(mockReadEmailDraft).not.toHaveBeenCalled();
    expect(mockSaveEmailDraft).not.toHaveBeenCalled();
  });

  it('persists {email, codeSentAt} on open, never the password', async () => {
    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );

    await act(async () => result.current.open({ ...STEP }));

    expect(mockSaveEmailDraft).toHaveBeenCalledWith({ email: STEP.email, codeSentAt: NOW });
    expect(JSON.stringify(mockSaveEmailDraft.mock.calls)).not.toContain(STEP.password);
  });

  it('persists a rate-limited open too', async () => {
    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );

    await act(async () => result.current.openRateLimited(STEP.email, STEP.password, 42_000));

    expect(mockSaveEmailDraft).toHaveBeenCalledWith({ email: STEP.email, codeSentAt: NOW });
  });

  it('"Change email" clears the draft', async () => {
    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => result.current.open({ ...STEP }));

    await act(async () => result.current.close());

    expect(mockClearEmailDraft).toHaveBeenCalledTimes(1);
  });

  it('reopens the code step for the saved address within 1 h, without a password', async () => {
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW - 20 * MINUTE });
    const onDraftEmail = jest.fn();

    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true, onDraftEmail }),
    );
    await act(async () => {});

    expect(result.current.codeStep?.email).toBe(STEP.email);
    expect(result.current.codeStep?.password).toBeUndefined();
    // The form behind the step keeps the address for "Change email".
    expect(onDraftEmail).toHaveBeenCalledWith(STEP.email);
    expect(mockTrackEvent).toHaveBeenCalledWith('EMAIL_CODE_STEP_RESTORED', { age_s: 1200 });
  });

  it('keeps the resend wait the rider had left when it reopens', async () => {
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW - 20_000 });

    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => {});

    expect(result.current.codeStep?.initialCooldownMs).toBe(40_000);
  });

  it('after 1 h hands the address to the form instead of reopening the step', async () => {
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW - 61 * MINUTE });
    const onDraftEmail = jest.fn();

    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true, onDraftEmail }),
    );
    await act(async () => {});

    expect(result.current.codeStep).toBeNull();
    expect(onDraftEmail).toHaveBeenCalledWith(STEP.email);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('a step the rider opened before the read finished wins over the draft', async () => {
    let resolveRead: (draft: unknown) => void = () => {};
    mockReadEmailDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );
    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );

    await act(async () => result.current.open({ email: 'new@example.com', password: 'pw' }));
    await act(async () => resolveRead({ email: STEP.email, codeSentAt: NOW - MINUTE }));

    expect(result.current.codeStep?.email).toBe('new@example.com');
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
  it('restores only on the first read of a launch, not on a screen pushed later', async () => {
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW - MINUTE });
    const first = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => {});
    expect(first.result.current.codeStep?.email).toBe(STEP.email);

    // e.g. "Have an account?" pushes sign-in while the account code step is open.
    const onDraftEmail = jest.fn();
    const second = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true, onDraftEmail }),
    );
    await act(async () => {});

    expect(second.result.current.codeStep).toBeNull();
    expect(onDraftEmail).not.toHaveBeenCalled();
  });

  it('a step opened in this launch means a later screen does not restore', async () => {
    const first = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => first.result.current.open({ ...STEP }));
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW });

    const second = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => {});

    expect(second.result.current.codeStep).toBeNull();
  });

  it('a draft read after the rider typed into the form does not replace it', async () => {
    mockReadEmailDraft.mockResolvedValue({ email: STEP.email, codeSentAt: NOW - MINUTE });
    const onDraftEmail = jest.fn();

    const { result } = await renderHook(() =>
      useEmailCodeStep({
        clearPassword: jest.fn(),
        persistDraft: true,
        formDirty: true,
        onDraftEmail,
      }),
    );
    await act(async () => {});

    expect(result.current.codeStep).toBeNull();
    expect(onDraftEmail).not.toHaveBeenCalled();
  });

  it('a resend saves the new send time for the open address', async () => {
    const { result } = await renderHook(() =>
      useEmailCodeStep({ clearPassword: jest.fn(), persistDraft: true }),
    );
    await act(async () => result.current.open({ ...STEP }));
    mockSaveEmailDraft.mockClear();
    (Date.now as jest.Mock).mockReturnValue(NOW + 90_000);

    await act(async () => result.current.onCodeResent());

    expect(mockSaveEmailDraft).toHaveBeenCalledWith({
      email: STEP.email,
      codeSentAt: NOW + 90_000,
    });
  });

  it('a resend saves nothing without persistDraft', async () => {
    const { result } = await renderHook(() => useEmailCodeStep({ clearPassword: jest.fn() }));
    await act(async () => result.current.open({ ...STEP }));

    await act(async () => result.current.onCodeResent());

    expect(mockSaveEmailDraft).not.toHaveBeenCalled();
  });
});
