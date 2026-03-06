import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '../auth.store';

const fakeSession: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'user-123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'rider@motolearn.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2025-01-01T00:00:00Z',
    identities: [],
    factors: [],
  },
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset to initial state before each test
    useAuthStore.setState({ session: null, isLoading: true });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('setSession updates session', () => {
    useAuthStore.getState().setSession(fakeSession);

    const state = useAuthStore.getState();
    expect(state.session).toBe(fakeSession);
    expect(state.session?.user.email).toBe('rider@motolearn.test');
  });

  it('setSession can clear session back to null', () => {
    useAuthStore.getState().setSession(fakeSession);
    expect(useAuthStore.getState().session).not.toBeNull();

    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('setLoading updates isLoading', () => {
    expect(useAuthStore.getState().isLoading).toBe(true);

    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);

    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('setSession and setLoading are independent', () => {
    useAuthStore.getState().setSession(fakeSession);
    useAuthStore.getState().setLoading(false);

    const state = useAuthStore.getState();
    expect(state.session).toBe(fakeSession);
    expect(state.isLoading).toBe(false);
  });
});
