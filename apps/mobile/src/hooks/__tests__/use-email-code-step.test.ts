import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
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
