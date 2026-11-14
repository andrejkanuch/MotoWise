import { isExplicitSignOutInProgress, withExplicitSignOut } from '../explicit-sign-out';

describe('withExplicitSignOut', () => {
  it('marks the sign-out only while it runs', async () => {
    let seen = false;
    await withExplicitSignOut(async () => {
      seen = isExplicitSignOutInProgress();
    });
    expect(seen).toBe(true);
    expect(isExplicitSignOutInProgress()).toBe(false);
  });

  it('clears the mark when the sign-out throws', async () => {
    await expect(
      withExplicitSignOut(async () => {
        throw new Error('network');
      }),
    ).rejects.toThrow('network');
    expect(isExplicitSignOutInProgress()).toBe(false);
  });
});
