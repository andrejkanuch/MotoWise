import { withTimeout } from '../with-timeout';

const MS = 5_000;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves with the value and leaves no timer armed', async () => {
    const result = withTimeout(Promise.resolve('done'), MS);
    expect(jest.getTimerCount()).toBe(1);

    await expect(result).resolves.toBe('done');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes the inner rejection through and leaves no timer armed', async () => {
    const error = new Error('upload failed');
    const result = withTimeout(Promise.reject(error), MS);

    await expect(result).rejects.toBe(error);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with the message once the promise outlives the timeout', async () => {
    const result = withTimeout(new Promise(() => {}), MS, 'signing timed out');
    const settled = expect(result).rejects.toThrow('signing timed out');

    jest.advanceTimersByTime(MS - 1);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);

    await settled;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('defaults the timeout message to "timeout"', async () => {
    const result = withTimeout(new Promise(() => {}), MS);
    const settled = expect(result).rejects.toThrow('timeout');
    jest.advanceTimersByTime(MS);
    await settled;
  });
});
