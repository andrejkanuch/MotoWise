// garage_first "Open my garage" handoff: the paywall presents once, the rider
// reaches the garage exactly once whatever happens, and a late result after the
// escape link is dropped.

import { createGaragePaywallHandoff, GARAGE_PAYWALL_RESULT } from '../garage-paywall-handoff';

function setup(present: (shouldAbort: () => boolean) => Promise<string>) {
  const deps = {
    present: jest.fn(present),
    onStart: jest.fn(),
    onSettled: jest.fn(),
    onError: jest.fn(),
  };
  return { deps, handoff: createGaragePaywallHandoff(deps) };
}

/** A paywall whose result the test decides. */
function deferredPaywall() {
  let resolve: (result: string) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { present: () => promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('createGaragePaywallHandoff', () => {
  it('presents once and settles with the paywall result', async () => {
    const paywall = deferredPaywall();
    const { deps, handoff } = setup(paywall.present);

    handoff.open();
    handoff.open(); // a second tap while the paywall loads
    paywall.resolve('purchased');
    await flush();

    expect(deps.onStart).toHaveBeenCalledTimes(1);
    expect(deps.present).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledWith('purchased');
  });

  it('settles as presentation_failed when present rejects, and reports the error', async () => {
    const paywall = deferredPaywall();
    const { deps, handoff } = setup(paywall.present);
    const error = new Error('boom');

    handoff.open();
    paywall.reject(error);
    await flush();

    expect(deps.onError).toHaveBeenCalledWith(error);
    expect(deps.onSettled).toHaveBeenCalledWith(GARAGE_PAYWALL_RESULT.PRESENTATION_FAILED);
  });

  it('the escape link settles immediately and drops the late paywall result', async () => {
    const paywall = deferredPaywall();
    const { deps, handoff } = setup(paywall.present);

    handoff.open();
    handoff.escape();
    paywall.resolve('closed');
    await flush();

    expect(deps.onSettled).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledWith(GARAGE_PAYWALL_RESULT.ESCAPE_HATCH);
  });

  it('tells the paywall to abort once the rider escaped', async () => {
    let shouldAbort: () => boolean = () => false;
    const { handoff } = setup((abort) => {
      shouldAbort = abort;
      return new Promise(() => {});
    });

    handoff.open();
    expect(shouldAbort()).toBe(false);
    handoff.escape();

    expect(shouldAbort()).toBe(true);
    expect(handoff.isSettled()).toBe(true);
  });

  it('cannot be re-opened after it settled', async () => {
    const { deps, handoff } = setup(() => Promise.resolve('closed'));

    handoff.open();
    await flush();
    handoff.open();

    expect(deps.present).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });
});
