import { createBatterySaverToggle } from '../battery-saver-toggle';

function setup(apply: (enabled: boolean) => Promise<boolean>) {
  const deps = { apply: jest.fn(apply), commit: jest.fn(), report: jest.fn() };
  return { ...deps, toggle: createBatterySaverToggle(deps) };
}

/** A promise the test settles by hand, to hold a switch mid-apply. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createBatterySaverToggle', () => {
  it('commits the requested value once the profile is applied', async () => {
    const { toggle, commit, report } = setup(() => Promise.resolve(true));

    await toggle(true);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(true);
    expect(report).not.toHaveBeenCalled();
  });

  it('commits nothing when the profile change is refused', async () => {
    const { toggle, commit } = setup(() => Promise.resolve(false));

    await toggle(true);

    expect(commit).not.toHaveBeenCalled();
  });

  it('reports a switch that throws and commits nothing', async () => {
    const failure = new Error('DeniedForegroundLocationPermission');
    const { toggle, commit, report } = setup(() => Promise.reject(failure));

    await toggle(true);

    expect(commit).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(failure);
  });

  it('ignores a second tap while the first is applying', async () => {
    const first = deferred<boolean>();
    const { toggle, apply, commit } = setup(() => first.promise);

    const tap1 = toggle(true);
    const tap2 = toggle(true);
    first.resolve(true);
    await Promise.all([tap1, tap2]);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(true);
  });

  it('accepts a new tap once the previous switch settled, even after a failure', async () => {
    const { toggle, apply, commit } = setup(jest.fn());
    apply.mockRejectedValueOnce(new Error('first fails')).mockResolvedValueOnce(true);

    await toggle(true);
    await toggle(true);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledWith(true);
  });
});
