import { act, renderHook } from '@testing-library/react-native';
import { RESEND_COOLDOWN_MS } from '../../config/auth';
import { useResendCooldown } from '../use-resend-cooldown';

describe('useResendCooldown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports not cooling down when nothing was sent', async () => {
    const { result } = await renderHook(() => useResendCooldown());
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('counts down from 60 after a send and ends after 60 s', async () => {
    const { result } = await renderHook(() => useResendCooldown());

    await act(async () => result.current.start());
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.remainingSeconds).toBe(RESEND_COOLDOWN_MS / 1000);

    await act(async () => jest.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(59);

    await act(async () => jest.advanceTimersByTime(RESEND_COOLDOWN_MS - 1000));
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('uses a server-reported wait when given one', async () => {
    const { result } = await renderHook(() => useResendCooldown());
    await act(async () => result.current.start(42_000));
    expect(result.current.remainingSeconds).toBe(42);
  });

  it('can open with a countdown already running', async () => {
    const { result } = await renderHook(() => useResendCooldown(30_000));
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.remainingSeconds).toBe(30);

    await act(async () => jest.advanceTimersByTime(30_000));
    expect(result.current.isCoolingDown).toBe(false);
  });

  it('derives the remaining time from the clock, not from ticks', async () => {
    const { result } = await renderHook(() => useResendCooldown());
    await act(async () => result.current.start());
    // The clock jumps (app backgrounded) without intervening ticks firing.
    await act(async () => {
      jest.setSystemTime(Date.now() + 45_000);
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(14);
  });
});
