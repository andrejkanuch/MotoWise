// Log out and both account-deletion flows share signOutUser. The account-scoped
// cleanup needs the session, so it must finish BEFORE the session is ended.

const calls: string[] = [];

jest.mock('../../components/bike-hub/notes/unattached-note-photos', () => ({
  releaseSheetDraftsForSignOut: jest.fn(async () => {
    calls.push('release-drafts');
  }),
}));
jest.mock('../../lib/push-token', () => ({
  unregisterPushTokenForSignOut: jest.fn(async () => {
    calls.push('unregister-push');
  }),
}));
jest.mock('../../lib/supabase', () => ({
  safeSignOut: jest.fn(async () => {
    calls.push('sign-out');
  }),
}));

import { signOutUser } from '../sign-out';

beforeEach(() => {
  calls.length = 0;
});

describe('signOutUser', () => {
  it('releases drafts and unregisters the push token before ending the session', async () => {
    await signOutUser();
    expect(calls).toHaveLength(3);
    expect(calls[2]).toBe('sign-out');
    expect(calls.slice(0, 2).sort()).toEqual(['release-drafts', 'unregister-push']);
  });
});
